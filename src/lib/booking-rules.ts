import type { Room } from "@/lib/types";

const WEEKDAY_AV_COST_CENTS = 2050;
const WEEKEND_AV_COST_CENTS = 8250;

function utcDayForDate(date: string): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

function daysBetween(firstDate: string, secondDate: string): number {
  const first = Date.parse(`${firstDate}T00:00:00Z`);
  const second = Date.parse(`${secondDate}T00:00:00Z`);
  return Math.floor((first - second) / 86_400_000);
}

function torontoDate(now: Date): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const pieces = Object.fromEntries(
    formatter.formatToParts(now).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]),
  );
  return `${pieces.year}-${pieces.month}-${pieces.day}`;
}

function overlapsRestrictedUtsuHours(startTime: string, endTime: string): boolean {
  return startTime < "21:00" && endTime > "17:00";
}

export function getUrgencyReasons(
  eventDate: string,
  startTime: string,
  endTime: string,
  selectedRooms: Array<Room | undefined>,
  now = new Date(),
): string[] {
  const reasons: string[] = [];
  const noticeDays = daysBetween(eventDate, torontoDate(now));

  if (noticeDays < 7) {
    reasons.push("The requested date is less than seven days away.");
  }

  const containsUtsuRoom = selectedRooms.some((room) => room?.bookingSource === "utsu");
  if (containsUtsuRoom) {
    const day = utcDayForDate(eventDate);
    if (day === 0 || day === 6) {
      reasons.push("UTSU Student Commons rooms are unavailable on weekends.");
    } else if ((day === 1 || day === 2) && overlapsRestrictedUtsuHours(startTime, endTime)) {
      reasons.push("UTSU Student Commons rooms are unavailable Monday and Tuesday from 5:00 PM to 9:00 PM.");
    }
  }

  return reasons;
}

export function calculateAvEstimate(requiresAv: boolean, eventDate: string, room?: Room): number | null {
  if (!requiresAv || room?.bookingSource !== "sop") {
    return null;
  }

  const day = utcDayForDate(eventDate);
  return day === 0 || day === 6 ? WEEKEND_AV_COST_CENTS : WEEKDAY_AV_COST_CENTS;
}

export function formatAvEstimate(cents: number | null): string | null {
  if (cents === null) {
    return null;
  }
  return `$${(cents / 100).toFixed(2)} + tax`;
}
