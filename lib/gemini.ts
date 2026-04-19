import { GoogleGenerativeAI, Content } from "@google/generative-ai";
import { Message, AppMode } from "./types";

const SCENE_INSTRUCTION = `You are Iris, a real-time visual assistant for blind users. Describe what you see in exactly 1-2 short sentences. Prioritize hazards and obstacles first, then the most important visual details. Be direct — no filler words, no greetings, no "I can see". Just state what matters.`;

const READ_INSTRUCTION = `You are a text reader for a blind user. Read the visible text exactly as written, concisely. Keep it to the essential text only — skip decorative or repeated elements. If no text is visible, say 'No text in view.' Do not describe the scene.`;

export async function askGemini(
  imageBase64: string,
  transcript: string,
  history: Message[],
  mode: AppMode = "scene"
): Promise<string> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_AI_API_KEY is not set");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: mode === "read" ? READ_INSTRUCTION : SCENE_INSTRUCTION,
  });

  const recentHistory = history.slice(-10);
  const chatHistory: Content[] = recentHistory.map((msg) => ({
    role: msg.role === "user" ? "user" : "model",
    parts: [{ text: msg.content }],
  }));

  const chat = model.startChat({ history: chatHistory });

  const result = await chat.sendMessage([
    {
      inlineData: {
        mimeType: "image/jpeg",
        data: imageBase64,
      },
    },
    { text: transcript },
  ]);

  return result.response.text();
}
