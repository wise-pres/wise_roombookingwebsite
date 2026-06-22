import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before seeding.");
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const rooms = JSON.parse(await readFile(new URL("../src/data/sop-rooms.json", import.meta.url), "utf8"));
const tags = [
  "Meeting",
  "Workshop",
  "Presentation",
  "Panel / conference",
  "Networking / social",
  "Food / catering",
  "Performance / creative",
];

const { error: roomsError } = await supabase.from("rooms").upsert(
  rooms.map((room) => ({
    code: room.code,
    building: room.building,
    display_name: room.displayName,
    capacity: room.capacity,
    room_type: room.roomType,
    booking_source: room.bookingSource,
    details_url: room.detailsUrl,
    is_active: room.isActive,
  })),
  { onConflict: "code" },
);

if (roomsError) {
  throw roomsError;
}

const { data: seededRooms, error: fetchError } = await supabase.from("rooms").select("id, code");
if (fetchError) {
  throw fetchError;
}

const roomIdByCode = new Map(seededRooms.map((room) => [room.code, room.id]));
const photoRows = rooms
  .filter((room) => room.sourcePhotoUrl && roomIdByCode.has(room.code))
  .map((room) => ({
    room_id: roomIdByCode.get(room.code),
    kind: "external",
    url: room.sourcePhotoUrl,
    alt_text: `${room.displayName} room view`,
    sort_order: 0,
  }));

const { error: deletePhotosError } = await supabase
  .from("room_photos")
  .delete()
  .like("url", "https://lsm.utoronto.ca/%");
if (deletePhotosError) {
  throw deletePhotosError;
}

if (photoRows.length) {
  const { error: photosError } = await supabase.from("room_photos").insert(photoRows);
  if (photosError) {
    throw photosError;
  }
}

const { error: tagsError } = await supabase.from("room_tags").upsert(tags.map((name) => ({ name })), { onConflict: "name" });
if (tagsError) {
  throw tagsError;
}

console.log(`Seeded ${rooms.length} rooms, ${photoRows.length} source-photo links, and ${tags.length} tags.`);
