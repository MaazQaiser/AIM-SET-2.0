import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const res = await fetch(
    `${process.env.API_URL ?? "http://localhost:8000"}/api/v1/kb/assets`,
    {
      headers: { "x-user-id": userId },
      next: { revalidate: 120, tags: ["kb"] },
    }
  );

  if (!res.ok) return new NextResponse("Upstream error", { status: res.status });
  const data = await res.json();
  return NextResponse.json(data);
}
