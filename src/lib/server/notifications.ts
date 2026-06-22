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

export type DeliveryResult = {
  delivered: boolean;
  error?: string;
};

function emailClient(): Resend | null {
  return process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
}

function fromAddress(): string | null {
  return process.env.EMAIL_FROM ?? null;
}

async function sendEmail(to: string, subject: string, text: string): Promise<DeliveryResult> {
  const client = emailClient();
  const from = fromAddress();
  if (!client) {
    return { delivered: false, error: "RESEND_API_KEY is not configured." };
  }
  if (!from) {
    return { delivered: false, error: "EMAIL_FROM is not configured." };
  }
  try {
    const { error } = await client.emails.send({ from, to, subject, text });
    if (error) {
      return { delivered: false, error: error.message };
    }
    return { delivered: true };
  } catch (error) {
    return { delivered: false, error: error instanceof Error ? error.message : "Resend could not send the email." };
  }
}

async function sendSlack(request: NotificationRequest, primaryRoom: string): Promise<DeliveryResult> {
  const urgencyLabel = request.isUrgent ? "URGENT: " : "";
  const slackUrl = process.env.SLACK_WEBHOOK_URL;
  if (!slackUrl) {
    return { delivered: false, error: "SLACK_WEBHOOK_URL is not configured." };
  }
  const lines = [
    `*${urgencyLabel}New WISE room request* - ${request.reference}`,
    `${request.team}: ${request.purpose}`,
    `${request.eventDate}, ${request.startTime}-${request.endTime} - ${request.attendees} attendees`,
    `Primary room: ${primaryRoom}`,
    ...(request.isUrgent ? request.urgencyReasons.map((reason) => `:rotating_light: ${reason}`) : []),
  ];
  try {
    const response = await fetch(slackUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: lines.join("\n") }),
    });
    if (!response.ok) {
      return { delivered: false, error: `Slack rejected the alert (${response.status}).` };
    }
    return { delivered: true };
  } catch (error) {
    return { delivered: false, error: error instanceof Error ? error.message : "Slack could not send the alert." };
  }
}

export async function notifyNewRequest(request: NotificationRequest, primaryRoom: string): Promise<{ email: DeliveryResult; slack: DeliveryResult }> {
  const [slack, email] = await Promise.all([
    sendSlack(request, primaryRoom),
    sendEmail(
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
    ),
  ]);
  return { email, slack };
}

export async function notifyStatusChange(
  request: Pick<NotificationRequest, "email" | "requesterName" | "reference">,
  status: BookingStatus,
): Promise<DeliveryResult> {
  const readableStatus: Record<BookingStatus, string> = {
    new: "New",
    in_review: "In review",
    submitted: "Submitted to booking office",
    booked: "Booked",
    needs_alternatives: "Needs alternatives",
    declined: "Declined",
  };
  return sendEmail(
    request.email,
    `WISE room request update - ${request.reference}`,
    `Hi ${request.requesterName},\n\nYour WISE room request (${request.reference}) is now: ${readableStatus[status]}.\n\nA coordinator will follow up if more information is needed.`,
  );
}
