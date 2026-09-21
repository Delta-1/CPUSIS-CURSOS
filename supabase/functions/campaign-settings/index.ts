import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { secretKey } from "../_shared/common.ts";
import { adminCors, adminJson, verifyAdminToken } from "../_shared/admin-auth.ts";

const settingId = "courses_2026";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: adminCors(req) });
  if (!['GET', 'PUT'].includes(req.method)) return adminJson(req, { error: "Método não permitido." }, 405);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, secretKey(), { auth: { persistSession: false } });

  if (req.method === "PUT") {
    const username = await verifyAdminToken(req);
    if (!username) return adminJson(req, { error: "Sessão inválida ou expirada." }, 401);

    const body = await req.json().catch(() => ({}));
    const deadline = new Date(String(body.enrollment_deadline ?? ""));
    const year = deadline.getUTCFullYear();
    if (Number.isNaN(deadline.getTime()) || year < 2026 || year > 2035) {
      return adminJson(req, { error: "Informe uma data e um horário válidos." }, 400);
    }
    if (typeof body.countdown_enabled !== "boolean") {
      return adminJson(req, { error: "Informe se o contador deve ser exibido." }, 400);
    }

    const { error } = await supabase.from("campaign_settings").update({
      enrollment_deadline: deadline.toISOString(),
      countdown_enabled: body.countdown_enabled,
      updated_at: new Date().toISOString(),
      updated_by: username,
    }).eq("id", settingId);
    if (error) {
      console.error(error);
      return adminJson(req, { error: "Não foi possível salvar o contador." }, 500);
    }
  }

  const { data, error } = await supabase
    .from("campaign_settings")
    .select("enrollment_deadline,countdown_enabled,timezone,updated_at")
    .eq("id", settingId)
    .single();
  if (error || !data) {
    console.error(error);
    return adminJson(req, { error: "Configuração do contador não encontrada." }, 500);
  }
  return adminJson(req, { settings: data });
});
