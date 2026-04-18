import { GoogleGenerativeAI, Content } from "@google/generative-ai";
import { Message, AppMode } from "./types";

const SCENE_INSTRUCTION = `You are SceneSpeak, a real-time visual assistant for blind and visually impaired users. A user is pointing their phone camera at something and asking you about it. Describe what you see clearly, concisely, and helpfully. Focus on: spatial relationships, text/signage, people, obstacles, colors, and anything safety-relevant. Keep responses under 3 sentences unless the user asks for more detail. Be warm but efficient. If you see potential hazards (stairs, curbs, obstacles in path), mention them first.`;

const READ_INSTRUCTION = `You are a text reader for a blind user. They are pointing their camera at something with text on it. Read ALL visible text exactly as written — signs, labels, menus, documents, screens, receipts, anything with words. Read it clearly and in order, top to bottom, left to right. If there are multiple sections, pause briefly between them. If no text is visible, say 'I don't see any text in view. Try moving your camera closer or adjusting the angle.' Do not describe the scene — only read the text.`;

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
