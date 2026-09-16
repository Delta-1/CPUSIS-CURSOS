# CPUSIS Cursos

Landing page de venda do pacote empresarial de cursos da CPUSIS, com cadastro da empresa e de dois funcionários por CNPJ, Checkout Pro do Mercado Pago e confirmação via webhook.

## Publicação do site

1. No GitHub, abra **Settings → Pages**.
2. Em **Build and deployment**, selecione **Deploy from a branch**.
3. Escolha a branch `main`, pasta `/ (root)` e salve.

## Configuração do Supabase

O backend deve ser publicado em um projeto Supabase exclusivo para esta campanha.

1. Aplique a migration em `supabase/migrations`.
2. Cadastre os Secrets das Edge Functions: `MERCADO_PAGO_ACCESS_TOKEN`, `MERCADO_PAGO_WEBHOOK_SECRET`, `MP_ENV` e `SITE_URL`.
3. Publique as funções `create-payment`, `mercadopago-webhook` e `payment-status`.
4. Substitua `SUPABASE_CREATE_PAYMENT_URL` e `SUPABASE_PAYMENT_STATUS_URL` em `index.html` pelas URLs das funções publicadas.
5. No painel do Mercado Pago, configure Webhooks para a URL da função `mercadopago-webhook` e use a mesma assinatura secreta cadastrada no Supabase.

O token privado do Mercado Pago nunca deve ser salvo no GitHub ou inserido no HTML. Para iniciar em testes, mantenha `MP_ENV=sandbox`; para pagamentos reais, altere para `production` e use credenciais de produção.

## Regras do fluxo

- Valor fixo: **R$ 872,55**.
- Parcelamento exibido: até 4 vezes sem juros, conforme disponibilidade no Checkout Pro.
- Uma empresa cadastra exatamente dois funcionários.
- O curso bônus aparece apenas como “Curso bônus”.
- A tela só confirma a inscrição depois de consultar o status gravado pelo webhook.
