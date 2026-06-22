"use client";

import { useEffect, useState } from "react";

import { roomPhotoUrl } from "@/lib/catalog";
import type { Room } from "@/lib/types";

export function RoomImage({ room, compact = false }: { room: Room; compact?: boolean }) {
  const [failed, setFailed] = useState(false);
  const photoUrl = roomPhotoUrl(room);

  useEffect(() => {
    setFailed(false);
  }, [photoUrl]);

  if (!photoUrl || failed) {
    return <div className={`room-image room-image--empty ${compact ? "room-image--compact" : ""}`}>No photo available</div>;
  }

  return (
    <img
      className={`room-image ${compact ? "room-image--compact" : ""}`}
      src={photoUrl}
      alt={`${room.displayName} room view`}
      onError={() => setFailed(true)}
    />
  );
}
