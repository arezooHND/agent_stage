import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";

// GET /api/scenes/[slug] — load a scene by slug
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const { data, error } = await supabase
    .from("scenes")
    .select("data")
    .eq("slug", slug)
    .single();

  if (error || !data) return Response.json({ error: "not found" }, { status: 404 });

  return Response.json(data.data);
}
