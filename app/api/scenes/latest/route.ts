import pool from "@/lib/db";
import { toScene } from "@/lib/scene-mapper";

export async function GET() {
  try {
    const agentResult = await pool.query("SELECT * FROM agent ORDER BY updated_at DESC LIMIT 1");
    if (agentResult.rows.length === 0) return Response.json({ error: "not found" }, { status: 404 });

    const agent = agentResult.rows[0];
    const videosResult = await pool.query(
      "SELECT video_order, label, description, file_path, trigger, includes_speech FROM videos WHERE agent_id = $1 ORDER BY video_order ASC",
      [agent.id]
    );

    return Response.json(toScene(agent, videosResult.rows));
  } catch {
    return Response.json({ error: "not found" }, { status: 404 });
  }
}
