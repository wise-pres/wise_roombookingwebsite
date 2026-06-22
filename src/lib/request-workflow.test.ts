import { describe, expect, it } from "vitest";

import { isInProgressStatus, matchesRequestFilter, shouldClearUrgency } from "@/lib/request-workflow";

describe("request workflow", () => {
  it("keeps active coordinator work in the in-progress filter", () => {
    expect(isInProgressStatus("in_review")).toBe(true);
    expect(isInProgressStatus("needs_alternatives")).toBe(true);
    expect(matchesRequestFilter("submitted", "in_progress")).toBe(false);
    expect(matchesRequestFilter("declined", "in_progress")).toBe(false);
  });

  it("clears urgency once WISE no longer needs to act", () => {
    expect(shouldClearUrgency("submitted")).toBe(true);
    expect(shouldClearUrgency("booked")).toBe(true);
    expect(shouldClearUrgency("declined")).toBe(true);
    expect(shouldClearUrgency("in_review")).toBe(false);
  });
});
