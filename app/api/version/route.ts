import { NextResponse } from "next/server";

const FALLBACK_COMMIT_SHA = "c4b755c4e14e803e1afa6db9aa0d02678c81a5b8";

export function GET() {
  return new NextResponse(
    process.env.VERCEL_GIT_COMMIT_SHA ?? FALLBACK_COMMIT_SHA,
    {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    },
  );
}
