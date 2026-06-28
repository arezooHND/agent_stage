import { supabase } from "@/lib/supabase";

export async function GET() {
  try {
    const timeout = new Promise<null>(resolve => setTimeout(() => resolve(null), 800));
    const query = supabase.from("scenes").select("data").order("updated_at", { ascending: false }).limit(1).single();
    const result = await Promise.race([query, timeout]);
    if (!result) return Response.json({ error: "not found" }, { status: 404 });
    const { data, error } = result as Awaited<typeof query>;
    if (error || !data) return Response.json({ error: "not found" }, { status: 404 });
    return Response.json((data as { data: unknown }).data);
  } catch {
    return Response.json({ error: "not found" }, { status: 404 });
  }
}
