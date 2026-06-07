/** Client-side fetch against Next.js BFF routes (no mock fallback). */
export async function bffFetch<T>(path: string, init?: RequestInit): Promise<T | null> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(path, {
      cache: "no-store",
      ...init,
      signal: init?.signal ?? controller.signal,
    });
    if (!res.ok) return null;
    return res.json() as Promise<T>;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeout);
  }
}
