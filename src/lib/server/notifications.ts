import { Resend } from "resend";

import type { BookingStatus } from "@/lib/types";

type NotificationRequest = {
  reference: string;
  email: string;
  requesterName: string;
  team: string;
  purpose: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  attendees: number;
  isUrgent: boolean;
  urgencyReasons: string[];
};

function emailClient(): Resend | null {
  return process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
}

function fromAddress(): string | null {
  return process.env.EMAIL_FROM ?? null;
}

async function sendEmail(to: string, subject: string, text: string): Promise<void> {
  const client = emailClient();
  const from = fromAddress();
  if (!client || !from) {
    return;
  }
  const { error } = await client.emails.send({ from, to, subject, text });
  if (error) {
    throw new Error(error.message);
  }
}

export async function notifyNewRequest(request: NotificationRequest, primaryRoom: string): Promise<void> {
  const urgencyLabel = request.isUrgent ? "URGENT: " : "";
  const slackUrl = process.env.SLACK_WEBHOOK_URL;
  if (slackUrl) {
    const lines = [
      `*${urgencyLabel}New WISE room request* - ${request.reference}`,
      `${request.team}: ${request.purpose}`,
      `${request.eventDate}, ${request.startTime}-${request.endTime} - ${request.attendees} attendees`,
      `Primary room: ${primaryRoom}`,
      ...(request.isUrgent ? request.urgencyReasons.map((reason) => `:rotating_light: ${reason}`) : []),
    ];
    const response = await fetch(slackUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: lines.join("\n") }),
    });
    if (!response.ok) {
      throw new Error("Slack notification failed.");
    }
  }

  await sendEmail(
    request.email,
    `WISE room request received - ${request.reference}`,
    [
      `Hi ${request.requesterName},`,
      "",
      `We received your room request (${request.reference}) and it is pending WISE coordinator review.`,
      `Event: ${request.purpose}`,
      `When: ${request.eventDate}, ${request.startTime}-${request.endTime}`,
      `Primary room: ${primaryRoom}`,
      "",
      "A coordinator will email you once the request status changes.",
    ].join("\n"),
  );
}

export async function notifyStatusChange(
  request: Pick<NotificationRequest, "email" | "requesterName" | "reference">,
  status: BookingStatus,
): Promise<void> {
  const readableStatus: Record<BookingStatus, string> = {
    new: "New",
    in_review: "In review",
    submitted: "Submitted to booking office",
    booked: "Booked",
    needs_alternatives: "Needs alternatives",
    declined: "Declined",
  };
  await sendEmail(
    request.email,
    `WISE room request update - ${request.reference}`,
    `Hi ${request.requesterName},\n\nYour WISE room request (${request.reference}) is now: ${readableStatus[status]}.\n\nA coordinator will follow up if more information is needed.`,
  );
}
