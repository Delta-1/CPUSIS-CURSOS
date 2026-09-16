import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { json, secretKey } from "../_shared/common.ts";

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let index = 0; index < a.length; index += 1) result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return result === 0;
}

async function validSignature(signature: string, requestId: string, dataId: string, secret: string) {
  const parts = Object.fromEntries(signature.split(",").map((part) => part.split("=").map((value) => value.trim())));
  if (!parts.ts || !parts.v1) return false;
  const manifest = `id:${dataId};request-id:${requestId};ts:${parts.ts};`;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(manifest));
  const expected = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return safeEqual(expected, parts.v1);
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ ok: true }, 200, false);
  try {
    const body = await req.json().catch(() => ({}));
    const url = new URL(req.url);
    const dataId = String(url.searchParams.get("data.id") ?? body?.data?.id ?? "").toLowerCase();
    const signature = req.headers.get("x-signature") ?? "";
    const requestId = req.headers.get("x-request-id") ?? "";
    const webhookSecret = Deno.env.get("MERCADO_PAGO_WEBHOOK_SECRET") ?? "";
    if (!dataId || !webhookSecret || !await validSignature(signature, requestId, dataId, webhookSecret)) {
      return json({ error: "Assinatura inválida." }, 401, false);
    }

    const accessToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN")!;
    const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(dataId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!paymentResponse.ok) throw new Error("Pagamento não encontrado no Mercado Pago.");
    const payment = await paymentResponse.json();
    const registrationId = String(payment.external_reference ?? "");
    if (!registrationId || payment.currency_id !== "BRL" || Number(payment.transaction_amount) !== 872.55) {
      throw new Error("Dados do pagamento não correspondem à inscrição.");
    }

    const statusMap: Record<string, string> = {
      approved: "paid",
      pending: "payment_pending",
      in_process: "payment_pending",
      rejected: "failed",
      cancelled: "cancelled",
      refunded: "refunded",
      charged_back: "refunded",
    };
    const status = statusMap[payment.status] ?? "payment_pending";
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, secretKey(), { auth: { persistSession: false } });
    const update: Record<string, unknown> = {
      status,
      mercado_pago_payment_id: String(payment.id),
      updated_at: new Date().toISOString(),
    };
    if (status === "paid") update.paid_at = payment.date_approved ?? new Date().toISOString();
    const { error } = await supabase.from("registrations").update(update).eq("id", registrationId).eq("amount_cents", 87255);
    if (error) throw error;
    return json({ ok: true }, 200, false);
  } catch (error) {
    console.error(error);
    return json({ error: "Não foi possível processar a notificação." }, 500, false);
  }
});
