"use client";

import { useMemo, useState } from "react";

import { findRoomByCode, recommendRooms, sourceLabel } from "@/lib/catalog";
import { RoomImage } from "@/components/room-image";
import type { Room, RoomChoice } from "@/lib/types";

type RoomSelectorProps = {
  label: string;
  description: string;
  rooms: Room[];
  attendees: number;
  value: RoomChoice;
  onChange: (choice: RoomChoice) => void;
};

export function RoomSelector({ label, description, rooms, attendees, value, onChange }: RoomSelectorProps) {
  const [search, setSearch] = useState("");
  const selectedRoom = findRoomByCode(rooms, value.roomCode);
  const filteredRooms = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rooms
      .filter((room) => room.isActive)
      .filter((room) => !query || `${room.displayName} ${room.building} ${room.roomType}`.toLowerCase().includes(query));
  }, [rooms, search]);
  const suggestions = useMemo(() => recommendRooms(rooms, attendees).slice(0, 4), [rooms, attendees]);

  return (
    <fieldset className="room-selector">
      <legend>{label}</legend>
      <p className="field-help">{description}</p>
      <div className="room-discovery">
        <aside className="room-preview-panel">
          {selectedRoom ? (
            <article className="selected-room">
              <RoomImage room={selectedRoom} compact />
              <div>
                <strong>{selectedRoom.displayName}</strong>
                <p>{selectedRoom.building}</p>
                <span className="pill">{selectedRoom.capacity ? `${selectedRoom.capacity} seats` : "Capacity to confirm"}</span>
                <span className="pill pill--subtle">{sourceLabel(selectedRoom.bookingSource)}</span>
                {selectedRoom.capacity !== null && selectedRoom.capacity < attendees && (
                  <p className="warning">This room is smaller than the expected attendance.</p>
                )}
                {selectedRoom.detailsUrl && (
                  <a href={selectedRoom.detailsUrl} target="_blank" rel="noreferrer">
                    View official room details
                  </a>
                )}
              </div>
            </article>
          ) : (
            <div className="room-preview-empty">Choose a room to preview its photo, capacity, and booking source here.</div>
          )}
        </aside>

        <div className="room-options-panel">
          <label>
            Search available rooms
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Try MY 537 or Bahen" />
          </label>
          <label>
            Choose from the room list
            <select
              value={value.roomCode ?? (value.customRoom !== undefined ? "__other" : "")}
              onChange={(event) => {
                if (event.target.value === "__other") {
                  onChange({ customRoom: "" });
                } else {
                  onChange(event.target.value ? { roomCode: event.target.value } : {});
                }
              }}
            >
              <option value="">Select a room</option>
              <option value="__other">Other room (enter manually)</option>
              {filteredRooms.map((room) => (
                <option key={room.code} value={room.code}>
                  {room.displayName} - {room.building}{room.capacity ? ` (${room.capacity})` : ""}
                </option>
              ))}
            </select>
          </label>

          {value.customRoom !== undefined && (
            <label>
              Manual room option
              <input
                value={value.customRoom}
                onChange={(event) => onChange({ customRoom: event.target.value })}
                placeholder="Building and room number, e.g. MY 123"
              />
              <span className="field-help">This option is added to this request only. A coordinator can add it to the shared list later.</span>
            </label>
          )}

          <div className="suggestion-list">
            <p className="field-help">Closest capacity matches</p>
            {suggestions.map((room) => (
              <button key={room.code} type="button" className="suggestion" onClick={() => onChange({ roomCode: room.code })}>
                <span>{room.displayName}</span>
                <small>{room.capacity} seats · {room.building}</small>
              </button>
            ))}
          </div>

          <details className="catalogue-browser">
            <summary>Browse all {filteredRooms.length} matching rooms</summary>
            <p className="field-help">Search above to narrow this list by room, building, or room type. Choose any room to view its photo and details.</p>
            <div className="catalogue-browser__grid">
              {filteredRooms.map((room) => (
                <button key={room.code} type="button" className="catalogue-room" onClick={() => onChange({ roomCode: room.code })}>
                  <strong>{room.displayName}</strong>
                  <span>{room.building}</span>
                  <small>{room.capacity ? `${room.capacity} seats` : "Capacity to confirm"} · {room.roomType}</small>
                </button>
              ))}
            </div>
          </details>
        </div>
      </div>
    </fieldset>
  );
}
