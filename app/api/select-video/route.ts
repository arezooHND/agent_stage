import { NextRequest } from "next/server";
import { loadScene } from "@/lib/load-scene";

export async function POST(req: NextRequest) {
  const { botReply } = await req.json();
  const scene = await loadScene();

  const selectableVideos = scene.videos.filter(v => !v.trigger);

  const clipList = selectableVideos
    .map(v => `${v.index} = ${v.description?.trim() || v.label}`)
    .join("\n");

  const prompt = `You are a video selector. Pick the clip that best matches the MAIN TOPIC of the reply.
Important rules:
- Ignore opening phrases like "Welcome!", "Great question!", "Sure!" — focus on what the reply is actually about.
- If the reply mentions ANY location, place, direction, or navigation (toilet, stairs, room, building, left, right, floor, door, hall, exit, entrance) → that is a directions reply.
- Reply with ONLY a single digit. No explanation, no punctuation.

Clips:
${clipList}

Reply to classify: "${botReply}"`;

  const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "mistral-small-latest",
      stream: false,
      max_tokens: 3,
      temperature: 0,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) return Response.json({ videoIndex: scene.idleVideoIndex });

  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content?.trim() ?? String(scene.idleVideoIndex);
  const parsed = parseInt(raw);
  const videoIndex = (!isNaN(parsed) && selectableVideos.some(v => v.index === parsed))
    ? parsed
    : scene.idleVideoIndex;

  return Response.json({ videoIndex });
}
