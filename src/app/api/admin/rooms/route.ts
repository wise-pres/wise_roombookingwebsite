import { NextResponse } from "next/server";

import { requireAdminResponse } from "@/lib/server/require-admin";
import { assignTags, listRooms, upsertRoom } from "@/lib/server/repository";
import type { BookingSource } from "@/lib/types";

const bookingSources: BookingSource[] = ["sop", "engsoc", "wise", "utsu", "custom"];

type RoomPayload = {
  id?: string;
  code?: string;
  building?: string;
  displayName?: string;
  capacity?: number | null;
  roomType?: string;
  bookingSource?: BookingSource;
  detailsUrl?: string | null;
  isActive?: boolean;
  tagIds?: string[];
};

function validateRoom(body: RoomPayload): string | null {
  if (!body.code?.trim() || !body.building?.trim() || !body.displayName?.trim() || !body.roomType?.trim()) {
    return "Room code, building, display name, and room type are required.";
  }
  if (!body.bookingSource || !bookingSources.includes(body.bookingSource)) {
    return "A valid booking source is required.";
  }
  if (body.capacity !== null && body.capacity !== undefined && (!Number.isInteger(body.capacity) || body.capacity < 1)) {
    return "Capacity must be a whole number greater than zero, or blank.";
  }
  return null;
}

export async function GET() {
  const unauthorized = await requireAdminResponse();
  if (unauthorized) {
    return unauthorized;
  }
  return NextResponse.json({ rooms: await listRooms() });
}

async function saveRoom(request: Request) {
  const unauthorized = await requireAdminResponse();
  if (unauthorized) {
    return unauthorized;
  }
  const body = (await request.json()) as RoomPayload;
  const validationError = validateRoom(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }
  try {
    const room = await upsertRoom(
      {
        code: body.code!.trim(),
        building: body.building!.trim(),
        displayName: body.displayName!.trim(),
        capacity: body.capacity ?? null,
        roomType: body.roomType!.trim(),
        bookingSource: body.bookingSource!,
        detailsUrl: body.detailsUrl || null,
        isActive: body.isActive ?? true,
      },
      body.id,
    );
    if (body.tagIds) {
      await assignTags(room.id!, body.tagIds);
    }
    return NextResponse.json({ room }, { status: body.id ? 200 : 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Unable to save room." }, { status: 500 });
  }
}

export const POST = saveRoom;
export const PATCH = saveRoom;
