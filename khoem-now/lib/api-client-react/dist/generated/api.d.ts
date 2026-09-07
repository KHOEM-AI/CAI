import type { QueryKey, UseMutationOptions, UseMutationResult, UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import type { AuthSession, DashboardSummary, HealthStatus, ListScansParams, LoginInput, Scan, ScanInput, User } from './api.schemas';
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
    query?: UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData> & {
    queryKey: QueryKey;
};
export type HealthCheckQueryResult = NonNullable<Awaited<ReturnType<typeof healthCheck>>>;
export type HealthCheckQueryError = ErrorType<unknown>;
/**
 * @summary Health check
 */
export declare function useHealthCheck<TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getLoginUrl: () => string;
/**
 * @summary Sign in to CAI Pro Vision
 */
export declare const login: (loginInput: LoginInput, options?: Parameters<typeof customFetch>[1]) => Promise<AuthSession>;
export declare const getLoginMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof login>>, TError, {
        data: BodyType<LoginInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof login>>, TError, {
    data: BodyType<LoginInput>;
}, TContext>;
export type LoginMutationResult = NonNullable<Awaited<ReturnType<typeof login>>>;
export type LoginMutationBody = BodyType<LoginInput>;
export type LoginMutationError = ErrorType<void>;
/**
* @summary Sign in to CAI Pro Vision
*/
export declare const useLogin: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof login>>, TError, {
        data: BodyType<LoginInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof login>>, TError, {
    data: BodyType<LoginInput>;
}, TContext>;
export declare const getGetCurrentUserUrl: () => string;
/**
 * @summary Get the current signed-in user
 */
export declare const getCurrentUser: (options?: Parameters<typeof customFetch>[1]) => Promise<User>;
export declare const getGetCurrentUserQueryKey: () => readonly ["/api/auth/me"];
export declare const getGetCurrentUserQueryOptions: <TData = Awaited<ReturnType<typeof getCurrentUser>>, TError = ErrorType<void>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getCurrentUser>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getCurrentUser>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetCurrentUserQueryResult = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;
export type GetCurrentUserQueryError = ErrorType<void>;
/**
 * @summary Get the current signed-in user
 */
export declare function useGetCurrentUser<TData = Awaited<ReturnType<typeof getCurrentUser>>, TError = ErrorType<void>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getCurrentUser>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getListScansUrl: (params?: ListScansParams) => string;
/**
 * @summary List scan records visible to the current user
 */
export declare const listScans: (params?: ListScansParams, options?: Parameters<typeof customFetch>[1]) => Promise<Scan[]>;
export declare const getListScansQueryKey: (params?: ListScansParams) => readonly ["/api/scans", ...ListScansParams[]];
export declare const getListScansQueryOptions: <TData = Awaited<ReturnType<typeof listScans>>, TError = ErrorType<void>>(params?: ListScansParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listScans>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listScans>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListScansQueryResult = NonNullable<Awaited<ReturnType<typeof listScans>>>;
export type ListScansQueryError = ErrorType<void>;
/**
 * @summary List scan records visible to the current user
 */
export declare function useListScans<TData = Awaited<ReturnType<typeof listScans>>, TError = ErrorType<void>>(params?: ListScansParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listScans>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getCreateScanUrl: () => string;
/**
 * @summary Save a signed scan record
 */
export declare const createScan: (scanInput: ScanInput, options?: Parameters<typeof customFetch>[1]) => Promise<Scan>;
export declare const getCreateScanMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createScan>>, TError, {
        data: BodyType<ScanInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createScan>>, TError, {
    data: BodyType<ScanInput>;
}, TContext>;
export type CreateScanMutationResult = NonNullable<Awaited<ReturnType<typeof createScan>>>;
export type CreateScanMutationBody = BodyType<ScanInput>;
export type CreateScanMutationError = ErrorType<void>;
/**
* @summary Save a signed scan record
*/
export declare const useCreateScan: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createScan>>, TError, {
        data: BodyType<ScanInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createScan>>, TError, {
    data: BodyType<ScanInput>;
}, TContext>;
export declare const getGetDashboardSummaryUrl: () => string;
/**
 * @summary Get scan dashboard summary
 */
export declare const getDashboardSummary: (options?: Parameters<typeof customFetch>[1]) => Promise<DashboardSummary>;
export declare const getGetDashboardSummaryQueryKey: () => readonly ["/api/dashboard/summary"];
export declare const getGetDashboardSummaryQueryOptions: <TData = Awaited<ReturnType<typeof getDashboardSummary>>, TError = ErrorType<void>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getDashboardSummary>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getDashboardSummary>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetDashboardSummaryQueryResult = NonNullable<Awaited<ReturnType<typeof getDashboardSummary>>>;
export type GetDashboardSummaryQueryError = ErrorType<void>;
/**
 * @summary Get scan dashboard summary
 */
export declare function useGetDashboardSummary<TData = Awaited<ReturnType<typeof getDashboardSummary>>, TError = ErrorType<void>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getDashboardSummary>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export {};
//# sourceMappingURL=api.d.ts.map
