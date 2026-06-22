import type { BookingStatus } from "@/lib/types";

export const BOOKING_STATUSES: BookingStatus[] = ["new", "in_review", "submitted", "booked", "needs_alternatives", "declined"];

const statusLabels: Record<BookingStatus, string> = {
  new: "Not started",
  in_review: "In progress",
  submitted: "Submitted to booking office",
  booked: "Booked",
  needs_alternatives: "Needs alternatives",
  declined: "Declined",
};

export function bookingStatusLabel(status: BookingStatus): string {
  return statusLabels[status];
}

export function isInProgressStatus(status: BookingStatus): boolean {
  return status === "in_review" || status === "needs_alternatives";
}

export function isResolvedForCoordinator(status: BookingStatus): boolean {
  return status === "submitted" || status === "booked" || status === "declined";
}

export function shouldClearUrgency(status: BookingStatus): boolean {
  return isResolvedForCoordinator(status);
}

export type RequestFilter = "all" | "in_progress" | BookingStatus;

export function matchesRequestFilter(status: BookingStatus, filter: RequestFilter): boolean {
  return filter === "all" || (filter === "in_progress" ? isInProgressStatus(status) : status === filter);
}

export function requestPriority(status: BookingStatus): number {
  if (isInProgressStatus(status)) {
    return 0;
  }
  if (status === "new") {
    return 1;
  }
  if (status === "submitted") {
    return 2;
  }
  return 3;
}
