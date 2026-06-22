import { NextResponse } from "next/server";

import { adminCookie, createAdminSession, verifyPasscode } from "@/lib/server/admin-auth";

export async function POST(request: Request) {
  const body = (await request.json()) as { passcode?: string };
  if (!body.passcode || !verifyPasscode(body.passcode)) {
    return NextResponse.json({ error: "Incorrect passcode." }, { status: 401 });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(adminCookie.name, createAdminSession(), adminCookie.options);
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(adminCookie.name, "", { ...adminCookie.options, maxAge: 0 });
  return response;
}
