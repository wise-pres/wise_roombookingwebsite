"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { calculateAvEstimate, formatAvEstimate, getUrgencyReasons } from "@/lib/booking-rules";
import { findRoomByCode } from "@/lib/catalog";
import { RoomSelector } from "@/components/room-selector";
import type { BookingRequestInput, Room, RoomChoice, WiseTeam } from "@/lib/types";

const teams: WiseTeam[] = ["PD", "Outreach", "Conference", "Finance", "Marketing", "Internal"];

const initialInput: BookingRequestInput = {
  email: "",
  requesterName: "",
  team: "PD",
  purpose: "",
  eventDate: "",
  startTime: "",
  endTime: "",
  attendees: 1,
  requiresAv: false,
  avDetails: "",
  avAcknowledged: false,
  primaryChoice: {},
  alternatives: [],
};

type SubmissionResult = { reference: string; isUrgent: boolean; urgencyReasons: string[]; avEstimate: string | null; receiptEmailSent: boolean };

export function BookingForm({ initialRooms }: { initialRooms: Room[] }) {
  const [rooms, setRooms] = useState(initialRooms);
  const [input, setInput] = useState<BookingRequestInput>(initialInput);
  const [attendeeText, setAttendeeText] = useState("1");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState<SubmissionResult | null>(null);
  const attendeeCount = Number(attendeeText);
  const suggestedAttendeeCount = Number.isInteger(attendeeCount) && attendeeCount > 0 ? attendeeCount : 1;

  useEffect(() => {
    fetch("/api/rooms")
      .then((response) => (response.ok ? response.json() : null))
      .then((response) => {
        if (response?.rooms?.length) {
          setRooms(response.rooms);
        }
      })
      .catch(() => undefined);
  }, []);

  const selectedRooms = useMemo(
    () => [input.primaryChoice, ...input.alternatives].map((choice) => findRoomByCode(rooms, choice.roomCode)),
    [input.alternatives, input.primaryChoice, rooms],
  );
  const urgencyReasons = useMemo(() => {
    if (!input.eventDate || !input.startTime || !input.endTime) {
      return [];
    }
    return getUrgencyReasons(input.eventDate, input.startTime, input.endTime, selectedRooms);
  }, [input.endTime, input.eventDate, input.startTime, selectedRooms]);
  const avEstimate = useMemo(
    () => (input.eventDate ? calculateAvEstimate(input.requiresAv, input.eventDate, selectedRooms[0]) : null),
    [input.eventDate, input.requiresAv, selectedRooms],
  );

  function updateChoice(index: number, choice: RoomChoice) {
    if (index === 0) {
      setInput((current) => ({ ...current, primaryChoice: choice, avAcknowledged: false }));
      return;
    }
    setInput((current) => {
      const alternatives = [...current.alternatives];
      alternatives[index - 1] = choice;
      return { ...current, alternatives };
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (!Number.isInteger(attendeeCount) || attendeeCount < 1) {
        throw new Error("Enter at least one expected attendee.");
      }
      const response = await fetch("/api/requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...input, attendees: attendeeCount }),
      });
      const payload = (await response.json()) as SubmissionResult & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to submit your request.");
      }
      setSubmitted(payload);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Unable to submit your request.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <section className="confirmation-card" aria-live="polite">
        <p className="eyebrow">Request received</p>
        <h2>{submitted.reference}</h2>
        <p>{submitted.receiptEmailSent ? `We emailed a receipt to ${input.email}.` : "Your request is recorded."} A WISE coordinator will review it and email any status updates.</p>
        {submitted.isUrgent && (
          <p className="warning">This request is marked urgent for the coordinator: {submitted.urgencyReasons.join(" ")}</p>
        )}
        <button type="button" onClick={() => { setInput(initialInput); setAttendeeText("1"); setSubmitted(null); }}>
          Submit another request
        </button>
      </section>
    );
  }

  return (
    <form className="booking-form" onSubmit={submit}>
      <section className="form-section">
        <div>
          <p className="eyebrow">1. Your event</p>
          <h2>Tell us what you need</h2>
        </div>
        <div className="form-grid">
          <label>Email<input required type="email" value={input.email} onChange={(event) => setInput({ ...input, email: event.target.value })} /></label>
          <label>Name<input required value={input.requesterName} onChange={(event) => setInput({ ...input, requesterName: event.target.value })} /></label>
          <label>Team<select value={input.team} onChange={(event) => setInput({ ...input, team: event.target.value as WiseTeam })}>{teams.map((team) => <option key={team}>{team}</option>)}</select></label>
          <label>Expected attendees<input required min="1" max="2000" type="number" value={attendeeText} onChange={(event) => setAttendeeText(event.target.value)} /></label>
          <label className="form-grid__wide">Purpose for booking<input required minLength={3} placeholder="e.g. Conference bi-weekly sync" value={input.purpose} onChange={(event) => setInput({ ...input, purpose: event.target.value })} /></label>
          <label>Date<input required type="date" value={input.eventDate} onChange={(event) => setInput({ ...input, eventDate: event.target.value, avAcknowledged: false })} /></label>
          <label>Start time<input required type="time" value={input.startTime} onChange={(event) => setInput({ ...input, startTime: event.target.value })} /></label>
          <label>End time<input required type="time" value={input.endTime} onChange={(event) => setInput({ ...input, endTime: event.target.value })} /></label>
        </div>
      </section>

      {urgencyReasons.length > 0 && (
        <aside className="notice notice--urgent">
          <strong>This request needs quick coordinator attention.</strong>
          <ul>{urgencyReasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
          <p>You can still submit it. We will mark it urgent for WISE.</p>
        </aside>
      )}

      <section className="form-section">
        <div>
          <p className="eyebrow">2. Choose rooms</p>
          <h2>Pick a primary and backups</h2>
          <p className="field-help">Suggestions are based on attendance, not live availability. A coordinator confirms the actual booking.</p>
        </div>
        <RoomSelector label="Primary room" description="Choose your best option, or enter an option that is not listed." rooms={rooms} attendees={suggestedAttendeeCount} value={input.primaryChoice} onChange={(choice) => updateChoice(0, choice)} />
        {input.alternatives.map((choice, index) => (
          <div className="alternative" key={index}>
            <RoomSelector label={`Alternative ${index + 1}`} description="Optional fallback, in preference order." rooms={rooms} attendees={suggestedAttendeeCount} value={choice} onChange={(nextChoice) => updateChoice(index + 1, nextChoice)} />
            <button type="button" className="button-link" onClick={() => setInput((current) => ({ ...current, alternatives: current.alternatives.filter((_, currentIndex) => currentIndex !== index) }))}>Remove alternative</button>
          </div>
        ))}
        {input.alternatives.length < 3 && <button type="button" className="button-secondary" onClick={() => setInput((current) => ({ ...current, alternatives: [...current.alternatives, {}] }))}>Add an alternative</button>}
      </section>

      <section className="form-section">
        <div>
          <p className="eyebrow">3. AV and submit</p>
          <h2>Finish your request</h2>
        </div>
        <label className="check-row"><input type="checkbox" checked={input.requiresAv} onChange={(event) => setInput({ ...input, requiresAv: event.target.checked, avAcknowledged: false })} /> Is AV required?</label>
        {input.requiresAv && <label>AV needs or booking notes<textarea value={input.avDetails} onChange={(event) => setInput({ ...input, avDetails: event.target.value })} placeholder="Microphones, screens, accessibility needs, setup notes..." /></label>}
        {avEstimate && (
          <div className="notice">
            <strong>Estimated SOP AV cost: {formatAvEstimate(avEstimate)}</strong>
            <p>Only the room ultimately booked incurs this per-room, per-date charge.</p>
            <label className="check-row"><input type="checkbox" checked={input.avAcknowledged} onChange={(event) => setInput({ ...input, avAcknowledged: event.target.checked })} /> I understand this estimate is before tax.</label>
          </div>
        )}
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button-primary" disabled={submitting || (avEstimate !== null && !input.avAcknowledged)} type="submit">{submitting ? "Submitting…" : "Submit room request"}</button>
      </section>
    </form>
  );
}
