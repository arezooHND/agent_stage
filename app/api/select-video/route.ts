// Import Next.js server-side request type for type safety
import { NextRequest } from "next/server";

// Import scene config to access the video selection rules (selectionPrompt)
import { scene } from "@/lib/scene";

// Run on Vercel Edge Runtime — same as /api/chat for consistency and speed
export const runtime = "edge";

// Handle POST requests to /api/select-video
// Called in parallel with speaking — picks which video clip matches the bot reply
export async function POST(req: NextRequest) {
  // Parse the request body — expects { botReply: string }
  // botReply is the complete text the chatbot just said
  const { botReply } = await req.json();

  // Build the prompt by combining the creator's selection rules with the bot reply
  // The rules explain what each video number means (e.g. "1 = explaining artwork")
  // Mistral reads both and returns only a single digit
  const prompt = `${scene.selectionPrompt}

Chatbot reply: "${botReply}"`;

  // Call Mistral to classify which video best matches the reply
  const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      // Same API key as /api/chat — kept server-side only
      Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      // Same model as the chat route for consistency
      model: "mistral-small-latest",

      // stream: false — we need the complete response before returning
      // Unlike the chat route, we can't use a partial number
      stream: false,

      // max_tokens: 3 — the response should be a single digit like "1" or "2"
      // Limiting tokens makes this call very fast (typically under 200ms)
      max_tokens: 3,

      // Single user message — no system prompt needed, the rules are in the prompt itself
      messages: [{ role: "user", content: prompt }],
    }),
  });

  // If Mistral fails, fall back to video 5 (neutral/default)
  // This ensures the video player always has something to show
  if (!res.ok) {
    return Response.json({ videoIndex: 5 }); // fallback to neutral
  }

  // Parse the full JSON response from Mistral
  const data = await res.json();

  // Extract the text content from the response, defaulting to "5" if missing
  // Example response: { choices: [{ message: { content: "1" } }] }
  const raw = data.choices?.[0]?.message?.content?.trim() ?? "5";

  // Parse the digit and clamp it to valid range (1 to number of videos)
  // parseInt("1") = 1, parseInt("abc") = NaN → fallback to 5
  // Math.min/max ensures we never get an index outside the video array
  const videoIndex = Math.min(Math.max(parseInt(raw) || 5, 1), scene.videos.length);

  // Return the selected video index to the browser
  // The consumer page uses this to swap the <video> element's src
  return Response.json({ videoIndex });
}
