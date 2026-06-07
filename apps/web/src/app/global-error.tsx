"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-svh bg-neutral-950 text-neutral-100 flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <h1 className="type-section-title">DC Copilot failed to load</h1>
          <p className="type-body text-neutral-400">
            {error.message || "An unexpected error occurred."}
          </p>
          <p className="type-label text-neutral-500">
            On Vercel: confirm deploy commit is{" "}
            <code className="text-neutral-300">8a6bfb6</code> or newer, set Clerk keys
            (publishable + secret), add your Vercel URL under Clerk → Domains, and set{" "}
            <code className="text-neutral-300">API_URL</code> /{" "}
            <code className="text-neutral-300">INTERNAL_API_SECRET</code>.
          </p>
          <div className="flex gap-3 justify-center pt-2">
            <button
              type="button"
              onClick={() => reset()}
              className="rounded-md bg-white px-4 py-2 type-body font-medium text-neutral-900"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => window.history.back()}
              className="rounded-md border border-neutral-600 px-4 py-2 type-body font-medium"
            >
              Back
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
