import { NextRequest } from "next/server";
import pool from "@/lib/db";
import { toScene } from "@/lib/scene-mapper";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const agentResult = await pool.query("SELECT * FROM agent WHERE slug = $1", [slug]);
  if (agentResult.rows.length === 0) return Response.json({ error: "not found" }, { status: 404 });

  const agent = agentResult.rows[0];
  const videosResult = await pool.query(
    "SELECT video_order, label, description, file_path, trigger, includes_speech FROM videos WHERE agent_id = $1 ORDER BY video_order ASC",
    [agent.id]
  );

  return Response.json(toScene(agent, videosResult.rows));
}
