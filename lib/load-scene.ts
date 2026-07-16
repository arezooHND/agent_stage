import pool from "@/lib/db";
import { toScene } from "@/lib/scene-mapper";
import { scene as defaultScene, type Scene } from "@/lib/scene";

// Best-effort scene load for chat/select-video — always falls back to defaultScene on any failure
export async function loadScene(): Promise<Scene> {
  try {
    const agentResult = await pool.query("SELECT * FROM agent ORDER BY updated_at DESC LIMIT 1");
    if (agentResult.rows.length === 0) return defaultScene;
    const agent = agentResult.rows[0];
    const videosResult = await pool.query(
      "SELECT video_order, label, description, file_path, trigger, includes_speech FROM videos WHERE agent_id = $1 ORDER BY video_order ASC",
      [agent.id]
    );
    return { ...defaultScene, ...toScene(agent, videosResult.rows) };
  } catch {
    return defaultScene;
  }
}