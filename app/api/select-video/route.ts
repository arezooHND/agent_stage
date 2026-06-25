import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { scene as defaultScene, type Scene } from "@/lib/scene";

export const runtime = "edge";

async function loadScene(): Promise<Scene> {
  try {
    const timeout = new Promise<null>(resolve => setTimeout(() => resolve(null), 800));
    const query = supabase.from("scenes").select("data").order("updated_at", { ascending: false }).limit(1).single();
    const result = await Promise.race([query, timeout]);
    if (!result) return defaultScene;
    const { data, error } = result as Awaited<typeof query>;
    if (error || !data) return defaultScene;
    return { ...defaultScene, ...(data as { data: Partial<Scene> }).data };
  } catch {
    return defaultScene;
  }
}

export async function POST(req: NextRequest) {
  const { botReply } = await req.json();
  const scene = await loadScene();

  const clipList = scene.videos
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

  if (!res.ok) return Response.json({ videoIndex: scene.videos.length });

  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content?.trim() ?? String(scene.videos.length);
  const parsed = parseInt(raw);
  const videoIndex = (!isNaN(parsed) && parsed >= 1 && parsed <= scene.videos.length)
    ? parsed
    : scene.videos.length;

  return Response.json({ videoIndex });
}
