import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";

// POST /api/upload — receive a video file, store in Supabase Storage, return URL
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) return Response.json({ error: "no file" }, { status: 400 });

  // Unique filename: timestamp + original name to avoid collisions
  const filename = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

  const arrayBuffer = await file.arrayBuffer();

  const { error } = await supabase.storage
    .from("videos")
    .upload(filename, arrayBuffer, { contentType: file.type, upsert: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });

  const { data: urlData } = supabase.storage.from("videos").getPublicUrl(filename);

  return Response.json({ url: urlData.publicUrl, filename });
}
