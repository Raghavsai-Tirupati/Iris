import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const HISTORY_FILE = path.join(process.cwd(), "data", "history.json");

export interface HistoryEntry {
  id: string;
  timestamp: number;
  transcript: string;
  response: string;
  mode: string;
}

function readHistory(): HistoryEntry[] {
  try {
    const raw = fs.readFileSync(HISTORY_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function GET() {
  return NextResponse.json(readHistory());
}
