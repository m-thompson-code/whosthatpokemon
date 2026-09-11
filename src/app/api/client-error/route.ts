import { NextResponse } from "next/server";
import { z } from "zod";

const clientErrorSchema = z.object({
  scope: z.string().max(100),
  code: z.string().max(200),
  message: z.string().max(2000),
});

export const POST = async (request: Request) => {
  const result = clientErrorSchema.safeParse(await request.json());
  if (!result.success) {
    return NextResponse.json({ error: "Invalid error report" }, { status: 400 });
  }

  console.error(`[client:${result.data.scope}] ${result.data.code}: ${result.data.message}`);
  return new NextResponse(null, { status: 204 });
};