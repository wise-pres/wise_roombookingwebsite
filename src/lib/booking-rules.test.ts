import { describe, expect, it } from "vitest";

import { calculateAvEstimate, getUrgencyReasons } from "@/lib/booking-rules";
import { recommendRooms } from "@/lib/catalog";
import type { Room } from "@/lib/types";

const sopRoom: Room = {
  code: "BA1130",
  building: "Bahen",
  displayName: "BA1130",
  capacity: 160,
  roomType: "Classroom",
  bookingSource: "sop",
  isActive: true,
};

const utsuRoom: Room = {
  code: "UTSU-5F-LOUNGE",
  building: "UTSU Student Commons",
  displayName: "UTSU Student Commons fifth-floor lounge",
  capacity: null,
  roomType: "Lounge",
  bookingSource: "utsu",
  isActive: true,
};

describe("booking rules", () => {
  it("marks short-notice and restricted UTSU requests as urgent", () => {
    const reasons = getUrgencyReasons("2026-06-22", "18:00", "19:00", [utsuRoom], new Date("2026-06-21T16:00:00Z"));
    expect(reasons).toEqual([
      "The requested date is less than seven days away.",
      "UTSU Student Commons rooms are unavailable Monday and Tuesday from 5:00 PM to 9:00 PM.",
    ]);
  });

  it("uses the SOP weekday and weekend AV rates", () => {
    expect(calculateAvEstimate(true, "2026-06-22", sopRoom)).toBe(2050);
    expect(calculateAvEstimate(true, "2026-06-21", sopRoom)).toBe(8250);
    expect(calculateAvEstimate(true, "2026-06-22", utsuRoom)).toBeNull();
  });

  it("orders recommended rooms by closest usable capacity", () => {
    const results = recommendRooms(
      [
        { ...sopRoom, code: "LARGE", capacity: 100 },
        { ...sopRoom, code: "CLOSE", capacity: 25 },
        { ...sopRoom, code: "SMALL", capacity: 20 },
      ],
      22,
    );
    expect(results.map((room) => room.code)).toEqual(["CLOSE", "LARGE"]);
  });
});
