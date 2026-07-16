import { NextRequest } from "next/server";
import pool from "@/lib/db";

export async function POST(req: NextRequest) {
  const scene = await req.json();
  const { name, characterName, systemPrompt, idleMessage, selectionPrompt,
          orientation, showBotText, idleVideoIndex, videos } = scene;

  if (!name) return Response.json({ error: "name required" }, { status: 400 });

  const slug = scene.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "my-scene";

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const agentResult = await client.query(
      `INSERT INTO agent (name, character_name, system_prompt, idle_message, selection_prompt, orientation, show_bot_text, idle_video_index, slug, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, now())
       ON CONFLICT (slug) DO UPDATE SET
         name = $1, character_name = $2, system_prompt = $3, idle_message = $4,
         selection_prompt = $5, orientation = $6, show_bot_text = $7, idle_video_index = $8, updated_at = now()
       RETURNING id, slug`,
      [name, characterName, systemPrompt, idleMessage, selectionPrompt, orientation, showBotText, idleVideoIndex, slug]
    );

    const agentId = agentResult.rows[0].id;

    await client.query("DELETE FROM videos WHERE agent_id = $1", [agentId]);

    for (const v of (videos ?? [])) {
      await client.query(
        `INSERT INTO videos (agent_id, video_order, label, description, file_path, trigger, includes_speech)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [agentId, v.index, v.label, v.description ?? null, v.url, v.trigger ?? null, v.includesSpeech ?? false]
      );
    }

    await client.query("COMMIT");
    return Response.json({ slug: agentResult.rows[0].slug });
  } catch (err) {
    await client.query("ROLLBACK");
    return Response.json({ error: err instanceof Error ? err.message : "save failed" }, { status: 500 });
  } finally {
    client.release();
  }
}
