import { NextRequest } from "next/server";
import { loadScene } from "@/lib/load-scene";

const ALLOWED_MODELS = ["mistral-large-latest", "open-mistral-nemo"] as const;
type AllowedModel = (typeof ALLOWED_MODELS)[number];

export async function POST(req: NextRequest) {
  const { messages, model } = await req.json();
  const scene = await loadScene();

  const selectedModel: AllowedModel = ALLOWED_MODELS.includes(model)
    ? model
    : "mistral-large-latest";

  // Clips that aren't entering/leaving triggers and have a description are
  // eligible to be offered to the visitor (e.g. real student project videos).
  const offerableVideos = scene.videos.filter((v) => !v.trigger && v.description);
  const videoListPrompt = offerableVideos.length
    ? `

You have access to these real student project videos:
${offerableVideos.map((v) => `${v.index}. ${v.description}`).join("\n")}

If one of these is clearly relevant to what the visitor just asked about, ask permission before showing it — mention the student name, subject, or date if the description includes them. Never play it automatically.
When you ask this kind of permission question, end your reply with the exact marker [[OFFER:<index>]] (using that clip's number) and nothing after it. Never explain or mention this marker to the visitor.
If nothing is relevant, don't use the marker at all.`
    : "";

  const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: selectedModel,
      stream: true,
      max_tokens: 80,
      messages: [
        { role: "system", content: scene.systemPrompt + videoListPrompt },
        ...messages,
      ],
    }),
  });

  if (!res.ok) {
    return new Response("Mistral API error", { status: 502 });
  }

  return new Response(res.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Model": selectedModel,
    },
  });
}