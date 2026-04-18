import { NextRequest, NextResponse } from "next/server";
import { askGemini } from "@/lib/gemini";
import { synthesizeSpeech } from "@/lib/tts";
import { AskRequest } from "@/lib/types";

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
