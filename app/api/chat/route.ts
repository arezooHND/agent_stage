import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { scene as defaultScene, type Scene } from "@/lib/scene";

export const runtime = "edge";

const ALLOWED_MODELS = ["mistral-large-latest", "open-mistral-nemo"] as const;
type AllowedModel = (typeof ALLOWED_MODELS)[number];

async function loadScene(): Promise<Scene> {
  try {
    const timeout = new Promise<null>(resolve => setTimeout(() => resolve(null), 800));
    const query = supabase
      .from("scenes")
      .select("data")
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();

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
  const { messages, model } = await req.json();
  const scene = await loadScene();

  const selectedModel: AllowedModel = ALLOWED_MODELS.includes(model)
    ? model
    : "mistral-large-latest";

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
        { role: "system", content: scene.systemPrompt },
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
