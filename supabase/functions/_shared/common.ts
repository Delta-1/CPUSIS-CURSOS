export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export function json(body: unknown, status = 200, cors = true) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...(cors ? corsHeaders : {}),
    },
  });
}

export function digits(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

export function secretKey() {
  const modern = Deno.env.get("SUPABASE_SECRET_KEY");
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!modern && !legacy) throw new Error("Supabase secret key is not configured");
  return modern ?? legacy!;
}
