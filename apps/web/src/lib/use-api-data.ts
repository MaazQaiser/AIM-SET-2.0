/** When true, TanStack Query fetches via BFF → FastAPI instead of client resolvers only. */
export function useApiData(): boolean {
  return process.env.NEXT_PUBLIC_USE_API_DATA === "true";
}
