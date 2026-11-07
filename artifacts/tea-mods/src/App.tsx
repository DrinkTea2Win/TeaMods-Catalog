import { type ReactNode, useEffect, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ClerkProvider, SignIn, SignUp, useAuth, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { ModAdminTools } from '@/components/mod-admin-tools';
import {
  getGetModQueryKey, getListModsQueryKey,
  useAcceptDisclaimer, useCreateMod, useGetMod, useHealthCheck,
  useListMods, useListTags, useReportMod, useToggleModLike, useUploadModFile,
} from '@workspace/api-client-react';
import { Link, Route, Switch, useLocation, useParams, Router as WouterRouter } from 'wouter';
import {
  ArrowDownToLine, ArrowLeft, ArrowUpRight, Check, ChevronRight, FileArchive,
  Heart, Leaf, Plus, Search, ShieldAlert, SlidersHorizontal, Sparkles, Upload, X,
} from 'lucide-react';
import { useMemo, useState as useLocalState } from 'react';
import type { ListModsParams, ReportInputReason, ModFile } from '@workspace/api-client-react';

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || '/'
    : path;
}

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#31624d',
    colorForeground: '#24352d',
    colorMutedForeground: '#516b5e',
    colorDanger: '#b63e34',
    colorBackground: '#fffcf5',
    colorInput: '#ffffff',
    colorInputForeground: '#24352d',
    colorNeutral: '#d7dfd6',
    fontFamily: '"DM Sans", sans-serif',
    borderRadius: '16px',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#fffcf5] rounded-2xl w-[440px] max-w-full overflow-hidden border border-[#d7dfd6] shadow-xl',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#19382d] font-bold',
    headerSubtitle: 'text-[#516b5e]',
    socialButtonsBlockButtonText: 'text-[#24352d] font-semibold',
    formFieldLabel: 'text-[#24352d] font-semibold',
    footerActionLink: 'text-[#31624d] font-semibold',
    footerActionText: 'text-[#516b5e]',
    dividerText: 'text-[#69796f]',
    identityPreviewEditButton: 'text-[#31624d]',
    formFieldSuccessText: 'text-[#31624d]',
    alertText: 'text-[#24352d]',
    logoBox: 'h-10 w-10',
    logoImage: 'h-10 w-10',
    socialButtonsBlockButton: 'border border-[#d7dfd6] bg-white',
    formButtonPrimary: 'bg-[#31624d] text-white',
    formFieldInput: 'border-[#d7dfd6] bg-white text-[#24352d]',
    footerAction: 'text-[#516b5e]',
    dividerLine: 'bg-[#d7dfd6]',
    alert: 'border border-[#d7dfd6] bg-[#f6f4ec]',
    otpCodeFieldInput: 'border-[#d7dfd6] bg-white text-[#24352d]',
    formFieldRow: 'gap-2',
    main: 'w-full',
  },
};

const DISCLAIMER = 'Нажимая "Продолжить", вы соглашаетесь с тем, что все моды загружены пользователями, администрация не проверяет файлы на вирусы, и вы скачиваете их на свой страх и риск';
const FILE_WARNING = 'Файл предоставлен автором. Проверьте на VirusTotal перед запуском';
function getApiErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null && 'data' in error) {
    const data = (error as { data?: unknown }).data;
    if (typeof data === 'object' && data !== null && 'error' in data) {
      const message = (data as { error?: unknown }).error;
      if (typeof message === 'string' && message.length > 0) return message;
    }
  }
  return fallback;
}
const reasons: { value: ReportInputReason; label: string }[] = [
  { value: 'malware', label: 'Подозрение на вредоносный файл' },
  { value: 'copyright', label: 'Нарушение авторских прав' },
  { value: 'broken', label: 'Файл или описание не работают' },
  { value: 'inappropriate', label: 'Неподходящий контент' },
  { value: 'other', label: 'Другая причина' },
];

type SelectedModFile = {
  id: string;
  file: File;
  fileName: string;
};

const UPLOAD_FORM_STORAGE_KEY = 'teamods-upload-form';

function readSavedUploadForm() {
  const empty = { title: '', description: '', selectedTags: [] as string[] };
  if (typeof window === 'undefined') return empty;
  try {
    const raw = window.sessionStorage.getItem(UPLOAD_FORM_STORAGE_KEY);
    if (!raw) return empty;
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) return empty;
    const saved = value as Record<string, unknown>;
    return {
      title: typeof saved.title === 'string' ? saved.title : '',
      description: typeof saved.description === 'string' ? saved.description : '',
      selectedTags: Array.isArray(saved.selectedTags)
        ? saved.selectedTags.filter((tag): tag is string => typeof tag === 'string').slice(0, 5)
        : [],
    };
  } catch {
    return empty;
  }
}

function Shell({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const [location, setLocation] = useLocation();
  const [dialog, setDialog] = useState(!localStorage.getItem('disclaimerAccepted'));
  const [queued, setQueued] = useState<null | (() => void)>(null);
  const accept = useAcceptDisclaimer();
  const queryClient = useQueryClient();
  useEffect(() => {
    if (localStorage.getItem('disclaimerAccepted')) {
      accept.mutate(undefined, {
        onError: () => {
          localStorage.removeItem('disclaimerAccepted');
          setDialog(true);
        },
      });
    }
  }, [accept.mutate]);
  const openConsent = (action: () => void) => {
    if (!localStorage.getItem('disclaimerAccepted')) { setQueued(() => action); setDialog(true); return; }
    action();
  };
  const login = () => {
    sessionStorage.setItem(
      'tea-auth-redirect',
      `${window.location.pathname}${window.location.search}`,
    );
    setLocation('/sign-in');
  };
  const acceptConsent = () => accept.mutate(undefined, {
    onSuccess: () => {
      localStorage.setItem('disclaimerAccepted', 'true');
      setDialog(false);
      queryClient.invalidateQueries({ queryKey: getListModsQueryKey() });
      if (location.startsWith('/mods/')) queryClient.invalidateQueries({ queryKey: getGetModQueryKey(location.split('/').pop() || '') });
      const next = queued; setQueued(null); next?.();
    },
  });
  useEffect(() => {
    const requestLogin = () => openConsent(() => login());
    window.addEventListener('tea-login', requestLogin);
    return () => window.removeEventListener('tea-login', requestLogin);
  });
  const closeConsent = () => { setDialog(false); setQueued(null); };
  const doLogin = () => openConsent(() => login());
  return <div className="min-h-[100dvh] text-foreground">
    <header className="sticky top-0 z-30 border-b border-border/80 bg-background/90 backdrop-blur-xl">
      <div className="mx-auto flex h-[74px] max-w-6xl items-center justify-between px-5 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5" data-testid="link-home">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground"><Leaf size={19} strokeWidth={2.2} /></span>
          <span className="font-[var(--app-font-serif)] text-[21px] font-extrabold tracking-[-.06em]">Tea<span className="text-primary">Mods</span></span>
        </Link>
        <nav className="hidden items-center gap-8 text-[13px] font-semibold text-muted-foreground md:flex">
          <Link href="/" className={`transition-colors hover:text-foreground ${location === '/' ? 'text-foreground' : ''}`}>Каталог</Link>
          <Link href="/upload" className={`transition-colors hover:text-foreground ${location === '/upload' ? 'text-foreground' : ''}`}>Авторам</Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/upload" className="hidden items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-[13px] font-bold transition hover:border-primary/40 hover:bg-secondary sm:flex" data-testid="link-upload"><Upload size={15} /> Добавить мод</Link>
          {!isLoaded ? <span className="skeleton h-9 w-24 rounded-xl" /> : isSignedIn
            ? <button onClick={() => { sessionStorage.removeItem('tea-auth-redirect'); void signOut({ redirectUrl: basePath || '/' }); }} className="rounded-xl px-3 py-2 text-[13px] font-bold text-muted-foreground hover:text-foreground" data-testid="button-logout">Выйти</button>
            : <button onClick={doLogin} className="rounded-xl bg-primary px-4 py-2.5 text-[13px] font-bold text-primary-foreground transition hover:brightness-110" data-testid="button-login">Войти</button>}
        </div>
      </div>
    </header>
    {children}
    {isSignedIn && location !== '/upload' && (
      <Link
        href="/upload"
        aria-label="Добавить мод"
        title="Добавить мод"
        className="fixed bottom-6 right-5 z-40 grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_12px_30px_rgba(32,64,48,.24)] transition hover:-translate-y-0.5 hover:brightness-110 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40 sm:bottom-8 sm:right-8"
        data-testid="button-floating-add-mod"
      >
        <Plus size={23} strokeWidth={2.5} />
      </Link>
    )}
    <footer className="mt-20 border-t border-border/80">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between lg:px-8">
        <div className="flex items-center gap-2 font-semibold text-foreground"><Leaf size={15} className="text-primary" /> TeaMods <span className="font-normal text-muted-foreground">— моды для ваших миров</span></div>
        <span>Файлы загружают авторы сообщества</span>
      </div>
    </footer>
    {dialog && <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-[3px]" role="dialog" aria-modal="true" aria-labelledby="consent-heading">
      <div className="page-enter relative w-full max-w-[480px] rounded-[26px] border border-border bg-card p-7 shadow-2xl sm:p-9">
        <button onClick={closeConsent} aria-label="Закрыть" className="absolute right-5 top-5 rounded-full p-2 text-muted-foreground hover:bg-secondary hover:text-foreground" data-testid="button-close-disclaimer"><X size={18} /></button>
        <div className="mb-6 grid h-12 w-12 place-items-center rounded-2xl bg-accent/30 text-primary"><ShieldAlert size={23} /></div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[.16em] text-primary">Перед загрузкой</p>
        <h2 id="consent-heading" className="font-[var(--app-font-serif)] text-[27px] font-extrabold leading-tight tracking-[-.04em]">Небольшое предупреждение</h2>
        <p className="mt-4 text-[14px] leading-7 text-muted-foreground">{DISCLAIMER}</p>
        {accept.isError && <p className="mt-3 text-sm text-destructive">Не удалось сохранить согласие. Попробуйте ещё раз.</p>}
        <button disabled={accept.isPending} onClick={acceptConsent} className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3.5 text-sm font-bold text-primary-foreground disabled:opacity-60" data-testid="button-accept-disclaimer">
          {accept.isPending ? 'Сохраняем…' : 'Продолжить'} <ChevronRight size={16} />
        </button>
        <button onClick={closeConsent} className="mt-3 w-full py-2 text-sm font-semibold text-muted-foreground hover:text-foreground" data-testid="button-dismiss-disclaimer">Пока не сейчас</button>
      </div>
    </div>}
  </div>;
}

function SkeletonCard() { return <div className="rounded-2xl border border-border bg-card p-5"><div className="skeleton h-5 w-2/3 rounded" /><div className="skeleton mt-4 h-3 w-full rounded" /><div className="skeleton mt-2 h-3 w-4/5 rounded" /><div className="mt-6 flex gap-2"><div className="skeleton h-6 w-16 rounded-full" /><div className="skeleton h-6 w-20 rounded-full" /></div></div>; }

function Home() {
  const [search, setSearch] = useState('');
  const [tag, setTag] = useState('');
  const [sort, setSort] = useState<'popular' | 'newest'>('popular');
  const params = useMemo<ListModsParams>(() => ({ q: search || undefined, tag: tag || undefined, sort, page: 1, pageSize: 30 }), [search, tag, sort]);
  const mods = useListMods(params);
  const tags = useListTags();
  const health = useHealthCheck();
  const items = mods.data?.items ?? [];
  return <main className="page-enter mx-auto max-w-6xl px-5 pb-5 pt-9 lg:px-8">
    <section className="relative overflow-hidden rounded-[30px] bg-[#e6eee5] px-6 py-9 sm:px-10 sm:py-12 lg:px-14">
      <div className="pointer-events-none absolute -right-16 -top-28 h-[340px] w-[340px] rounded-full border border-primary/10" />
      <div className="pointer-events-none absolute -right-3 -top-16 h-[225px] w-[225px] rounded-full border border-primary/10" />
      <div className="relative max-w-[650px]">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-card/65 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[.13em] text-primary"><Sparkles size={13} /> Тёплое место для новых идей</div>
        <h1 className="font-[var(--app-font-serif)] text-[clamp(2.5rem,6vw,4.4rem)] font-extrabold leading-[.98] tracking-[-.075em] text-[#19382d]">Найди мод.<br /><span className="text-primary">Измени мир.</span></h1>
        <p className="mt-5 max-w-md text-[15px] leading-7 text-[#516b5e]">Подборка дополнений для Minecraft от авторов сообщества. Исследуй, сохраняй любимое и делись своим.</p>
        <form className="mt-7 flex max-w-[590px] items-center rounded-2xl border border-primary/15 bg-card p-1.5 shadow-[0_12px_32px_rgba(33,73,54,.08)]" onSubmit={e => e.preventDefault()}>
          <Search size={19} className="ml-3 shrink-0 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Название мода или что-то особенное…" className="h-11 min-w-0 flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground/80" data-testid="input-search-mods" />
          <button type="submit" className="rounded-xl bg-primary px-4 py-3 text-xs font-bold text-primary-foreground transition hover:brightness-110" data-testid="button-search">Найти</button>
        </form>
      </div>
      <div className="absolute bottom-8 right-10 hidden rotate-[-8deg] rounded-2xl border border-white/70 bg-card/75 px-4 py-3 shadow-sm backdrop-blur sm:block"><div className="font-mono text-[10px] font-bold tracking-widest text-primary">НОВЫЙ МИР</div><div className="mt-1 font-[var(--app-font-serif)] text-lg font-extrabold tracking-tight">начинается здесь.</div></div>
    </section>
    <section className="mt-9">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><p className="text-[11px] font-bold uppercase tracking-[.16em] text-primary">Каталог сообщества</p><h2 className="mt-1 font-[var(--app-font-serif)] text-[27px] font-extrabold tracking-[-.05em]">Моды для твоего мира</h2></div>
        <div className="flex items-center gap-1 rounded-xl bg-secondary/75 p-1" aria-label="Сортировка">
          <button onClick={() => setSort('popular')} className={`rounded-lg px-3.5 py-2 text-xs font-bold transition ${sort === 'popular' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`} data-testid="button-sort-popular">Популярные</button>
          <button onClick={() => setSort('newest')} className={`rounded-lg px-3.5 py-2 text-xs font-bold transition ${sort === 'newest' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`} data-testid="button-sort-newest">Новые</button>
        </div>
      </div>
      <div className="mt-5 flex items-center gap-2 overflow-x-auto pb-2">
        <SlidersHorizontal size={15} className="mr-1 shrink-0 text-muted-foreground" />
        <button onClick={() => setTag('')} className={`shrink-0 rounded-full border px-3.5 py-2 text-xs font-bold transition ${!tag ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:border-primary/40'}`} data-testid="filter-tag-all">Все жанры</button>
        {tags.isLoading ? <span className="skeleton h-8 w-24 rounded-full" /> : tags.data?.map(t => <button key={t.id} onClick={() => setTag(tag === t.slug ? '' : t.slug)} className={`shrink-0 rounded-full border px-3.5 py-2 text-xs font-bold transition ${tag === t.slug ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:border-primary/40'}`} data-testid={`filter-tag-${t.slug}`}>{t.name}<span className="ml-1.5 opacity-60">{t.modCount}</span></button>)}
      </div>
      {health.isError && <div className="mt-5 rounded-xl border border-destructive/25 bg-destructive/5 p-4 text-sm text-destructive" data-testid="status-health-error">Сервис каталога сейчас недоступен. Обновите страницу чуть позже.</div>}
      {mods.isError ? <div className="mt-6 rounded-2xl border border-destructive/20 bg-card p-10 text-center" data-testid="status-catalog-error"><p className="font-bold">Каталог не загрузился</p><p className="mt-2 text-sm text-muted-foreground">Проверьте соединение и попробуйте ещё раз.</p><button onClick={() => mods.refetch()} className="mt-4 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground" data-testid="button-retry-catalog">Повторить</button></div>
      : mods.isLoading ? <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <SkeletonCard key={i} />)}</div>
      : items.length === 0 ? <div className="mt-5 rounded-2xl border border-dashed border-border bg-card/70 px-6 py-14 text-center" data-testid="empty-catalog"><div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-secondary text-primary"><Search size={21} /></div><h3 className="mt-4 font-[var(--app-font-serif)] text-xl font-extrabold">Пока ничего не нашлось</h3><p className="mt-2 text-sm text-muted-foreground">Попробуй изменить запрос или выбрать другой жанр.</p><button onClick={() => { setSearch(''); setTag(''); }} className="mt-4 text-sm font-bold text-primary hover:underline" data-testid="button-reset-filters">Сбросить фильтры</button></div>
      : <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">{items.map((mod, index) => <Link href={`/mods/${mod.id}`} key={mod.id} className="group relative flex min-h-[206px] flex-col rounded-2xl border border-border bg-card p-5 transition duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-[0_12px_30px_rgba(32,64,48,.07)]" data-testid={`card-mod-${mod.id}`}>
        <div className="flex items-start justify-between gap-3"><div className={`grid h-10 w-10 place-items-center rounded-xl ${index % 3 === 0 ? 'bg-[#e5eee3] text-[#35654e]' : index % 3 === 1 ? 'bg-[#f3e9d8] text-[#946b37]' : 'bg-[#e0ecec] text-[#447878]'}`}><FileArchive size={18} /></div><ArrowUpRight size={16} className="mt-1 text-muted-foreground transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" /></div>
        <h3 className="mt-4 font-[var(--app-font-serif)] text-[18px] font-extrabold tracking-[-.035em] group-hover:text-primary">{mod.title}</h3>
        <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-muted-foreground">{mod.description}</p>
        <div className="mt-auto flex items-end justify-between gap-3 pt-5"><div className="flex flex-wrap gap-1.5">{mod.tags.slice(0, 2).map(t => <span key={t} className="rounded-md bg-secondary px-2 py-1 text-[10px] font-bold text-secondary-foreground">{t}</span>)}</div><div className="flex shrink-0 items-center gap-3 text-[11px] font-semibold text-muted-foreground"><span className="flex items-center gap-1"><Heart size={12} />{mod.likeCount}</span><span className="flex items-center gap-1"><ArrowDownToLine size={12} />{mod.downloadCount}</span></div></div>
      </Link>)}</div>}
      {mods.data && <p className="mt-5 text-center text-xs text-muted-foreground">Показано {items.length} из {mods.data.total} модов</p>}
    </section>
  </main>;
}

function ModPage() {
  const { modId = '' } = useParams<{ modId: string }>();
  const [location, setLocation] = useLocation();
  const auth = useAuth();
  const [disclaimer, setDisclaimer] = useLocalState(false);
  const [queuedFile, setQueuedFile] = useLocalState<ModFile | null>(null);
  const [reportOpen, setReportOpen] = useLocalState(false);
  const [reportReason, setReportReason] = useLocalState<ReportInputReason>('malware');
  const [reportDetails, setReportDetails] = useLocalState('');
  const [reportSuccess, setReportSuccess] = useLocalState(false);
  const [likeCount, setLikeCount] = useLocalState<number | null>(null);
  const detail = useGetMod(modId);
  const like = useToggleModLike();
  const report = useReportMod();
  const client = useQueryClient();
  useEffect(() => { setLikeCount(null); }, [modId]);
  const triggerDownload = (file: ModFile) => {
    if (!localStorage.getItem('disclaimerAccepted')) { setQueuedFile(file); setDisclaimer(true); return; }
    if (file.downloadUrl) window.location.assign(file.downloadUrl);
  };
  const accept = useAcceptDisclaimer();
  const acceptAndDownload = () => accept.mutate(undefined, { onSuccess: () => {
    localStorage.setItem('disclaimerAccepted', 'true'); setDisclaimer(false);
    client.invalidateQueries({ queryKey: getGetModQueryKey(modId) });
    const fileId = queuedFile?.id;
    setQueuedFile(null);
    if (fileId) detail.refetch().then(result => {
      const url = result.data?.files.find(file => file.id === fileId)?.downloadUrl;
      if (url) window.location.assign(url);
    });
  } });
  if (detail.isLoading) return <main className="mx-auto max-w-4xl px-5 py-12"><div className="skeleton h-5 w-28 rounded" /><div className="skeleton mt-8 h-12 w-2/3 rounded" /><div className="skeleton mt-4 h-20 w-full rounded" /><div className="skeleton mt-10 h-56 w-full rounded-2xl" /></main>;
  if (detail.isError || !detail.data) return <main className="mx-auto max-w-4xl px-5 py-16 text-center" data-testid="status-mod-error"><h1 className="font-[var(--app-font-serif)] text-3xl font-extrabold">Мод не найден</h1><p className="mt-3 text-muted-foreground">Возможно, ссылка устарела или мод временно скрыт.</p><Link href="/" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground"><ArrowLeft size={16} /> Вернуться в каталог</Link></main>;
  const mod = detail.data;
  return <main className="page-enter mx-auto max-w-4xl px-5 pb-10 pt-8 lg:px-8">
    <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition hover:text-primary" data-testid="link-back-catalog"><ArrowLeft size={16} /> Каталог</Link>
    <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_230px]">
      <div><div className="flex flex-wrap gap-2">{mod.tags.map(t => <span key={t} className="rounded-full bg-secondary px-3 py-1.5 text-[11px] font-bold text-secondary-foreground">{t}</span>)}</div>
        <h1 className="mt-4 font-[var(--app-font-serif)] text-[clamp(2rem,5vw,3.5rem)] font-extrabold leading-[1.06] tracking-[-.065em]">{mod.title}</h1>
        <div className="mt-3"><ModAdminTools modId={mod.id} verified={mod.verified} /></div>
        <p className="mt-3 text-sm text-muted-foreground">Автор: <span className="font-semibold text-foreground">{mod.authorDisplayName || 'Автор сообщества'}</span> <span className="mx-2">·</span> {mod.downloadCount.toLocaleString('ru-RU')} скачиваний</p>
      </div>
      <div className="flex items-center gap-2 lg:justify-end lg:self-start">
         <button disabled={like.isPending || !auth.isLoaded} onClick={() => { if (!auth.isSignedIn) { window.dispatchEvent(new Event('tea-login')); return; } like.mutate({ modId }, { onSuccess: result => { setLikeCount(result.likeCount); client.invalidateQueries({ queryKey: getGetModQueryKey(modId) }); client.invalidateQueries({ queryKey: getListModsQueryKey() }); } }); }} className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-bold transition hover:border-primary/40 hover:text-primary disabled:opacity-60" data-testid="button-like-mod"><Heart size={16} className={likeCount !== null ? 'fill-current text-primary' : ''} /> {likeCount ?? mod.likeCount}</button>
         <button onClick={() => { if (!auth.isSignedIn) { window.dispatchEvent(new Event('tea-login')); return; } setReportOpen(true); setReportSuccess(false); }} className="grid h-11 w-11 place-items-center rounded-xl border border-border bg-card text-muted-foreground transition hover:border-destructive/40 hover:text-destructive" aria-label="Пожаловаться" data-testid="button-report-mod"><ShieldAlert size={17} /></button>
      </div>
    </div>
    <section className="mt-9 rounded-[22px] border border-border bg-card p-6 sm:p-8"><div className="mb-4 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.15em] text-primary"><span className="h-px w-5 bg-primary" /> Описание</div><div className="whitespace-pre-wrap text-[15px] leading-8 text-foreground/85" data-testid="text-mod-description">{mod.description}</div></section>
    <section className="mt-8">
      <div className="mb-4 flex items-end justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[.15em] text-primary">Версии и файлы</p><h2 className="mt-1 font-[var(--app-font-serif)] text-2xl font-extrabold tracking-[-.045em]">Выбери свою версию</h2></div><span className="text-xs text-muted-foreground">{mod.files.length} {mod.files.length === 1 ? 'файл' : 'файлов'}</span></div>
      {mod.files.length === 0 ? <div className="rounded-2xl border border-dashed border-border bg-card p-9 text-center text-sm text-muted-foreground" data-testid="empty-mod-files">Для этого мода пока нет доступных файлов.</div> :
        <div className="space-y-3">{mod.files.map(file => <article key={file.id} className="rounded-2xl border border-border bg-card p-5 sm:p-6" data-testid={`file-card-${file.id}`}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary"><FileArchive size={18} /></span><div className="min-w-0"><h3 className="break-all text-sm font-bold">{file.fileName}</h3><p className="mt-1.5 text-xs text-muted-foreground">Добавлен {new Date(file.createdAt).toLocaleDateString('ru-RU')}</p><div className="mt-2 flex flex-wrap gap-1.5">{file.minecraftVersions.map(v => <span key={v} className="rounded-md border border-border px-2 py-1 font-mono text-[10px] font-semibold text-muted-foreground">{v}</span>)}</div></div></div>
            {localStorage.getItem('disclaimerAccepted') && file.downloadUrl ? <a href={file.downloadUrl} onClick={e => { e.preventDefault(); triggerDownload(file); }} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-xs font-bold text-primary-foreground transition hover:brightness-110" data-testid={`link-download-${file.id}`}><ArrowDownToLine size={15} /> Скачать</a> : <button onClick={() => triggerDownload(file)} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-xs font-bold text-primary-foreground transition hover:brightness-110" data-testid={`button-download-${file.id}`}><ArrowDownToLine size={15} /> Скачать</button>}
          </div><p className="mt-4 flex items-center gap-2 border-t border-border pt-3 text-[11px] leading-5 text-muted-foreground"><ShieldAlert size={14} className="shrink-0 text-[#a87936]" /> {FILE_WARNING}</p>
        </article>)}</div>}
    </section>
    {like.isError && <p className="mt-4 text-sm text-destructive" role="alert">Не удалось поставить отметку. Попробуйте снова.</p>}
    {(reportOpen || reportSuccess) && <div className="fixed inset-0 z-40 flex items-center justify-center bg-foreground/35 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true"><div className="w-full max-w-md rounded-[22px] border border-border bg-card p-6 shadow-2xl">
       <div className="flex items-start justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[.15em] text-primary">Обратная связь</p><h2 className="mt-1 font-[var(--app-font-serif)] text-2xl font-extrabold">Сообщить о проблеме</h2></div><button onClick={() => { setReportOpen(false); if (reportSuccess) { setReportSuccess(false); setLocation('/'); } }} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary" data-testid="button-close-report"><X size={17} /></button></div>
       {reportSuccess ? <div className="mt-6 rounded-xl bg-[#e7efe5] p-4 text-sm leading-6 text-[#315b43]" data-testid="status-report-success"><Check size={18} className="mb-2" />Спасибо. Мод скрыт на время ручной проверки; автор не блокируется.</div> : <form className="mt-5 space-y-4" onSubmit={e => { e.preventDefault(); report.mutate({ modId, data: { reason: reportReason, details: reportDetails || undefined } }, { onSuccess: () => { setReportSuccess(true); client.invalidateQueries({ queryKey: getListModsQueryKey() }); } }); }}>
        <label className="block text-xs font-bold">Причина<select value={reportReason} onChange={e => setReportReason(e.target.value as ReportInputReason)} className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-3 text-sm font-normal outline-none focus:ring-2 focus:ring-ring" data-testid="select-report-reason">{reasons.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}</select></label>
        <label className="block text-xs font-bold">Подробности <span className="font-normal text-muted-foreground">— необязательно</span><textarea value={reportDetails} onChange={e => setReportDetails(e.target.value)} maxLength={2000} rows={3} className="mt-2 w-full resize-y rounded-xl border border-input bg-background px-3 py-3 text-sm font-normal outline-none focus:ring-2 focus:ring-ring" placeholder="Добавьте пояснение" data-testid="input-report-details" /></label>
        {report.isError && <p className="text-sm text-destructive">Не удалось отправить сообщение. Попробуйте ещё раз.</p>}
        <button disabled={report.isPending} className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-60" data-testid="button-submit-report">{report.isPending ? 'Отправляем…' : 'Отправить на проверку'}</button>
      </form>}
       {reportSuccess && <button onClick={() => { setReportOpen(false); setReportSuccess(false); setLocation('/'); }} className="mt-4 w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground" data-testid="button-finish-report">Готово</button>}
    </div></div>}
    {disclaimer && <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-[3px]" role="dialog" aria-modal="true"><div className="w-full max-w-[440px] rounded-[24px] border border-border bg-card p-7 shadow-2xl"><button onClick={() => { setDisclaimer(false); setQueuedFile(null); }} className="float-right p-1 text-muted-foreground" aria-label="Закрыть"><X size={18} /></button><ShieldAlert size={24} className="mb-5 text-primary" /><h2 className="font-[var(--app-font-serif)] text-2xl font-extrabold">Перед загрузкой</h2><p className="mt-3 text-sm leading-7 text-muted-foreground">{DISCLAIMER}</p>{accept.isError && <p className="mt-3 text-sm text-destructive">Не удалось сохранить согласие. Попробуйте снова.</p>}<button onClick={acceptAndDownload} disabled={accept.isPending} className="mt-6 w-full rounded-xl bg-primary px-4 py-3.5 text-sm font-bold text-primary-foreground disabled:opacity-60">{accept.isPending ? 'Сохраняем…' : 'Продолжить'}</button><button onClick={() => { setDisclaimer(false); setQueuedFile(null); }} className="mt-3 w-full py-2 text-sm font-semibold text-muted-foreground">Пока не сейчас</button></div></div>}
  </main>;
}

function UploadPage() {
  const auth = useAuth();
  const [initialForm] = useState(readSavedUploadForm);
  const [title, setTitle] = useState(initialForm.title);
  const [description, setDescription] = useState(initialForm.description);
  const [selectedTags, setSelectedTags] = useState<string[]>(initialForm.selectedTags);
  const [draftId, setDraftId] = useState('');
  const [draftTitle, setDraftTitle] = useState('');
  const [versions, setVersions] = useState('');
  const [files, setFiles] = useState<SelectedModFile[]>([]);
  const [uploaded, setUploaded] = useState<string[]>([]);
  const [error, setError] = useState('');
  const tags = useListTags();
  const create = useCreateMod();
  const upload = useUploadModFile();
  const client = useQueryClient();
  useEffect(() => {
    try {
      if (draftId) {
        window.sessionStorage.removeItem(UPLOAD_FORM_STORAGE_KEY);
      } else {
        window.sessionStorage.setItem(
          UPLOAD_FORM_STORAGE_KEY,
          JSON.stringify({ title, description, selectedTags }),
        );
      }
    } catch {
      // The form remains controlled in memory when browser storage is unavailable.
    }
  }, [draftId, title, description, selectedTags]);
  if (!auth.isLoaded) return <main className="mx-auto max-w-3xl px-5 py-12"><div className="skeleton h-10 w-1/2 rounded" /><div className="skeleton mt-8 h-64 rounded-2xl" /></main>;
  if (!auth.isSignedIn) return <main className="page-enter mx-auto max-w-3xl px-5 py-20 text-center"><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-secondary text-primary"><Upload size={23} /></div><h1 className="mt-5 font-[var(--app-font-serif)] text-3xl font-extrabold tracking-tight">Публикация начинается с автора</h1><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">Войдите, чтобы создать страницу мода и загрузить файлы для разных версий Minecraft.</p><button onClick={() => window.dispatchEvent(new Event('tea-login'))} className="mt-6 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground" data-testid="button-login-to-upload">Войти и продолжить</button></main>;
  const toggleTag = (slug: string) => setSelectedTags(current => current.includes(slug) ? current.filter(t => t !== slug) : current.length < 5 ? [...current, slug] : current);
  const createDraft = (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    create.mutate({ data: { title: title.trim(), description: description.trim(), tags: selectedTags } }, { onSuccess: draft => { setDraftId(draft.id); setDraftTitle(draft.title); } , onError: error => setError(getApiErrorMessage(error, 'Не удалось создать черновик. Проверьте поля и попробуйте снова.')) });
  };
  const submitFiles = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    if (!files.length) { setError('Выберите хотя бы один файл .jar.'); return; }
    if (!versions.trim()) { setError('Укажите поддерживаемые версии Minecraft.'); return; }
    const filesToUpload = [...files];
    for (const selected of filesToUpload) {
      const name = selected.fileName.trim();
      if (!name || name.length > 240 || !name.toLowerCase().endsWith('.jar')) {
        setError('Укажите имя файла длиной до 240 символов и сохраните расширение .jar.');
        return;
      }
    }
    try {
      for (const selected of filesToUpload) {
        const fileName = selected.fileName.trim();
        const file = fileName === selected.file.name
          ? selected.file
          : new File([selected.file], fileName, {
              type: selected.file.type || 'application/java-archive',
              lastModified: selected.file.lastModified,
            });
        await new Promise<void>((resolve, reject) => upload.mutate({ modId: draftId, data: { file, minecraftVersions: versions.split(',').map(v => v.trim()).filter(Boolean).join(',') } }, {
          onSuccess: () => {
            setUploaded(prev => [...prev, fileName]);
            setFiles(prev => prev.filter(item => item.id !== selected.id));
            void client.invalidateQueries({ queryKey: getListModsQueryKey() });
            resolve();
          },
          onError: uploadError => reject(new Error(getApiErrorMessage(uploadError, 'Не удалось загрузить файл.'))),
        }));
      }
      setFiles([]); setVersions('');
      client.invalidateQueries({ queryKey: getListModsQueryKey() });
    } catch (uploadError) { setError(uploadError instanceof Error ? uploadError.message : 'Не удалось загрузить файл.'); }
  };
  return <main className="page-enter mx-auto max-w-3xl px-5 pb-10 pt-10 lg:px-8">
    <p className="text-[11px] font-bold uppercase tracking-[.16em] text-primary">Для авторов</p><h1 className="mt-2 font-[var(--app-font-serif)] text-[clamp(2rem,5vw,3.3rem)] font-extrabold leading-tight tracking-[-.06em]">Поделись своим модом</h1><p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">Расскажи, что меняет твой мод, выбери жанры и добавь файлы для поддерживаемых версий.</p>
    {!draftId ? <form onSubmit={createDraft} className="mt-8 space-y-5 rounded-[22px] border border-border bg-card p-6 sm:p-8">
      <label className="block text-sm font-bold">Название мода<input value={title} onChange={e => setTitle(e.target.value)} required minLength={3} maxLength={100} className="mt-2 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm font-normal outline-none focus:ring-2 focus:ring-ring" placeholder="Например, Тихие деревни" data-testid="input-mod-title" /></label>
      <label className="block text-sm font-bold">Описание<textarea value={description} onChange={e => setDescription(e.target.value)} required minLength={20} maxLength={5000} rows={6} className="mt-2 w-full resize-y rounded-xl border border-input bg-background px-4 py-3 text-sm font-normal leading-6 outline-none focus:ring-2 focus:ring-ring" placeholder="Что добавляет мод? Как он работает? Для каких сборок подходит?" data-testid="input-mod-description" /><span className="mt-1 block text-right text-[11px] font-normal text-muted-foreground">{description.length}/5000</span></label>
      <fieldset><legend className="text-sm font-bold">Жанры <span className="font-normal text-muted-foreground">— выберите от 1 до 5</span></legend><div className="mt-3 flex flex-wrap gap-2">{tags.isLoading ? <span className="skeleton h-8 w-24 rounded-full" /> : tags.data?.map(t => <button type="button" key={t.id} onClick={() => toggleTag(t.slug)} className={`rounded-full border px-3.5 py-2 text-xs font-bold transition ${selectedTags.includes(t.slug) ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-muted-foreground hover:border-primary/40'}`} data-testid={`button-select-tag-${t.slug}`}>{t.name}</button>)}</div></fieldset>
      {error && <p className="text-sm text-destructive" data-testid="status-upload-error">{error}</p>}
      <button disabled={create.isPending || selectedTags.length < 1} className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50" data-testid="button-create-mod">{create.isPending ? 'Создаём…' : 'Продолжить к файлам'} <ChevronRight size={16} /></button>
    </form> : <section className="mt-8 rounded-[22px] border border-border bg-card p-6 sm:p-8">
      <div className="flex items-start gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e5eee3] text-primary"><Check size={19} /></span><div><p className="text-[11px] font-bold uppercase tracking-[.14em] text-primary">Черновик создан</p><h2 className="mt-1 font-[var(--app-font-serif)] text-xl font-extrabold">{draftTitle}</h2></div></div>
      <p className="mt-5 text-sm leading-6 text-muted-foreground">Добавьте один или несколько .jar файлов. Для каждого файла будут сохранены указанные версии Minecraft. Публикация появится после проверки файла.</p>
      <form onSubmit={submitFiles} className="mt-6 space-y-5">
        <label className="block text-sm font-bold">Поддерживаемые версии<input value={versions} onChange={e => setVersions(e.target.value)} required className="mt-2 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm font-normal outline-none focus:ring-2 focus:ring-ring" placeholder="1.20.1, 1.20.4, 1.21" data-testid="input-minecraft-versions" /><span className="mt-1 block text-xs font-normal text-muted-foreground">Перечислите через запятую. Одинаковые версии применяются к выбранным файлам.</span></label>
        <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-primary/30 bg-secondary/40 p-5 text-center transition hover:bg-secondary/70"><Upload size={20} className="text-primary" /><span className="mt-2 text-sm font-bold">Выберите файлы .jar</span><span className="mt-1 text-xs text-muted-foreground">Можно выбрать несколько файлов</span><input type="file" accept=".jar,application/java-archive" multiple disabled={upload.isPending} onChange={e => { const selected = Array.from(e.currentTarget.files || []); setFiles(current => [...current, ...selected.map(file => ({ id: crypto.randomUUID(), file, fileName: file.name }))]); e.currentTarget.value = ''; }} className="sr-only" data-testid="input-mod-files" /></label>
        {!!files.length && <div className="space-y-2" aria-label="Выбранные файлы">{files.map((selected, i) => <div key={selected.id} className="flex items-center gap-2 rounded-xl border border-border bg-secondary/60 p-3" data-testid={`selected-file-${i}`}>
          <FileArchive size={16} className="shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <label className="sr-only" htmlFor={`selected-file-name-${selected.id}`}>Имя файла {i + 1}</label>
            <input id={`selected-file-name-${selected.id}`} value={selected.fileName} onChange={e => setFiles(current => current.map(item => item.id === selected.id ? { ...item, fileName: e.target.value } : item))} disabled={upload.isPending} maxLength={240} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-ring disabled:opacity-60" data-testid={`input-selected-file-name-${i}`} />
            <p className="mt-1 px-1 text-[11px] text-muted-foreground">{(selected.file.size / 1024 / 1024).toFixed(1)} МБ · имя можно изменить перед загрузкой</p>
          </div>
          <button type="button" onClick={() => setFiles(current => current.filter(item => item.id !== selected.id))} disabled={upload.isPending} aria-label={`Убрать файл ${selected.fileName || i + 1}`} title="Убрать файл" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive disabled:opacity-50" data-testid={`button-remove-selected-file-${i}`}><X size={16} /></button>
        </div>)}</div>}
        {!!uploaded.length && <div className="rounded-xl bg-[#e7efe5] p-4 text-sm text-[#315b43]" data-testid="status-files-uploaded"><p className="font-bold">Файлы отправлены на проверку</p>{uploaded.map((name, i) => <p key={`${name}-${i}`} className="mt-1 text-xs">{name}</p>)}</div>}
        {error && <p className="text-sm text-destructive" data-testid="status-upload-error">{error}</p>}
        <button disabled={upload.isPending || !files.length} className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50" data-testid="button-upload-files">{upload.isPending ? 'Загружаем…' : 'Загрузить выбранные файлы'} <ArrowUpRight size={15} /></button>
      </form>
    </section>}
  </main>;
}

function NotFound() { return <main className="mx-auto max-w-2xl px-5 py-24 text-center"><p className="font-mono text-xs font-bold tracking-[.2em] text-primary">404</p><h1 className="mt-3 font-[var(--app-font-serif)] text-4xl font-extrabold tracking-tight">Эта страница потерялась</h1><p className="mt-3 text-sm text-muted-foreground">Вернись в каталог и найди что-нибудь интересное.</p><Link href="/" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground"><ArrowLeft size={16} /> В каталог</Link></main>; }

function Router() {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}><Shell><Switch><Route path="/" component={Home} /><Route path="/mods/:modId" component={ModPage} /><Route path="/upload" component={UploadPage} /><Route component={NotFound} /></Switch></Shell></ErrorBoundary>;
}

function SignInPage() {
  const [redirectUrl] = useLocalState(() =>
    sessionStorage.getItem('tea-auth-redirect') || basePath || '/',
  );
  return <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
    <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} forceRedirectUrl={redirectUrl} />
  </div>;
}

function SignUpPage() {
  const [redirectUrl] = useLocalState(() => {
    const savedUrl = sessionStorage.getItem('tea-auth-redirect');
    sessionStorage.removeItem('tea-auth-redirect');
    return savedUrl || basePath || '/';
  });
  return <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
    <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} forceRedirectUrl={redirectUrl} />
  </div>;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        queryClient.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);

  return null;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return <ClerkProvider
    publishableKey={clerkPubKey}
    proxyUrl={clerkProxyUrl}
    appearance={clerkAppearance}
    signInUrl={`${basePath}/sign-in`}
    signUpUrl={`${basePath}/sign-up`}
    localization={{
      signIn: { start: { title: 'С возвращением', subtitle: 'Войдите, чтобы продолжить' } },
      signUp: { start: { title: 'Создать аккаунт', subtitle: 'Присоединяйтесь к TeaMods' } },
    }}
    routerPush={(to) => setLocation(stripBase(to))}
    routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
  >
    <QueryClientProvider client={queryClient}>
      <ClerkQueryClientCacheInvalidator />
      <Switch>
        <Route path="/" component={Router} />
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/sign-up/*?" component={SignUpPage} />
        <Route component={Router} />
      </Switch>
      <Toaster />
    </QueryClientProvider>
  </ClerkProvider>;
}

function App() {
  return <TooltipProvider><WouterRouter base={basePath}><ClerkProviderWithRoutes /></WouterRouter></TooltipProvider>;
}

export default App;
