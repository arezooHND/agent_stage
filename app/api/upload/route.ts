import { NextRequest } from "next/server";
import { writeFile } from "fs/promises";
import path from "path";
import pool from "@/lib/db";

const VIDEO_DIR = path.join(process.cwd(), "public", "videos");

// POST /api/upload — save a video file to disk on this server and record it in Postgres
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) return Response.json({ error: "no file" }, { status: 400 });

  // Unique filename: timestamp + original name to avoid collisions
  const filename = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const publicPath = `/videos/${filename}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(VIDEO_DIR, filename), buffer);

  try {
    // There's currently one scene, so reuse its agent row (create it once if missing)
    let agentResult = await pool.query("SELECT id FROM agent ORDER BY id LIMIT 1");
    let agentId: number;
    if (agentResult.rows.length === 0) {
      const inserted = await pool.query(
        `INSERT INTO agent (name, character_name, system_prompt, idle_message, orientation, show_bot_text, slug)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        ["Default Scene", "Mira", "", "", "auto", true, "default"],
      );
      agentId = inserted.rows[0].id;
    } else {
      agentId = agentResult.rows[0].id;
    }

    const orderResult = await pool.query(
      "SELECT COALESCE(MAX(video_order), 0) + 1 AS next_order FROM videos WHERE agent_id = $1",
      [agentId],
    );

    await pool.query(
      `INSERT INTO videos (agent_id, video_order, label, file_path)
       VALUES ($1, $2, $3, $4)`,
      [agentId, orderResult.rows[0].next_order, file.name, publicPath],
    );
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "db insert failed" },
      { status: 500 },
    );
  }

  return Response.json({ url: publicPath, filename });
}