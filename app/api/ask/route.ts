import { NextRequest, NextResponse } from "next/server";
import { askGemini } from "@/lib/gemini";
import { synthesizeSpeech } from "@/lib/tts";
import { AskRequest } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const body: AskRequest = await request.json();
    const { image, transcript, history } = body;

    if (!image || !transcript) {
      return NextResponse.json(
        { error: "Missing image or transcript" },
        { status: 400 }
      );
    }

    // 1. Get response from Gemini
    const responseText = await askGemini(image, transcript, history || []);

    // 2. Try to convert to speech via ElevenLabs
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
      // Fallback: return text for browser TTS
      console.error("TTS failed, falling back to browser speech:", ttsError);
      return NextResponse.json({
        text: responseText,
        fallback: true,
      });
    }
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
