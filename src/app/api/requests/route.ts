import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { findRoomByCode, seedRooms } from "@/lib/catalog";
import { formatAvEstimate } from "@/lib/booking-rules";
import { notifyNewRequest } from "@/lib/server/notifications";
import { allowRequest } from "@/lib/server/rate-limit";
import { createBookingRequest } from "@/lib/server/repository";
import { hasSupabaseConfiguration } from "@/lib/server/supabase";
import { parseBookingRequest } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = parseBookingRequest(body);
    const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
    if (!allowRequest(`ip:${forwardedFor}`) || !allowRequest(`email:${input.email.toLowerCase()}`)) {
      return NextResponse.json({ error: "Too many requests. Please wait and try again." }, { status: 429 });
    }
    if (!hasSupabaseConfiguration()) {
      return NextResponse.json({ error: "Booking submissions are not configured yet." }, { status: 503 });
    }

    const created = await createBookingRequest(input);
    const primaryRoom = input.primaryChoice.roomCode
      ? findRoomByCode(seedRooms, input.primaryChoice.roomCode)?.displayName ?? input.primaryChoice.roomCode
      : input.primaryChoice.customRoom!;
    const notificationRequest = {
      reference: created.reference,
      email: input.email,
      requesterName: input.requesterName,
      team: input.team,
      purpose: input.purpose,
      eventDate: input.eventDate,
      startTime: input.startTime,
      endTime: input.endTime,
      attendees: input.attendees,
      isUrgent: created.is_urgent,
      urgencyReasons: created.urgency_reasons,
    };
    const notifications = await notifyNewRequest(notificationRequest, primaryRoom);
    if (!notifications.email.delivered) {
      console.error("Requester receipt email failed", notifications.email.error);
    }
    if (!notifications.slack.delivered) {
      console.error("Slack alert failed", notifications.slack.error);
    }

    return NextResponse.json({
      reference: created.reference,
      isUrgent: created.is_urgent,
      urgencyReasons: created.urgency_reasons,
      avEstimate: formatAvEstimate(created.av_estimate_cents),
      receiptEmailSent: notifications.email.delivered,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to submit request." }, { status: 500 });
  }
}
