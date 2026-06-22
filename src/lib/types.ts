export const WISE_TEAMS = [
  "PD",
  "Outreach",
  "Conference",
  "Finance",
  "Marketing",
  "Internal",
] as const;

export type WiseTeam = (typeof WISE_TEAMS)[number];
export type BookingSource = "sop" | "engsoc" | "wise" | "utsu" | "custom";
export type BookingStatus =
  | "new"
  | "in_review"
  | "submitted"
  | "booked"
  | "needs_alternatives"
  | "declined";

export type RoomPhoto = {
  id?: string;
  kind: "external" | "upload";
  url: string;
  storagePath?: string | null;
  altText: string;
  sortOrder: number;
};

export type Room = {
  id?: string;
  code: string;
  building: string;
  displayName: string;
  capacity: number | null;
  roomType: string;
  bookingSource: BookingSource;
  detailsUrl?: string | null;
  sourcePhotoUrl?: string | null;
  photos?: RoomPhoto[];
  tags?: string[];
  isActive: boolean;
};

export type RoomChoice = {
  roomCode?: string;
  customRoom?: string;
};

export type BookingRequestInput = {
  email: string;
  requesterName: string;
  team: WiseTeam;
  purpose: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  attendees: number;
  requiresAv: boolean;
  avDetails?: string;
  avAcknowledged: boolean;
  primaryChoice: RoomChoice;
  alternatives: RoomChoice[];
};

export type BookingRequestRecord = BookingRequestInput & {
  id: string;
  reference: string;
  status: BookingStatus;
  isUrgent: boolean;
  urgencyReasons: string[];
  avEstimateCents: number | null;
  createdAt: string;
};
