import { NextResponse } from "next/server";

import { generateFreeModeRound } from "@/lib/free-mode/server";

const parseExcludedIds = (request: Request) => {
  const value = new URL(request.url).searchParams.get("exclude");
  if (!value) return [];

  return value
    .split(",")
    .map(Number)
    .filter((id) => Number.isInteger(id) && id > 0 && id <= 1025)
    .slice(-50);
};

export const GET = async (request: Request) => {
  try {
    const round = await generateFreeModeRound(parseExcludedIds(request));
    return NextResponse.json(round, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "Could not create a Free Mode round." },
      { status: 500 },
    );
  }
};