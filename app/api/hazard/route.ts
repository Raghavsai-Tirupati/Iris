import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const HAZARDS_FILE = path.join(process.cwd(), "data", "hazards.json");

interface Hazard {
  id: string;
  latitude: number;
  longitude: number;
  description: string;
  timestamp: number;
}

function readHazards(): Hazard[] {
  try {
    const raw = fs.readFileSync(HAZARDS_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeHazards(hazards: Hazard[]) {
  fs.writeFileSync(HAZARDS_FILE, JSON.stringify(hazards, null, 2));
}

export async function GET() {
  return NextResponse.json(readHazards());
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { latitude, longitude, description, timestamp } = body;

    if (typeof latitude !== "number" || typeof longitude !== "number" || !description) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const hazard: Hazard = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      latitude,
      longitude,
      description,
      timestamp: timestamp || Date.now(),
    };

    const hazards = readHazards();
    hazards.push(hazard);
    writeHazards(hazards);

    return NextResponse.json({ ok: true, id: hazard.id });
  } catch {
    return NextResponse.json({ error: "Failed to save hazard" }, { status: 500 });
  }
}
