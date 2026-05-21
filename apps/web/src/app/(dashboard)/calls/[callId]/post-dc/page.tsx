"use client";

import { use } from "react";
import { useSearchParams } from "next/navigation";
import { PostDcReviewScreen } from "@/components/post-dc/post-dc-review-screen";

interface PostDcPageParams {
  params: Promise<{ callId: string }>;
}

export default function PostDcReviewPage({ params }: PostDcPageParams) {
  const { callId } = use(params);
  const searchParams = useSearchParams();
  const justWrapped = searchParams.get("wrapped") === "1";

  return <PostDcReviewScreen callId={callId} justWrapped={justWrapped} />;
}
