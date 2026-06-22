import { NextResponse } from "next/server";

import { notifyStatusChange } from "@/lib/server/notifications";
import { requireAdminResponse } from "@/lib/server/require-admin";
import { getBookingRequest, listBookingRequests, updateBookingStatus } from "@/lib/server/repository";
import { BOOKING_STATUSES } from "@/lib/request-workflow";
import type { BookingStatus } from "@/lib/types";

export async function GET() {
  const unauthorized = await requireAdminResponse();
  if (unauthorized) {
    return unauthorized;
  }
  try {
    return NextResponse.json({ requests: await listBookingRequests() });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Unable to load requests." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const unauthorized = await requireAdminResponse();
  if (unauthorized) {
    return unauthorized;
  }
  const body = (await request.json()) as { id?: string; status?: BookingStatus };
  if (!body.id || !body.status || !BOOKING_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "A request id and valid status are required." }, { status: 400 });
  }
  try {
    const existing = await getBookingRequest(body.id);
    if (!existing) {
      return NextResponse.json({ error: "Request not found." }, { status: 404 });
    }
    const updated = await updateBookingStatus(body.id, body.status);
    const emailDelivery = await notifyStatusChange(
      { email: existing.email, requesterName: existing.requester_name ?? "there", reference: existing.reference },
      body.status,
    );
    if (!emailDelivery.delivered) {
      console.error("Status notification failed", emailDelivery.error);
    }
    return NextResponse.json({ request: updated, emailDelivery });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Unable to update request." }, { status: 500 });
  }
}
