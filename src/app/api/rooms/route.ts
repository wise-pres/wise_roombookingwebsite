import { NextResponse } from "next/server";

import { seedRooms } from "@/lib/catalog";
import { listRooms } from "@/lib/server/repository";
import { hasSupabaseConfiguration } from "@/lib/server/supabase";

export async function GET() {
  try {
    const rooms = hasSupabaseConfiguration() ? await listRooms() : seedRooms;
    return NextResponse.json({ rooms });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Unable to load rooms." }, { status: 500 });
  }
}
