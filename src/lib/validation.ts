import { z } from "zod";

import { WISE_TEAMS, type BookingRequestInput } from "@/lib/types";

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

const roomChoiceSchema = z
  .object({
    roomCode: z.string().trim().min(1).max(80).optional(),
    customRoom: z.string().trim().min(2).max(160).optional(),
  })
  .superRefine((value, context) => {
    if (!value.roomCode && !value.customRoom) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Choose a room or enter a custom room." });
    }
    if (value.roomCode && value.customRoom) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "A room choice cannot be both catalogue and custom." });
    }
  });

export const bookingRequestSchema = z
  .object({
    email: z.string().trim().email().max(254),
    requesterName: z.string().trim().min(2).max(100),
    team: z.enum(WISE_TEAMS),
    purpose: z.string().trim().min(3).max(240),
    eventDate: z.string().regex(datePattern),
    startTime: z.string().regex(timePattern),
    endTime: z.string().regex(timePattern),
    attendees: z.coerce.number().int().min(1).max(2000),
    requiresAv: z.boolean(),
    avDetails: z.string().trim().max(1000).optional(),
    avAcknowledged: z.boolean(),
    primaryChoice: roomChoiceSchema,
    alternatives: z.array(roomChoiceSchema).max(3),
    turnstileToken: z.string().trim().max(4096).optional(),
  })
  .superRefine((value, context) => {
    if (value.endTime <= value.startTime) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["endTime"], message: "End time must be later than start time." });
    }
  });

export function parseBookingRequest(value: unknown): BookingRequestInput {
  return bookingRequestSchema.parse(value);
}
