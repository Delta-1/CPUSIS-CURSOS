import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, digits, json, secretKey } from "../_shared/common.ts";

type RegistrationPayload = Record<string, string>;

function validate(input: RegistrationPayload) {
  const required = [
    "company_name", "cnpj", "owner_name", "owner_email", "owner_phone",
    "employee1_name", "employee1_cpf", "employee1_email", "employee1_phone",
    "employee2_name", "employee2_cpf", "employee2_email", "employee2_phone",
  ];
  if (required.some((field) => !String(input[field] ?? "").trim())) throw new Error("Preencha todos os campos obrigatórios.");
  if (digits(input.cnpj).length !== 14) throw new Error("Informe um CNPJ válido.");
  if ([input.employee1_cpf, input.employee2_cpf].some((cpf) => digits(cpf).length !== 11)) throw new Error("Informe os CPFs corretamente.");
  if ([input.owner_phone, input.employee1_phone, input.employee2_phone].some((phone) => !/^\d{10,11}$/.test(digits(phone)))) throw new Error("Informe os telefones com DDD.");
  if ([input.owner_email, input.employee1_email, input.employee2_email].some((email) => !/^\S+@\S+\.\S+$/.test(email))) throw new Error("Informe endereços de e-mail válidos.");
}

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
  return "Não foi possível criar o pagamento. Tente novamente.";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  try {
    const input = await req.json() as RegistrationPayload;
    validate(input);

    const accessToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
    if (!accessToken) throw new Error("Mercado Pago ainda não foi configurado.");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, secretKey(), { auth: { persistSession: false } });
    const { data: registration, error: registrationError } = await supabase
      .from("registrations")
      .insert({
        company_name: input.company_name.trim(),
        cnpj: digits(input.cnpj),
        owner_name: input.owner_name.trim(),
        owner_email: input.owner_email.trim().toLowerCase(),
        owner_phone: digits(input.owner_phone),
      })
      .select("id")
      .single();
    if (registrationError) throw registrationError;

    const participants = [1, 2].map((slot) => ({
      registration_id: registration.id,
      slot,
      full_name: input[`employee${slot}_name`].trim(),
      cpf: digits(input[`employee${slot}_cpf`]),
      email: input[`employee${slot}_email`].trim().toLowerCase(),
      phone: digits(input[`employee${slot}_phone`]),
    }));
    const { error: participantError } = await supabase.from("participants").insert(participants);
    if (participantError) {
      await supabase.from("registrations").delete().eq("id", registration.id);
      throw participantError;
    }

    const siteUrl = (Deno.env.get("SITE_URL") ?? "https://delta-1.github.io/CPUSIS-CURSOS/").replace(/\/$/, "");

    const preferenceResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": registration.id,
      },
      body: JSON.stringify({
        items: [{
          id: "cpusis-pacote-cursos-2026",
          title: "Pacote CPUSIS — 8 cursos fiscais",
          description: "Acesso para dois funcionários por CNPJ, incluindo curso bônus.",
          quantity: 1,
          currency_id: "BRL",
          unit_price: 872.55,
        }],
        payer: { name: input.owner_name.trim(), email: input.owner_email.trim().toLowerCase() },
        external_reference: registration.id,
        back_urls: {
          success: `${siteUrl}/?payment=success&registration=${registration.id}`,
          pending: `${siteUrl}/?payment=pending&registration=${registration.id}`,
          failure: `${siteUrl}/?payment=failure&registration=${registration.id}`,
        },
        auto_return: "approved",
        notification_url: `${supabaseUrl}/functions/v1/mercadopago-webhook`,
        payment_methods: { installments: 4 },
        statement_descriptor: "CPUSIS CURSOS",
      }),
    });
    const preference = await preferenceResponse.json();
    if (!preferenceResponse.ok) throw new Error(preference.message ?? "Não foi possível criar o pagamento.");

    await supabase.from("registrations").update({
      mercado_pago_preference_id: preference.id,
      updated_at: new Date().toISOString(),
    }).eq("id", registration.id);

    const sandbox = Deno.env.get("MP_ENV") !== "production";
    return json({
      registration_id: registration.id,
      checkout_url: sandbox ? preference.sandbox_init_point : preference.init_point,
    });
  } catch (error) {
    console.error(error);
    return json({ error: errorMessage(error) }, 400);
  }
});
