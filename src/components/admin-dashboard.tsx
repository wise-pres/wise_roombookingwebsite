"use client";

import { FormEvent, useMemo, useState } from "react";

import { RoomImage } from "@/components/room-image";
import type { BookingSource, BookingStatus, Room } from "@/lib/types";

type Tag = { id: string; name: string };
type AdminRequest = {
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
  av_estimate_cents: number | null;
  is_urgent: boolean;
  urgency_reasons: string[];
  status: BookingStatus;
  primary_custom_room: string | null;
  created_at: string;
  primary_room?: { code: string; display_name: string; building: string } | null;
  booking_request_alternatives?: Array<{
    preference_rank: number;
    custom_room: string | null;
    room?: { code: string; display_name: string; building: string } | null;
  }>;
};

type RoomDraft = {
  id?: string;
  code: string;
  building: string;
  displayName: string;
  capacity: string;
  roomType: string;
  bookingSource: BookingSource;
  detailsUrl: string;
  isActive: boolean;
  tagIds: string[];
};

const statuses: BookingStatus[] = ["new", "in_review", "submitted", "booked", "needs_alternatives", "declined"];
const sources: BookingSource[] = ["sop", "engsoc", "wise", "utsu", "custom"];

function newRoomDraft(): RoomDraft {
  return { code: "", building: "", displayName: "", capacity: "", roomType: "Meeting Room", bookingSource: "custom", detailsUrl: "", isActive: true, tagIds: [] };
}

function draftFromRoom(room: Room, tags: Tag[]): RoomDraft {
  return {
    id: room.id,
    code: room.code,
    building: room.building,
    displayName: room.displayName,
    capacity: room.capacity?.toString() ?? "",
    roomType: room.roomType,
    bookingSource: room.bookingSource,
    detailsUrl: room.detailsUrl ?? "",
    isActive: room.isActive,
    tagIds: tags.filter((tag) => room.tags?.includes(tag.name)).map((tag) => tag.id),
  };
}

function statusLabel(status: BookingStatus): string {
  return status.replaceAll("_", " ");
}

export function AdminDashboard({ initialRequests, initialRooms, initialTags }: { initialRequests: AdminRequest[]; initialRooms: Room[]; initialTags: Tag[] }) {
  const [requests, setRequests] = useState(initialRequests);
  const [rooms, setRooms] = useState(initialRooms);
  const [tags, setTags] = useState(initialTags);
  const [section, setSection] = useState<"requests" | "catalogue">("requests");
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [roomDraft, setRoomDraft] = useState<RoomDraft>(newRoomDraft);
  const [selectedRoomCode, setSelectedRoomCode] = useState("");
  const [message, setMessage] = useState("");

  const selectedRoom = rooms.find((room) => room.code === selectedRoomCode);
  const displayedRequests = useMemo(() => (urgentOnly ? requests.filter((request) => request.is_urgent) : requests), [requests, urgentOnly]);

  async function refreshRooms() {
    const response = await fetch("/api/admin/rooms");
    const payload = (await response.json()) as { rooms?: Room[]; error?: string };
    if (!response.ok || !payload.rooms) {
      throw new Error(payload.error ?? "Unable to refresh rooms.");
    }
    setRooms(payload.rooms);
    return payload.rooms;
  }

  async function refreshTags() {
    const response = await fetch("/api/admin/tags");
    const payload = (await response.json()) as { tags?: Tag[]; error?: string };
    if (!response.ok || !payload.tags) {
      throw new Error(payload.error ?? "Unable to refresh tags.");
    }
    setTags(payload.tags);
  }

  async function changeStatus(id: string, status: BookingStatus) {
    setMessage("");
    const response = await fetch("/api/admin/requests", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, status }) });
    const payload = (await response.json()) as { request?: AdminRequest; error?: string };
    if (!response.ok || !payload.request) {
      setMessage(payload.error ?? "Unable to update request status.");
      return;
    }
    setRequests((current) => current.map((request) => (request.id === id ? { ...request, ...payload.request } : request)));
  }

  async function saveRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const response = await fetch("/api/admin/rooms", {
      method: roomDraft.id ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...roomDraft,
        capacity: roomDraft.capacity ? Number(roomDraft.capacity) : null,
        detailsUrl: roomDraft.detailsUrl || null,
      }),
    });
    const payload = (await response.json()) as { room?: Room; error?: string };
    if (!response.ok || !payload.room) {
      setMessage(payload.error ?? "Unable to save room.");
      return;
    }
    const refreshedRooms = await refreshRooms();
    setSelectedRoomCode(payload.room.code);
    setRoomDraft(draftFromRoom(refreshedRooms.find((room) => room.code === payload.room?.code) ?? payload.room, tags));
    setMessage("Room saved.");
  }

  async function savePhoto(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedRoom?.id) {
      setMessage("Save the room before adding photos.");
      return;
    }
    const formData = new FormData(event.currentTarget);
    const response = await fetch(`/api/admin/rooms/${selectedRoom.id}/photos`, { method: "POST", body: formData });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setMessage(payload.error ?? "Unable to add photo.");
      return;
    }
    await refreshRooms();
    event.currentTarget.reset();
    setMessage("Photo added.");
  }

  async function removePhoto(photoId?: string) {
    if (!photoId || !window.confirm("Remove this room photo?")) {
      return;
    }
    const response = await fetch(`/api/admin/photos/${photoId}`, { method: "DELETE" });
    if (!response.ok) {
      setMessage("Unable to remove photo.");
      return;
    }
    await refreshRooms();
    setMessage("Photo removed.");
  }

  async function addTag(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("tag") ?? "").trim();
    if (!name) {
      return;
    }
    const response = await fetch("/api/admin/tags", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setMessage(payload.error ?? "Unable to add tag.");
      return;
    }
    event.currentTarget.reset();
    await refreshTags();
  }

  async function renameTag(tag: Tag) {
    const name = window.prompt("Rename this shared tag", tag.name)?.trim();
    if (!name || name === tag.name) {
      return;
    }
    const response = await fetch("/api/admin/tags", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: tag.id, name }) });
    if (!response.ok) {
      setMessage("Unable to rename tag.");
      return;
    }
    await refreshTags();
    await refreshRooms();
  }

  async function removeTag(tag: Tag) {
    const preview = await fetch(`/api/admin/tags?id=${tag.id}&preview=true`, { method: "DELETE" });
    const previewPayload = (await preview.json()) as { affectedRooms?: number; error?: string };
    if (!preview.ok || previewPayload.affectedRooms === undefined) {
      setMessage(previewPayload.error ?? "Unable to check tag use.");
      return;
    }
    if (!window.confirm(`Delete “${tag.name}”? It will be removed from ${previewPayload.affectedRooms} room(s).`)) {
      return;
    }
    const response = await fetch(`/api/admin/tags?id=${tag.id}`, { method: "DELETE" });
    if (!response.ok) {
      setMessage("Unable to delete tag.");
      return;
    }
    await refreshTags();
    await refreshRooms();
  }

  function selectRoom(roomCode: string) {
    const room = rooms.find((candidate) => candidate.code === roomCode);
    setSelectedRoomCode(roomCode);
    setRoomDraft(room ? draftFromRoom(room, tags) : newRoomDraft());
  }

  function draftCustomRoom(customRoom: string) {
    setSection("catalogue");
    setSelectedRoomCode("");
    setRoomDraft({ ...newRoomDraft(), displayName: customRoom, code: customRoom.replace(/[^A-Za-z0-9]/g, "").toUpperCase(), building: "Confirm building" });
  }

  return (
    <main className="admin-shell">
      <header className="admin-header"><div><p className="eyebrow">WISE coordinator workspace</p><h1>Room requests and catalogue</h1></div><button className="button-secondary" type="button" onClick={() => fetch("/api/admin/session", { method: "DELETE" }).then(() => window.location.reload())}>Sign out</button></header>
      <nav className="admin-tabs"><button type="button" className={section === "requests" ? "is-active" : ""} onClick={() => setSection("requests")}>Requests <span>{requests.filter((request) => request.is_urgent).length} urgent</span></button><button type="button" className={section === "catalogue" ? "is-active" : ""} onClick={() => setSection("catalogue")}>Rooms, photos & tags</button></nav>
      {message && <p className="admin-message" role="status">{message}</p>}

      {section === "requests" && <section><div className="dashboard-toolbar"><h2>Requests</h2><label className="check-row"><input type="checkbox" checked={urgentOnly} onChange={(event) => setUrgentOnly(event.target.checked)} /> Show urgent only</label></div><div className="request-list">{displayedRequests.map((request) => <article className={`request-card ${request.is_urgent ? "request-card--urgent" : ""}`} key={request.id}><div className="request-card__top"><div><span className="reference">{request.reference}</span><h3>{request.purpose}</h3><p>{request.team} · {request.event_date} · {request.start_time.slice(0, 5)}-{request.end_time.slice(0, 5)} · {request.attendees} attendees</p></div>{request.is_urgent && <span className="urgent-badge">Urgent</span>}</div>{request.is_urgent && <ul className="urgency-list">{request.urgency_reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>}<div className="request-details"><p><strong>Requester:</strong> {request.requester_name ?? "Name removed"} · <a href={`mailto:${request.email}`}>{request.email}</a></p><p><strong>Primary:</strong> {request.primary_room?.display_name ?? request.primary_custom_room ?? "Not specified"}</p>{request.booking_request_alternatives?.length ? <p><strong>Alternatives:</strong> {request.booking_request_alternatives.sort((first, second) => first.preference_rank - second.preference_rank).map((alternative) => alternative.room?.display_name ?? alternative.custom_room).join(" → ")}</p> : null}{request.primary_custom_room && <button type="button" className="button-link" onClick={() => draftCustomRoom(request.primary_custom_room!)}>Use custom room as catalogue draft</button>}</div><label>Request status<select value={request.status} onChange={(event) => changeStatus(request.id, event.target.value as BookingStatus)}>{statuses.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}</select></label></article>)}</div>{!displayedRequests.length && <p className="empty-state">No matching requests.</p>}</section>}

      {section === "catalogue" && <section className="catalogue-grid"><div className="catalogue-sidebar"><h2>Rooms</h2><button type="button" className="button-secondary" onClick={() => { setSelectedRoomCode(""); setRoomDraft(newRoomDraft()); }}>Add a room</button><select aria-label="Choose room to edit" value={selectedRoomCode} onChange={(event) => selectRoom(event.target.value)}><option value="">Choose a room to edit</option>{rooms.map((room) => <option key={room.code} value={room.code}>{room.displayName} - {room.building}</option>)}</select><div className="tag-manager"><h3>Shared suitability tags</h3><form onSubmit={addTag}><input name="tag" placeholder="New tag" /><button type="submit">Add</button></form>{tags.map((tag) => <div className="tag-row" key={tag.id}><span>{tag.name}</span><button type="button" onClick={() => renameTag(tag)}>Edit</button><button type="button" onClick={() => removeTag(tag)}>Delete</button></div>)}</div></div><div className="catalogue-editor"><h2>{roomDraft.id ? `Edit ${roomDraft.code}` : "Add room"}</h2><form className="room-editor" onSubmit={saveRoom}><div className="form-grid"><label>Room code<input required value={roomDraft.code} onChange={(event) => setRoomDraft({ ...roomDraft, code: event.target.value })} /></label><label>Building<input required value={roomDraft.building} onChange={(event) => setRoomDraft({ ...roomDraft, building: event.target.value })} /></label><label className="form-grid__wide">Display name<input required value={roomDraft.displayName} onChange={(event) => setRoomDraft({ ...roomDraft, displayName: event.target.value })} /></label><label>Capacity<input min="1" type="number" value={roomDraft.capacity} onChange={(event) => setRoomDraft({ ...roomDraft, capacity: event.target.value })} /></label><label>Room type<input required value={roomDraft.roomType} onChange={(event) => setRoomDraft({ ...roomDraft, roomType: event.target.value })} /></label><label>Booking source<select value={roomDraft.bookingSource} onChange={(event) => setRoomDraft({ ...roomDraft, bookingSource: event.target.value as BookingSource })}>{sources.map((source) => <option key={source} value={source}>{source}</option>)}</select></label><label>Official details URL<input type="url" value={roomDraft.detailsUrl} onChange={(event) => setRoomDraft({ ...roomDraft, detailsUrl: event.target.value })} /></label></div><fieldset className="tag-checkboxes"><legend>Suitability tags</legend>{tags.map((tag) => <label key={tag.id} className="check-row"><input type="checkbox" checked={roomDraft.tagIds.includes(tag.id)} onChange={(event) => setRoomDraft({ ...roomDraft, tagIds: event.target.checked ? [...roomDraft.tagIds, tag.id] : roomDraft.tagIds.filter((tagId) => tagId !== tag.id) })} /> {tag.name}</label>)}</fieldset><label className="check-row"><input type="checkbox" checked={roomDraft.isActive} onChange={(event) => setRoomDraft({ ...roomDraft, isActive: event.target.checked })} /> Show this room in the requester dropdown</label><button className="button-primary" type="submit">Save room</button></form>{selectedRoom && <section className="photo-manager"><h3>Photos for {selectedRoom.displayName}</h3><div className="photo-list">{selectedRoom.photos?.map((photo) => <div className="photo-item" key={photo.id}><RoomImage room={{ ...selectedRoom, photos: [photo], sourcePhotoUrl: null }} compact /><p>{photo.altText}</p><button type="button" className="button-link" onClick={() => removePhoto(photo.id)}>Remove</button></div>)}</div><form className="photo-form" onSubmit={savePhoto}><label>Upload a WISE-approved photo<input name="file" type="file" accept="image/jpeg,image/png,image/webp" /></label><span>or</span><label>External image URL<input name="externalUrl" type="url" placeholder="https://…" /></label><label>Alt text<input required name="altText" placeholder="Room facing the presentation wall" /></label><label>Display order<input name="sortOrder" type="number" min="0" defaultValue="0" /></label><button type="submit">Add photo</button></form></section>}</div></section>}
    </main>
  );
}
