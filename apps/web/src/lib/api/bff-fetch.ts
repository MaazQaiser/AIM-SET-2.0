/** Client-side fetch against Next.js BFF routes (no mock fallback). */
export async function bffFetch<T>(path: string, init?: RequestInit): Promise<T | null> {
  const res = await fetch(path, { cache: "no-store", ...init });
  if (!res.ok) return null;
  return res.json() as Promise<T>;
}
