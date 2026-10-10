# Acionamento da manutenção — Subproduto 1

Chamados de manutenção por QR Code, com marcos de tempo (T0–T5) e fila priorizada.
A equipe entra **só com um PIN de 6 dígitos**; o operador entra pelo QR, sem nada.
Implementação de `../plano_subproduto1_acionamento_digital.md`.

Stack: Next.js 16 (App Router) · TypeScript · shadcn/ui · Tailwind 4 · **Supabase** (Auth, Postgres + RLS, Realtime, Storage) · Vercel.

## Conectar ao Supabase: passo a passo

### 1. Criar o projeto

1. Entre em <https://supabase.com/dashboard> e clique em **New project**.
2. Preencha:
   - **Name:** `acionamento-moura`;
   - **Database password:** gere uma senha e guarde-a. O app não usa essa senha, mas a CLI pede.
   - **Region:** *South America (São Paulo)*.
3. Clique em **Create new project** e aguarde cerca de 2 minutos.

### 2. Ligar o login anônimo, usado pelo operador que escaneia o QR

1. Abra **Authentication → Sign In / Providers**.
2. Em **User Signups**, ative **Allow anonymous sign-ins** e clique em **Save changes**.
3. Em **Auth Providers**, confirme que **Email** está habilitado. Ele já vem habilitado.
4. Abra **Authentication → Rate Limits** e suba **Rate limit for anonymous users** de 30 para **300** por hora. Todos os celulares da fábrica saem pelo mesmo IP público, e 30 novos aparelhos por hora acabam rápido no dia da demonstração.

### 3. Criar as tabelas, as regras e o bucket de fotos

Escolha **uma** das opções.

**Opção A: pelo painel**

1. Abra **SQL Editor → New query**.
2. Cole o conteúdo inteiro de `supabase/migrations/20261010000001_esquema.sql` e clique em **Run**. O resultado esperado é *Success. No rows returned*.
3. Repita com `supabase/migrations/20261010000002_fotos.sql` e depois com `supabase/migrations/20261010000003_login_pin.sql`, nessa ordem.

**Opção B: pela CLI**

```bash
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF   # o ref é o trecho da URL: https://SEU_PROJECT_REF.supabase.co
npx supabase db push
```

Confira o resultado:

- **Table Editor** lista `perfis`, `maquinas`, `subdivisoes`, `erros`, `config`, `chamados`, `eventos`, `pins` e `tentativas_login`, todas com o selo *RLS enabled*;
- **Storage** tem o bucket `fotos`, privado;
- **Database → Publications → supabase_realtime** inclui `chamados`.

### 4. Copiar as chaves

1. Abra **Project Settings → API Keys**.
2. Copie a **Publishable key**, que começa com `sb_publishable_`.
3. Clique em **Reveal** e copie a **Secret key**, que começa com `sb_secret_`.
4. Copie a **Project URL**, no formato `https://SEU_PROJECT_REF.supabase.co`. Ela aparece no botão **Connect** do topo ou em **Project Settings → Data API**.

Se o projeto só mostrar as chaves antigas, na aba *Legacy API keys*, use a `anon` no lugar da publishable e a `service_role` no lugar da secret.

### 5. Criar o `.env.local`

```bash
cp .env.example .env.local
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"   # gera o PIN_SEGREDO
```

Preencha o arquivo:

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
PIN_SEGREDO=valor-gerado-acima
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> `SUPABASE_SECRET_KEY` e `PIN_SEGREDO` são segredos do **servidor**: nunca ganham o prefixo `NEXT_PUBLIC_` e nunca vão para o navegador. Não troque o `PIN_SEGREDO` depois de criar PINs, porque todos deixariam de funcionar.

### 6. Carregar os dados do case e as contas de demonstração

```bash
npm install
npm run seed
```

Saída esperada (os PINs são aleatórios, **anote-os**):

```
  maquinas: 4
  subdivisoes: 31
  erros: 207
  config/priorizacao
Contas de demonstração (anote os PINs):
  Engenharia       engenharia  PIN 323965
  Ana (líder)      lider       PIN 430349
  João             mantenedor  PIN 323805
  ...
Pronto.
```

Rodar de novo atualiza o catálogo e mantém os PINs. Para gerar PINs novos para as contas de demonstração, rode `npm run seed -- --novos-pins`.

### 7. Testar localmente

```bash
npm run dev
```

Abra <http://localhost:3000> e digite o PIN da Engenharia. Clique em **Carregar cenário** e abra **TV** em outra aba.

Para cadastrar pessoas reais, use **Engenharia → Acessos** (líderes também têm em **Manutenção → Acessos**). Lá você pode:
- cadastrar uma pessoa com nome e perfil, e o sistema gera o PIN;
- gerar um **Novo PIN** quando alguém esquecer;
- **Desativar** quem saiu, o que derruba as sessões abertas da pessoa e mantém o histórico dos chamados dela.

O PIN aparece uma única vez, na hora de criar ou trocar.

### 8. Publicar na Vercel

1. Importe o repositório na Vercel.
2. Em **Settings → Environment Variables**, cadastre:
   - `NEXT_PUBLIC_SUPABASE_URL`;
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`;
   - `SUPABASE_SECRET_KEY` e `PIN_SEGREDO`, **os mesmos** do `.env.local`, porque o login por PIN roda no servidor da Vercel;
   - `NEXT_PUBLIC_APP_URL` com a URL pública, por exemplo `https://acionamento-moura.vercel.app`.
3. Faça o deploy. Se mudar `NEXT_PUBLIC_APP_URL`, faça **Redeploy**: ela é embutida no build e é para ela que o QR Code aponta.
4. No Supabase, abra **Authentication → URL Configuration** e defina **Site URL** como a URL da Vercel.
5. Abra `https://SUA-URL/c/A` no celular. A página deve abrir direto no formulário da Máquina A.

> **Plano gratuito:** o Supabase pausa projetos sem uso por 7 dias. Abra o app na véspera da apresentação. Se o projeto estiver pausado, clique em **Restore** no painel.

## Desenvolvimento com Supabase local (opcional, requer Docker)

```bash
npm run supabase:local       # sobe o Supabase em http://127.0.0.1:55321 e aplica as migrações
```

O comando imprime a `PUBLISHABLE_KEY` e a `SECRET_KEY` locais. Use-as no `.env.local` com `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:55321` e rode `npm run seed`. O painel local fica em <http://127.0.0.1:55323>. Para parar, use `npm run supabase:parar`.

As portas são da faixa 553xx para não colidir com outro projeto Supabase local na faixa 543xx.

## Testes

```bash
npm test                                  # unitários: prioridade, estados, tempos, indicadores
SUPABASE_TESTE=1 npx vitest run fluxo     # integração com o Supabase local já semeado
```

A integração cobre:

- o ciclo completo do chamado;
- dois mantenedores recebendo **ao mesmo tempo** (só um consegue);
- o log imutável;
- o que o operador anônimo não pode fazer;
- override e cancelamento pelo líder;
- foto no bucket;
- realtime chegando em menos de 2 s;
- o cenário de demonstração, em que a Máquina A passa à frente;
- o login por PIN: PIN errado, bloqueio após 20 erros em 10 minutos, pessoa desativada, troca de PIN e tabela de PINs inacessível ao navegador.

## Onde está cada regra

| Arquivo | O quê |
|---|---|
| `supabase/migrations/…_esquema.sql` | Tabelas, RLS por papel, `abrir_chamado` e `executar_acao` (máquina de estados validada no banco, com o chamado travado), `revisar_chamado`, `limpar_demo` e a publicação do Realtime |
| `supabase/migrations/…_fotos.sql` | Bucket privado `fotos`: até 2 MB, só imagens |
| `supabase/migrations/…_login_pin.sql` + `src/lib/servidor/credenciais.ts` | PINs (guardados só como HMAC com `PIN_SEGREDO`), limite de tentativas e gestão de pessoas |
| `src/app/api/entrar`, `src/app/api/equipe` | Rotas do servidor: PIN → sessão; cadastro, troca de PIN e desativação |
| `src/lib/prioridade.ts` | Critérios C1–C5, score, envelhecimento, classes, ordem da fila e meta (funções puras) |
| `src/lib/estados.ts` | Espelho da máquina de estados, usado para montar os botões da tela |
| `src/lib/chamados.ts`, `catalogo.ts`, `mapear.ts` | Acesso ao Supabase e conversão de linhas para os tipos do domínio |
| `src/hooks/useTempoReal.ts` | Consulta e assinatura Realtime: recarrega a cada mudança |
| `scripts/gerar_seed.py` → `data/seed.json` → `scripts/seed.ts` | Dados do case MES/SAP: 4 máquinas, 31 subdivisões, 207 erros |

## Rotas

| Rota | Tela | Perfil |
|---|---|---|
| `/login` | Teclado numérico: só o PIN | equipe |
| `/engenharia`, `/engenharia/maquinas/[maqId]`, `/engenharia/qrcodes`, `/engenharia/revisao`, `/engenharia/equipe` | Cadastro, catálogo, etiquetas e PNG do QR com o nome, revisão do "Outro", acessos e cenário de demo | engenharia |
| `/c/[maqId]` (`?sub=`) | **Abrir chamado (destino do QR)**, com login anônimo | operador |
| `/c`, `/chamado`, `/chamado/[id]` | Escolher máquina, acompanhar e liberar | operador |
| `/oficina`, `/oficina/indicadores` | **Painel da TV** e indicadores com CSV | equipe |
| `/manutencao`, `/manutencao/[id]`, `/manutencao/equipe` | Fila, ações e acessos (líder) | mantenedor, líder |
