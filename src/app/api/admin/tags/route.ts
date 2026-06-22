import { NextResponse } from "next/server";

import { requireAdminResponse } from "@/lib/server/require-admin";
import { countTagAssignments, deleteTag, listTags, saveTag } from "@/lib/server/repository";

export async function GET() {
  const unauthorized = await requireAdminResponse();
  if (unauthorized) {
    return unauthorized;
  }
  return NextResponse.json({ tags: await listTags() });
}

export async function POST(request: Request) {
  const unauthorized = await requireAdminResponse();
  if (unauthorized) {
    return unauthorized;
  }
  const body = (await request.json()) as { name?: string };
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Tag name is required." }, { status: 400 });
  }
  return NextResponse.json({ tag: await saveTag(body.name) }, { status: 201 });
}

export async function PATCH(request: Request) {
  const unauthorized = await requireAdminResponse();
  if (unauthorized) {
    return unauthorized;
  }
  const body = (await request.json()) as { id?: string; name?: string };
  if (!body.id || !body.name?.trim()) {
    return NextResponse.json({ error: "Tag id and name are required." }, { status: 400 });
  }
  return NextResponse.json({ tag: await saveTag(body.name, body.id) });
}

export async function DELETE(request: Request) {
  const unauthorized = await requireAdminResponse();
  if (unauthorized) {
    return unauthorized;
  }
  const id = new URL(request.url).searchParams.get("id");
  const preview = new URL(request.url).searchParams.get("preview") === "true";
  if (!id) {
    return NextResponse.json({ error: "Tag id is required." }, { status: 400 });
  }
  const affectedRooms = preview ? await countTagAssignments(id) : await deleteTag(id);
  return NextResponse.json({ affectedRooms });
}
