import {
  getGetModQueryKey,
  getListModsQueryKey,
  useGetAdminStatus,
  useVerifyMod,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { BadgeCheck } from "lucide-react";

export function ModAdminTools({
  modId,
  verified,
}: {
  modId: string;
  verified: boolean;
}) {
  const queryClient = useQueryClient();
  const adminStatus = useGetAdminStatus({
    query: {
      staleTime: 0,
      refetchOnMount: "always",
      refetchOnWindowFocus: true,
    },
  });
  const verify = useVerifyMod({
    mutation: {
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: getGetModQueryKey(modId),
          }),
          queryClient.invalidateQueries({ queryKey: getListModsQueryKey() }),
        ]);
      },
    },
  });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {verified && (
        <span
          className="inline-flex items-center gap-1.5 rounded-full border border-[#a8c9ae] bg-[#e7efe5] px-3 py-1.5 text-xs font-bold text-[#315b43]"
          data-testid="badge-mod-verified"
        >
          <BadgeCheck size={15} /> Проверено
        </span>
      )}
      {adminStatus.data?.isAdmin && !verified && (
        <button
          type="button"
          disabled={verify.isPending}
          onClick={() => verify.mutate({ modId })}
          className="inline-flex items-center gap-2 rounded-xl border border-primary/25 bg-secondary px-3.5 py-2.5 text-xs font-bold text-foreground transition hover:border-primary/50 hover:bg-secondary/80 disabled:opacity-60"
          data-testid="button-verify-mod"
        >
          <BadgeCheck size={15} />
          {verify.isPending ? "Отмечаем…" : "Отметить как проверенное"}
        </button>
      )}
      {verify.isError && (
        <p className="basis-full text-xs text-destructive" role="alert">
          Не удалось отметить мод. Обновите страницу и попробуйте ещё раз.
        </p>
      )}
    </div>
  );
}
