import { randomInt } from "node:crypto";

import { calculateAvEstimate, getUrgencyReasons } from "@/lib/booking-rules";
import type { BookingRequestInput, BookingStatus, Room, RoomPhoto } from "@/lib/types";
import { getSupabaseAdmin } from "@/lib/server/supabase";

type DatabaseRoom = {
  id: string;
  code: string;
  building: string;
  display_name: string;
  capacity: number | null;
  room_type: string;
  booking_source: Room["bookingSource"];
  details_url: string | null;
  is_active: boolean;
  room_photos?: Array<{
    id: string;
    kind: RoomPhoto["kind"];
    url: string;
    storage_path: string | null;
    alt_text: string;
    sort_order: number;
  }>;
  room_tag_assignments?: Array<{ room_tags?: { name: string } | null }>;
};

export type AdminBookingRequest = {
  id: string;
  reference: string;
  email: string;
  requester_name: string | null;
  team: string;
  purpose: string;
  event_date: string;
  start_time: string;
  end_time: string;
  attendees: number;
  requires_av: boolean;
  av_details: string | null;
  av_estimate_cents: number | null;
  urgency_reasons: string[];
  is_urgent: boolean;
  status: BookingStatus;
  primary_custom_room: string | null;
  created_at: string;
  primary_room?: Pick<DatabaseRoom, "code" | "display_name" | "building"> | null;
  booking_request_alternatives?: Array<{
    preference_rank: number;
    custom_room: string | null;
    room?: Pick<DatabaseRoom, "code" | "display_name" | "building"> | null;
  }>;
};

export type RoomMutation = Pick<
  Room,
  "code" | "building" | "displayName" | "capacity" | "roomType" | "bookingSource" | "detailsUrl" | "isActive"
>;

function mapRoom(row: DatabaseRoom): Room {
  return {
    id: row.id,
    code: row.code,
    building: row.building,
    displayName: row.display_name,
    capacity: row.capacity,
    roomType: row.room_type,
    bookingSource: row.booking_source,
    detailsUrl: row.details_url,
    photos: (row.room_photos ?? []).map((photo) => ({
      id: photo.id,
      kind: photo.kind,
      url: photo.url,
      storagePath: photo.storage_path,
      altText: photo.alt_text,
      sortOrder: photo.sort_order,
    })),
    tags: (row.room_tag_assignments ?? []).flatMap((assignment) => (assignment.room_tags?.name ? [assignment.room_tags.name] : [])),
    isActive: row.is_active,
  };
}

const roomSelection = "*, room_photos(*), room_tag_assignments(room_tags(name))";

export async function listRooms(): Promise<Room[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("rooms").select(roomSelection).order("building").order("code");
  if (error) {
    throw error;
  }
  return ((data ?? []) as DatabaseRoom[]).map(mapRoom);
}

export async function findRoomsByCode(codes: string[]): Promise<Map<string, Room>> {
  if (!codes.length) {
    return new Map();
  }
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("rooms").select(roomSelection).in("code", codes);
  if (error) {
    throw error;
  }
  return new Map(((data ?? []) as DatabaseRoom[]).map((row) => {
    const room = mapRoom(row);
    return [room.code, room];
  }));
}

function requestReference(eventDate: string): string {
  return `WISE-${eventDate.slice(0, 4)}-${randomInt(1000, 10000)}`;
}

export async function createBookingRequest(input: BookingRequestInput): Promise<AdminBookingRequest> {
  const roomCodes = [input.primaryChoice.roomCode, ...input.alternatives.map((choice) => choice.roomCode)].filter(
    (code): code is string => Boolean(code),
  );
  const roomByCode = await findRoomsByCode(roomCodes);
  const unknownCode = roomCodes.find((code) => !roomByCode.has(code));
  if (unknownCode) {
    throw new Error(`The room ${unknownCode} is no longer in the catalogue. Please choose another room.`);
  }

  const primaryRoom = input.primaryChoice.roomCode ? roomByCode.get(input.primaryChoice.roomCode) : undefined;
  const alternativeRooms = input.alternatives.map((choice) => (choice.roomCode ? roomByCode.get(choice.roomCode) : undefined));
  const urgencyReasons = getUrgencyReasons(input.eventDate, input.startTime, input.endTime, [primaryRoom, ...alternativeRooms]);
  const avEstimateCents = calculateAvEstimate(input.requiresAv, input.eventDate, primaryRoom);
  if (avEstimateCents !== null && !input.avAcknowledged) {
    throw new Error("Acknowledge the SOP AV estimate before submitting the request.");
  }

  const supabase = getSupabaseAdmin();
  const requestPayload = {
    email: input.email,
    requester_name: input.requesterName,
    team: input.team,
    purpose: input.purpose,
    event_date: input.eventDate,
    start_time: input.startTime,
    end_time: input.endTime,
    attendees: input.attendees,
    requires_av: input.requiresAv,
    av_details: input.avDetails || null,
    av_estimate_cents: avEstimateCents,
    av_acknowledged: input.avAcknowledged,
    primary_room_id: primaryRoom?.id ?? null,
    primary_custom_room: input.primaryChoice.customRoom || null,
    urgency_reasons: urgencyReasons,
    is_urgent: urgencyReasons.length > 0,
  };

  let request: AdminBookingRequest | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await supabase
      .from("booking_requests")
      .insert({ ...requestPayload, reference: requestReference(input.eventDate) })
      .select()
      .single();
    if (!error && data) {
      request = data as AdminBookingRequest;
      break;
    }
    if (error?.code !== "23505") {
      throw error;
    }
  }
  if (!request) {
    throw new Error("Unable to create a unique request reference. Please try again.");
  }

  if (input.alternatives.length) {
    const alternativeRows = input.alternatives.map((choice, index) => ({
      booking_request_id: request.id,
      preference_rank: index + 1,
      room_id: choice.roomCode ? roomByCode.get(choice.roomCode)?.id ?? null : null,
      custom_room: choice.customRoom || null,
    }));
    const { error } = await supabase.from("booking_request_alternatives").insert(alternativeRows);
    if (error) {
      throw error;
    }
  }

  return request;
}

export async function listBookingRequests(): Promise<AdminBookingRequest[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("booking_requests")
    .select(
      "*, primary_room:rooms!booking_requests_primary_room_id_fkey(code, display_name, building), booking_request_alternatives(preference_rank, custom_room, room:rooms(code, display_name, building))",
    )
    .order("is_urgent", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) {
    throw error;
  }
  return (data ?? []) as AdminBookingRequest[];
}

export async function getBookingRequest(id: string): Promise<AdminBookingRequest | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("booking_requests").select().eq("id", id).maybeSingle();
  if (error) {
    throw error;
  }
  return (data as AdminBookingRequest | null) ?? null;
}

export async function updateBookingStatus(id: string, status: BookingStatus): Promise<AdminBookingRequest> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("booking_requests").update({ status }).eq("id", id).select().single();
  if (error) {
    throw error;
  }
  return data as AdminBookingRequest;
}

export async function upsertRoom(room: RoomMutation, id?: string): Promise<Room> {
  const supabase = getSupabaseAdmin();
  const values = {
    code: room.code.trim().toUpperCase(),
    building: room.building.trim(),
    display_name: room.displayName.trim(),
    capacity: room.capacity,
    room_type: room.roomType.trim(),
    booking_source: room.bookingSource,
    details_url: room.detailsUrl || null,
    is_active: room.isActive,
  };
  const query = id
    ? supabase.from("rooms").update(values).eq("id", id).select(roomSelection).single()
    : supabase.from("rooms").insert(values).select(roomSelection).single();
  const { data, error } = await query;
  if (error) {
    throw error;
  }
  return mapRoom(data as DatabaseRoom);
}

export async function addRoomPhoto(roomId: string, photo: Omit<RoomPhoto, "id">): Promise<RoomPhoto> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("room_photos")
    .insert({
      room_id: roomId,
      kind: photo.kind,
      url: photo.url,
      storage_path: photo.storagePath ?? null,
      alt_text: photo.altText,
      sort_order: photo.sortOrder,
    })
    .select()
    .single();
  if (error) {
    throw error;
  }
  return {
    id: data.id,
    kind: data.kind,
    url: data.url,
    storagePath: data.storage_path,
    altText: data.alt_text,
    sortOrder: data.sort_order,
  };
}

export async function deleteRoomPhoto(photoId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { data: photo, error: fetchError } = await supabase
    .from("room_photos")
    .select("kind, storage_path")
    .eq("id", photoId)
    .maybeSingle();
  if (fetchError) {
    throw fetchError;
  }
  const { error } = await supabase.from("room_photos").delete().eq("id", photoId);
  if (error) {
    throw error;
  }
  if (photo?.kind === "upload" && photo.storage_path) {
    const { error: storageError } = await supabase.storage.from("room-photos").remove([photo.storage_path]);
    if (storageError) {
      throw storageError;
    }
  }
}

export async function updateRoomPhoto(photoId: string, altText: string, sortOrder: number): Promise<RoomPhoto> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("room_photos")
    .update({ alt_text: altText, sort_order: sortOrder })
    .eq("id", photoId)
    .select()
    .single();
  if (error) {
    throw error;
  }
  return {
    id: data.id,
    kind: data.kind,
    url: data.url,
    storagePath: data.storage_path,
    altText: data.alt_text,
    sortOrder: data.sort_order,
  };
}

export async function listTags(): Promise<Array<{ id: string; name: string }>> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("room_tags").select("id, name").order("name");
  if (error) {
    throw error;
  }
  return data ?? [];
}

export async function saveTag(name: string, id?: string): Promise<{ id: string; name: string }> {
  const supabase = getSupabaseAdmin();
  const query = id
    ? supabase.from("room_tags").update({ name: name.trim() }).eq("id", id).select("id, name").single()
    : supabase.from("room_tags").insert({ name: name.trim() }).select("id, name").single();
  const { data, error } = await query;
  if (error) {
    throw error;
  }
  return data;
}

export async function deleteTag(id: string): Promise<number> {
  const supabase = getSupabaseAdmin();
  const affectedRooms = await countTagAssignments(id);
  const { error } = await supabase.from("room_tags").delete().eq("id", id);
  if (error) {
    throw error;
  }
  return affectedRooms;
}

export async function countTagAssignments(id: string): Promise<number> {
  const supabase = getSupabaseAdmin();
  const { count, error } = await supabase
    .from("room_tag_assignments")
    .select("*", { count: "exact", head: true })
    .eq("tag_id", id);
  if (error) {
    throw error;
  }
  return count ?? 0;
}

export async function assignTags(roomId: string, tagIds: string[]): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error: deleteError } = await supabase.from("room_tag_assignments").delete().eq("room_id", roomId);
  if (deleteError) {
    throw deleteError;
  }
  if (tagIds.length) {
    const { error } = await supabase
      .from("room_tag_assignments")
      .insert(tagIds.map((tagId) => ({ room_id: roomId, tag_id: tagId })));
    if (error) {
      throw error;
    }
  }
}

export async function uploadRoomPhoto(roomId: string, file: File, altText: string, sortOrder: number): Promise<RoomPhoto> {
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const objectPath = `${roomId}/${crypto.randomUUID()}.${extension}`;
  const supabase = getSupabaseAdmin();
  const { error: storageError } = await supabase.storage.from("room-photos").upload(objectPath, file, {
    contentType: file.type,
    upsert: false,
  });
  if (storageError) {
    throw storageError;
  }
  const { data } = supabase.storage.from("room-photos").getPublicUrl(objectPath);
  return addRoomPhoto(roomId, { kind: "upload", url: data.publicUrl, storagePath: objectPath, altText, sortOrder });
}

export async function anonymizeExpiredRequesterNames(now = new Date()): Promise<number> {
  const currentAcademicYearStart = new Date(Date.UTC(now.getUTCFullYear() - (now.getUTCMonth() < 8 ? 2 : 1), 8, 1));
  const cutoff = currentAcademicYearStart.toISOString().slice(0, 10);
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("booking_requests")
    .update({ requester_name: null })
    .lt("event_date", cutoff)
    .not("requester_name", "is", null)
    .select("id");
  if (error) {
    throw error;
  }
  return data?.length ?? 0;
}
