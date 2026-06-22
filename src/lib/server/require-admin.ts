import { cookies } from "next/headers";

import { adminCookie, isAdminSession } from "@/lib/server/admin-auth";

export async function hasAdminAccess(): Promise<boolean> {
  const cookieStore = await cookies();
  return isAdminSession(cookieStore.get(adminCookie.name)?.value);
}

export async function requireAdminResponse(): Promise<Response | null> {
  return (await hasAdminAccess()) ? null : Response.json({ error: "Unauthorized" }, { status: 401 });
}
