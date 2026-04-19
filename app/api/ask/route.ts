import { NextRequest, NextResponse } from "next/server";
import { askGemini } from "@/lib/gemini";
import { synthesizeSpeech } from "@/lib/tts";
import { AskRequest } from "@/lib/types";
import fs from "fs";
import path from "path";

const HISTORY_FILE = path.join(process.cwd(), "data", "history.json");

function appendHistory(transcript: string, response: string, mode: string) {
  let history: unknown[] = [];
  try {
    history = JSON.parse(fs.readFileSync(HISTORY_FILE, "utf-8"));
  } catch { /* file doesn't exist yet */ }
  history.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    transcript,
    response,
    mode,
  });
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
}

export async function POST(request: NextRequest) {
  try {
    const body: AskRequest = await request.json();
    const { image, transcript, history, mode } = body;

    if (!image || !transcript) {
      return NextResponse.json(
        { error: "Missing image or transcript" },
        { status: 400 }
      );
    }

    const responseText = await askGemini(image, transcript, history || [], mode || "scene");

    appendHistory(transcript, responseText, mode || "scene");

    try {
      const audioBuffer = await synthesizeSpeech(responseText);
      return new NextResponse(audioBuffer, {
        status: 200,
        headers: {
          "Content-Type": "audio/mpeg",
          "X-Response-Text": encodeURIComponent(responseText),
        },
      });
    } catch (ttsError) {
      console.error("TTS failed, falling back to browser speech:", ttsError);
      return NextResponse.json({
        text: responseText,
        fallback: true,
      });
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("API error:", errMsg);
    return NextResponse.json(
      { error: errMsg },
      { status: 500 }
    );
  }
}
