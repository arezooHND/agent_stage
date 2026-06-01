import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";

// POST /api/scenes — create or update a scene by slug
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, ...rest } = body;

  if (!name) return Response.json({ error: "name required" }, { status: 400 });

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "my-scene";

  const { data, error } = await supabase
    .from("scenes")
    .upsert({ slug, data: body }, { onConflict: "slug" })
    .select("slug")
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ slug: data.slug });
}
