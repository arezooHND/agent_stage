import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { scene as defaultScene, type Scene } from "@/lib/scene";

export const runtime = "edge";

async function loadScene(): Promise<Scene> {
  try {
    const { data, error } = await supabase
      .from("scenes")
      .select("data")
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();
    if (error || !data) return defaultScene;
    return { ...defaultScene, ...data.data };
  } catch {
    return defaultScene;
  }
}

export async function POST(req: NextRequest) {
  const { messages } = await req.json();
  const scene = await loadScene();

  const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "mistral-small-latest",
      stream: true,
      max_tokens: 150,
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
    },
  });
}