"use client";

import { Suspense } from "react";
import { ContentHub } from "@/components/content/content-hub";

export default function ContentPage() {
  return (
    <Suspense fallback={<p className="p-6 type-body text-muted-foreground">Loading content…</p>}>
      <ContentHub />
    </Suspense>
  );
}
