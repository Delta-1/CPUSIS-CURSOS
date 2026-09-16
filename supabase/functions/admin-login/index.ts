import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { adminCors, adminJson, issueAdminToken, passwordMatches } from "../_shared/admin-auth.ts";

const allowedUsers = new Set(["victor", "jose", "cpusis"]);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: adminCors(req) });
  if (req.method !== "POST") return adminJson(req, { error: "Método não permitido." }, 405);

  const configuredPassword = Deno.env.get("ADMIN_PASSWORD");
  if (!configuredPassword) return adminJson(req, { error: "Acesso administrativo ainda não configurado." }, 503);

  const body = await req.json().catch(() => ({}));
  const username = String(body.username ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  if (!allowedUsers.has(username) || !await passwordMatches(password, configuredPassword)) {
    await new Promise((resolve) => setTimeout(resolve, 900));
    return adminJson(req, { error: "Nome ou senha incorretos." }, 401);
  }

  return adminJson(req, { token: await issueAdminToken(username), username, expires_in: 28800 });
});
