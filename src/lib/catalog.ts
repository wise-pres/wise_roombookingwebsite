import importedRooms from "@/data/sop-rooms.json";
import type { Room } from "@/lib/types";

export const seedRooms = importedRooms as Room[];

export function roomPhotoUrl(room: Room): string | null {
  const orderedUpload = room.photos
    ?.filter((photo) => photo.url)
    .sort((first, second) => first.sortOrder - second.sortOrder)[0];

  return orderedUpload?.url ?? room.sourcePhotoUrl ?? null;
}

export function recommendRooms(rooms: Room[], attendees: number): Room[] {
  return rooms
    .filter((room) => room.isActive && room.capacity !== null && room.capacity >= attendees)
    .sort((first, second) => {
      const capacityDifference = (first.capacity ?? 0) - (second.capacity ?? 0);
      return capacityDifference || first.displayName.localeCompare(second.displayName);
    });
}

export function findRoomByCode(rooms: Room[], code?: string): Room | undefined {
  return rooms.find((room) => room.code === code);
}

export function sourceLabel(source: Room["bookingSource"]): string {
  const labels: Record<Room["bookingSource"], string> = {
    sop: "SOP",
    engsoc: "EngSoc",
    wise: "WISE special",
    utsu: "UTSU",
    custom: "Custom",
  };
  return labels[source];
}
