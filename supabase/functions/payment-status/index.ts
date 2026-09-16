import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, json, secretKey } from "../_shared/common.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") return json({ error: "Método não permitido." }, 405);
  const registration = new URL(req.url).searchParams.get("registration") ?? "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(registration)) return json({ error: "Inscrição inválida." }, 400);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, secretKey(), { auth: { persistSession: false } });
  const { data, error } = await supabase.from("registrations").select("status").eq("id", registration).maybeSingle();
  if (error || !data) return json({ error: "Inscrição não encontrada." }, 404);
  return json({ status: data.status });
});
