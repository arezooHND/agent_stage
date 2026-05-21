// Import Next.js server-side request type for type safety
import { NextRequest } from "next/server";

// Import the hardcoded scene config to access the system prompt
import { scene } from "@/lib/scene";

// Run this route on Vercel's Edge Runtime (faster cold starts, global CDN)
// This also means the MISTRAL_API_KEY env var is read at request time, not build time
export const runtime = "edge";

// Handle POST requests to /api/chat
// Called by the consumer page every time the visitor says something
export async function POST(req: NextRequest) {
  // Parse the request body — expects { messages: Message[] }
  // messages is the full conversation history so Mistral has context
  const { messages } = await req.json();

  // Forward the request to Mistral's chat completions endpoint
  const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      // API key lives in the environment variable — never sent to the browser
      Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      // The model to use — mistral-small is fast and cheap, good for real-time voice
      model: "mistral-small-latest",

      // stream: true — Mistral sends tokens one by one as they're generated
      // This lets the browser display the reply word-by-word instead of waiting
      stream: true,

      // Limit reply length — voice replies should be short (2-3 sentences)
      max_tokens: 150,

      messages: [
        // System prompt goes first — tells Mistral who Mira is and how to behave
        // This is prepended server-side so the client never needs to send it
        { role: "system", content: scene.systemPrompt },

        // Spread the full conversation history after the system prompt
        // This gives Mistral context from previous turns in the conversation
        ...messages,
      ],
    }),
  });

  // If Mistral returns an error (e.g. bad API key, quota exceeded), return 502
  // The consumer page catches this and stays in "thinking" phase
  if (!res.ok) {
    return new Response("Mistral API error", { status: 502 });
  }

  // Pipe Mistral's streaming response body directly back to the browser
  // We don't buffer or parse it here — the browser reads the SSE stream directly
  return new Response(res.body, {
    headers: {
      // Tell the browser this is a Server-Sent Events stream
      "Content-Type": "text/event-stream",

      // Disable caching — each response is unique and must not be cached
      "Cache-Control": "no-cache",
    },
  });
}
