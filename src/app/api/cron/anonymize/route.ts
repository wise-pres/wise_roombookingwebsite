import { NextResponse } from "next/server";

import { anonymizeExpiredRequesterNames } from "@/lib/server/repository";

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json({ anonymized: await anonymizeExpiredRequesterNames() });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Anonymization failed." }, { status: 500 });
  }
}
