import { NextResponse } from "next/server";

import { requireAdminResponse } from "@/lib/server/require-admin";
import { deleteRoomPhoto, updateRoomPhoto } from "@/lib/server/repository";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAdminResponse();
  if (unauthorized) {
    return unauthorized;
  }
  const { id } = await context.params;
  await deleteRoomPhoto(id);
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAdminResponse();
  if (unauthorized) {
    return unauthorized;
  }
  const { id } = await context.params;
  const body = (await request.json()) as { altText?: string; sortOrder?: number };
  const sortOrder = body.sortOrder;
  if (!body.altText?.trim() || !Number.isInteger(sortOrder) || sortOrder === undefined || sortOrder < 0) {
    return NextResponse.json({ error: "Alt text and a valid sort order are required." }, { status: 400 });
  }
  return NextResponse.json({ photo: await updateRoomPhoto(id, body.altText.trim(), sortOrder) });
}
