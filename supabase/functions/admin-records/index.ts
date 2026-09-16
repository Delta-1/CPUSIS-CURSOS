import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { secretKey } from "../_shared/common.ts";
import { adminCors, adminJson, verifyAdminToken } from "../_shared/admin-auth.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: adminCors(req) });
  if (req.method !== "GET") return adminJson(req, { error: "Método não permitido." }, 405);
  const username = await verifyAdminToken(req);
  if (!username) return adminJson(req, { error: "Sessão inválida ou expirada." }, 401);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, secretKey(), { auth: { persistSession: false } });
  const { data, error } = await supabase
    .from("registrations")
    .select("id,company_name,cnpj,owner_name,owner_email,owner_phone,status,amount_cents,created_at,paid_at,participants(slot,full_name,cpf,email,phone)")
    .order("created_at", { ascending: false });
  if (error) {
    console.error(error);
    return adminJson(req, { error: "Não foi possível carregar os cadastros." }, 500);
  }
  return adminJson(req, { records: data ?? [], requested_by: username });
});
