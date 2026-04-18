export interface Message {
  role: "user" | "assistant";
  content: string;
}

export type AppState = "idle" | "listening" | "thinking" | "speaking";

export interface AskRequest {
  image: string;
  transcript: string;
  history: Message[];
}
