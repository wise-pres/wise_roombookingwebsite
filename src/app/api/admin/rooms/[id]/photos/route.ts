import { NextResponse } from "next/server";

import { requireAdminResponse } from "@/lib/server/require-admin";
import { addRoomPhoto, uploadRoomPhoto } from "@/lib/server/repository";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAdminResponse();
  if (unauthorized) {
    return unauthorized;
  }
  const { id } = await context.params;
  const formData = await request.formData();
  const altText = String(formData.get("altText") ?? "").trim();
  const sortOrder = Number(formData.get("sortOrder") ?? 0);
  const externalUrl = String(formData.get("externalUrl") ?? "").trim();
  const file = formData.get("file");

  if (!altText) {
    return NextResponse.json({ error: "Descriptive alt text is required." }, { status: 400 });
  }
  if (!Number.isInteger(sortOrder) || sortOrder < 0) {
    return NextResponse.json({ error: "Sort order must be zero or greater." }, { status: 400 });
  }
  try {
    if (file instanceof File && file.size > 0) {
      if (!allowedTypes.has(file.type) || file.size > 10 * 1024 * 1024) {
        return NextResponse.json({ error: "Upload a JPEG, PNG, or WebP image under 10 MB." }, { status: 400 });
      }
      return NextResponse.json({ photo: await uploadRoomPhoto(id, file, altText, sortOrder) }, { status: 201 });
    }
    if (!externalUrl || !URL.canParse(externalUrl)) {
      return NextResponse.json({ error: "Provide an image upload or a valid external image URL." }, { status: 400 });
    }
    return NextResponse.json(
      { photo: await addRoomPhoto(id, { kind: "external", url: externalUrl, altText, sortOrder }) },
      { status: 201 },
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Unable to save room photo." }, { status: 500 });
  }
}
