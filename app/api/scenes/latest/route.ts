import { supabase } from "@/lib/supabase";

export async function GET() {
  const { data, error } = await supabase
    .from("scenes")
    .select("data")
    .order("updated_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json(data.data);
}