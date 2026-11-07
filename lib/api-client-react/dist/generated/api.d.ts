import type { DataTag, DefinedInitialDataOptions, DefinedUseQueryResult, QueryClient, QueryKey, UndefinedInitialDataOptions, UseMutationOptions, UseMutationResult, UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import type { AdminStatus, CreateModInput, DisclaimerAccepted, HealthStatus, LikeResult, ListModsParams, ModDetail, ModDraft, ModFile, ModFileUploadInput, ModList, ModVerification, ReportInput, ReportResult, Tag } from './api.schemas';
import { customFetch } from '../custom-fetch';
import type { ErrorType, BodyType } from '../custom-fetch';
type AwaitedInput<T> = PromiseLike<T> | T;
type Awaited<O> = O extends AwaitedInput<infer T> ? T : never;
type SecondParameter<T extends (...args: never) => unknown> = Parameters<T>[1];
export declare const getHealthCheckUrl: () => string;
/**
 * Returns server health status
 * @summary Health check
 */
export declare const healthCheck: (options?: Parameters<typeof customFetch>[1]) => Promise<HealthStatus>;
export declare const getHealthCheckQueryKey: () => readonly ["/api/healthz"];
export declare const getHealthCheckQueryOptions: <TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export type HealthCheckQueryResult = NonNullable<Awaited<ReturnType<typeof healthCheck>>>;
export type HealthCheckQueryError = ErrorType<unknown>;
export declare function useHealthCheck<TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options: {
    query: Partial<UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>> & Pick<DefinedInitialDataOptions<Awaited<ReturnType<typeof healthCheck>>, TError, Awaited<ReturnType<typeof healthCheck>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): DefinedUseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useHealthCheck<TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>> & Pick<UndefinedInitialDataOptions<Awaited<ReturnType<typeof healthCheck>>, TError, Awaited<ReturnType<typeof healthCheck>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useHealthCheck<TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare const getGetAdminStatusUrl: () => string;
/**
 * @summary Get the current user's admin status
 */
export declare const getAdminStatus: (options?: Parameters<typeof customFetch>[1]) => Promise<AdminStatus>;
export declare const getGetAdminStatusQueryKey: () => readonly ["/api/admin/status"];
export declare const getGetAdminStatusQueryOptions: <TData = Awaited<ReturnType<typeof getAdminStatus>>, TError = ErrorType<unknown>>(options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getAdminStatus>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getAdminStatus>>, TError, TData> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export type GetAdminStatusQueryResult = NonNullable<Awaited<ReturnType<typeof getAdminStatus>>>;
export type GetAdminStatusQueryError = ErrorType<unknown>;
export declare function useGetAdminStatus<TData = Awaited<ReturnType<typeof getAdminStatus>>, TError = ErrorType<unknown>>(options: {
    query: Partial<UseQueryOptions<Awaited<ReturnType<typeof getAdminStatus>>, TError, TData>> & Pick<DefinedInitialDataOptions<Awaited<ReturnType<typeof getAdminStatus>>, TError, Awaited<ReturnType<typeof getAdminStatus>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): DefinedUseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useGetAdminStatus<TData = Awaited<ReturnType<typeof getAdminStatus>>, TError = ErrorType<unknown>>(options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getAdminStatus>>, TError, TData>> & Pick<UndefinedInitialDataOptions<Awaited<ReturnType<typeof getAdminStatus>>, TError, Awaited<ReturnType<typeof getAdminStatus>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useGetAdminStatus<TData = Awaited<ReturnType<typeof getAdminStatus>>, TError = ErrorType<unknown>>(options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getAdminStatus>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare const getListModsUrl: (params?: ListModsParams) => string;
/**
 * @summary List published mods
 */
export declare const listMods: (params?: ListModsParams, options?: Parameters<typeof customFetch>[1]) => Promise<ModList>;
export declare const getListModsQueryKey: (params?: ListModsParams) => readonly ["/api/mods", ...ListModsParams[]];
export declare const getListModsQueryOptions: <TData = Awaited<ReturnType<typeof listMods>>, TError = ErrorType<unknown>>(params?: ListModsParams, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof listMods>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listMods>>, TError, TData> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export type ListModsQueryResult = NonNullable<Awaited<ReturnType<typeof listMods>>>;
export type ListModsQueryError = ErrorType<unknown>;
export declare function useListMods<TData = Awaited<ReturnType<typeof listMods>>, TError = ErrorType<unknown>>(params: undefined | ListModsParams, options: {
    query: Partial<UseQueryOptions<Awaited<ReturnType<typeof listMods>>, TError, TData>> & Pick<DefinedInitialDataOptions<Awaited<ReturnType<typeof listMods>>, TError, Awaited<ReturnType<typeof listMods>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): DefinedUseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useListMods<TData = Awaited<ReturnType<typeof listMods>>, TError = ErrorType<unknown>>(params?: ListModsParams, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof listMods>>, TError, TData>> & Pick<UndefinedInitialDataOptions<Awaited<ReturnType<typeof listMods>>, TError, Awaited<ReturnType<typeof listMods>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useListMods<TData = Awaited<ReturnType<typeof listMods>>, TError = ErrorType<unknown>>(params?: ListModsParams, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof listMods>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare const getCreateModUrl: () => string;
/**
 * Requires a signed-in user. A mod is listed after a clean file is uploaded.
 * @summary Create a mod draft
 */
export declare const createMod: (createModInput: CreateModInput, options?: Parameters<typeof customFetch>[1]) => Promise<ModDraft>;
export declare const getCreateModMutationKey: () => readonly ["createMod"];
export declare const getCreateModMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createMod>>, TError, CreateModMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createMod>>, TError, CreateModMutationVariables, TContext>;
export type CreateModMutationResult = NonNullable<Awaited<ReturnType<typeof createMod>>>;
export type CreateModMutationBody = BodyType<CreateModInput>;
export type CreateModMutationError = ErrorType<void>;
export type CreateModMutationVariables = {
    data: BodyType<CreateModInput>;
};
/**
* @summary Create a mod draft
*/
export declare const useCreateMod: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createMod>>, TError, CreateModMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient) => UseMutationResult<Awaited<ReturnType<typeof createMod>>, TError, CreateModMutationVariables, TContext>;
export declare const getGetModUrl: (modId: string) => string;
/**
 * @summary Get a published mod
 */
export declare const getMod: (modId: string, options?: Parameters<typeof customFetch>[1]) => Promise<ModDetail>;
export declare const getGetModQueryKey: (modId: string) => readonly [`/api/mods/${string}`];
export declare const getGetModQueryOptions: <TData = Awaited<ReturnType<typeof getMod>>, TError = ErrorType<void>>(modId: string, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getMod>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getMod>>, TError, TData> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export type GetModQueryResult = NonNullable<Awaited<ReturnType<typeof getMod>>>;
export type GetModQueryError = ErrorType<void>;
export declare function useGetMod<TData = Awaited<ReturnType<typeof getMod>>, TError = ErrorType<void>>(modId: string, options: {
    query: Partial<UseQueryOptions<Awaited<ReturnType<typeof getMod>>, TError, TData>> & Pick<DefinedInitialDataOptions<Awaited<ReturnType<typeof getMod>>, TError, Awaited<ReturnType<typeof getMod>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): DefinedUseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useGetMod<TData = Awaited<ReturnType<typeof getMod>>, TError = ErrorType<void>>(modId: string, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getMod>>, TError, TData>> & Pick<UndefinedInitialDataOptions<Awaited<ReturnType<typeof getMod>>, TError, Awaited<ReturnType<typeof getMod>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useGetMod<TData = Awaited<ReturnType<typeof getMod>>, TError = ErrorType<void>>(modId: string, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getMod>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare const getVerifyModUrl: (modId: string) => string;
/**
 * Requires an administrator account. This operation is idempotent.
 * @summary Mark a mod as verified
 */
export declare const verifyMod: (modId: string, options?: Parameters<typeof customFetch>[1]) => Promise<ModVerification>;
export declare const getVerifyModMutationKey: () => readonly ["verifyMod"];
export declare const getVerifyModMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof verifyMod>>, TError, VerifyModMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof verifyMod>>, TError, VerifyModMutationVariables, TContext>;
export type VerifyModMutationResult = NonNullable<Awaited<ReturnType<typeof verifyMod>>>;
export type VerifyModMutationError = ErrorType<void>;
export type VerifyModMutationVariables = {
    modId: string;
};
/**
* @summary Mark a mod as verified
*/
export declare const useVerifyMod: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof verifyMod>>, TError, VerifyModMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient) => UseMutationResult<Awaited<ReturnType<typeof verifyMod>>, TError, VerifyModMutationVariables, TContext>;
export declare const getUploadModFileUrl: (modId: string) => string;
/**
 * Requires a signed-in author. Accepts one .jar file and supported Minecraft versions. Files are not published unless the scan is clean.
 * @summary Upload and scan a mod file
 */
export declare const uploadModFile: (modId: string, modFileUploadInput: ModFileUploadInput, options?: Parameters<typeof customFetch>[1]) => Promise<ModFile>;
export declare const getUploadModFileMutationKey: () => readonly ["uploadModFile"];
export declare const getUploadModFileMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof uploadModFile>>, TError, UploadModFileMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof uploadModFile>>, TError, UploadModFileMutationVariables, TContext>;
export type UploadModFileMutationResult = NonNullable<Awaited<ReturnType<typeof uploadModFile>>>;
export type UploadModFileMutationBody = BodyType<ModFileUploadInput>;
export type UploadModFileMutationError = ErrorType<void>;
export type UploadModFileMutationVariables = {
    modId: string;
    data: BodyType<ModFileUploadInput>;
};
/**
* @summary Upload and scan a mod file
*/
export declare const useUploadModFile: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof uploadModFile>>, TError, UploadModFileMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient) => UseMutationResult<Awaited<ReturnType<typeof uploadModFile>>, TError, UploadModFileMutationVariables, TContext>;
export declare const getDownloadModFileUrl: (modId: string, fileId: string) => string;
/**
 * Requires the disclaimer consent cookie and redirects to the verified Google Drive link.
 * @summary Download an available mod file
 */
export declare const downloadModFile: (modId: string, fileId: string, options?: Parameters<typeof customFetch>[1]) => Promise<unknown>;
export declare const getDownloadModFileQueryKey: (modId: string, fileId: string) => readonly [`/api/mods/${string}/files/${string}/download`];
export declare const getDownloadModFileQueryOptions: <TData = Awaited<ReturnType<typeof downloadModFile>>, TError = ErrorType<void>>(modId: string, fileId: string, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof downloadModFile>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof downloadModFile>>, TError, TData> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export type DownloadModFileQueryResult = NonNullable<Awaited<ReturnType<typeof downloadModFile>>>;
export type DownloadModFileQueryError = ErrorType<void>;
export declare function useDownloadModFile<TData = Awaited<ReturnType<typeof downloadModFile>>, TError = ErrorType<void>>(modId: string, fileId: string, options: {
    query: Partial<UseQueryOptions<Awaited<ReturnType<typeof downloadModFile>>, TError, TData>> & Pick<DefinedInitialDataOptions<Awaited<ReturnType<typeof downloadModFile>>, TError, Awaited<ReturnType<typeof downloadModFile>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): DefinedUseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useDownloadModFile<TData = Awaited<ReturnType<typeof downloadModFile>>, TError = ErrorType<void>>(modId: string, fileId: string, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof downloadModFile>>, TError, TData>> & Pick<UndefinedInitialDataOptions<Awaited<ReturnType<typeof downloadModFile>>, TError, Awaited<ReturnType<typeof downloadModFile>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useDownloadModFile<TData = Awaited<ReturnType<typeof downloadModFile>>, TError = ErrorType<void>>(modId: string, fileId: string, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof downloadModFile>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare const getToggleModLikeUrl: (modId: string) => string;
/**
 * Requires a signed-in user.
 * @summary Toggle the current user's like
 */
export declare const toggleModLike: (modId: string, options?: Parameters<typeof customFetch>[1]) => Promise<LikeResult>;
export declare const getToggleModLikeMutationKey: () => readonly ["toggleModLike"];
export declare const getToggleModLikeMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof toggleModLike>>, TError, ToggleModLikeMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof toggleModLike>>, TError, ToggleModLikeMutationVariables, TContext>;
export type ToggleModLikeMutationResult = NonNullable<Awaited<ReturnType<typeof toggleModLike>>>;
export type ToggleModLikeMutationError = ErrorType<void>;
export type ToggleModLikeMutationVariables = {
    modId: string;
};
/**
* @summary Toggle the current user's like
*/
export declare const useToggleModLike: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof toggleModLike>>, TError, ToggleModLikeMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient) => UseMutationResult<Awaited<ReturnType<typeof toggleModLike>>, TError, ToggleModLikeMutationVariables, TContext>;
export declare const getReportModUrl: (modId: string) => string;
/**
 * Requires a signed-in user. The report hides the mod pending manual review and does not ban its author.
 * @summary Report a mod for review
 */
export declare const reportMod: (modId: string, reportInput: ReportInput, options?: Parameters<typeof customFetch>[1]) => Promise<ReportResult>;
export declare const getReportModMutationKey: () => readonly ["reportMod"];
export declare const getReportModMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof reportMod>>, TError, ReportModMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof reportMod>>, TError, ReportModMutationVariables, TContext>;
export type ReportModMutationResult = NonNullable<Awaited<ReturnType<typeof reportMod>>>;
export type ReportModMutationBody = BodyType<ReportInput>;
export type ReportModMutationError = ErrorType<void>;
export type ReportModMutationVariables = {
    modId: string;
    data: BodyType<ReportInput>;
};
/**
* @summary Report a mod for review
*/
export declare const useReportMod: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof reportMod>>, TError, ReportModMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient) => UseMutationResult<Awaited<ReturnType<typeof reportMod>>, TError, ReportModMutationVariables, TContext>;
export declare const getListTagsUrl: () => string;
/**
 * @summary List catalog genres
 */
export declare const listTags: (options?: Parameters<typeof customFetch>[1]) => Promise<Tag[]>;
export declare const getListTagsQueryKey: () => readonly ["/api/tags"];
export declare const getListTagsQueryOptions: <TData = Awaited<ReturnType<typeof listTags>>, TError = ErrorType<unknown>>(options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof listTags>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listTags>>, TError, TData> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export type ListTagsQueryResult = NonNullable<Awaited<ReturnType<typeof listTags>>>;
export type ListTagsQueryError = ErrorType<unknown>;
export declare function useListTags<TData = Awaited<ReturnType<typeof listTags>>, TError = ErrorType<unknown>>(options: {
    query: Partial<UseQueryOptions<Awaited<ReturnType<typeof listTags>>, TError, TData>> & Pick<DefinedInitialDataOptions<Awaited<ReturnType<typeof listTags>>, TError, Awaited<ReturnType<typeof listTags>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): DefinedUseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useListTags<TData = Awaited<ReturnType<typeof listTags>>, TError = ErrorType<unknown>>(options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof listTags>>, TError, TData>> & Pick<UndefinedInitialDataOptions<Awaited<ReturnType<typeof listTags>>, TError, Awaited<ReturnType<typeof listTags>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useListTags<TData = Awaited<ReturnType<typeof listTags>>, TError = ErrorType<unknown>>(options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof listTags>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare const getAcceptDisclaimerUrl: () => string;
/**
 * Sets the signed consent cookie required for sign-in and downloads.
 * @summary Record disclaimer acceptance
 */
export declare const acceptDisclaimer: (options?: Parameters<typeof customFetch>[1]) => Promise<DisclaimerAccepted>;
export declare const getAcceptDisclaimerMutationKey: () => readonly ["acceptDisclaimer"];
export declare const getAcceptDisclaimerMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof acceptDisclaimer>>, TError, void, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof acceptDisclaimer>>, TError, void, TContext>;
export type AcceptDisclaimerMutationResult = NonNullable<Awaited<ReturnType<typeof acceptDisclaimer>>>;
export type AcceptDisclaimerMutationError = ErrorType<unknown>;
/**
* @summary Record disclaimer acceptance
*/
export declare const useAcceptDisclaimer: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof acceptDisclaimer>>, TError, void, TContext>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient) => UseMutationResult<Awaited<ReturnType<typeof acceptDisclaimer>>, TError, void, TContext>;
export {};
//# sourceMappingURL=api.d.ts.map