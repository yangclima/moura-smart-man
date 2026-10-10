/**
 * Carga do Supabase a partir de data/seed.json (gerado por scripts/gerar_seed.py).
 *
 *   npm run seed
 *
 * Lê de .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY e PIN_SEGREDO
 * (segredos só do servidor — nunca com prefixo NEXT_PUBLIC_). IDs estáveis:
 * rodar de novo atualiza em vez de duplicar. Cria também as contas de
 * demonstração e mostra os PINs gerados (npm run seed -- --novos-pins troca todos).
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { definirNovoPin, definirPin, senhaInterna } from "../src/lib/servidor/credenciais";

// Rodar a partir da raiz do projeto (npm run seed).
const RAIZ = process.cwd();
const MAX_LOTE = 500;

type Linha = Record<string, unknown> & { id: string };

interface Seed {
  maquinas: Linha[];
  subdivisoes: Linha[];
  erros: Linha[];
  config: Record<string, unknown>;
}

/** Contas com `pin` fixo recebem sempre esse PIN; as demais, um PIN aleatório. */
const CONTAS_DEMO: { conta: string; nome: string; papel: string; pin?: string }[] = [
  { conta: "engenharia", nome: "Engenharia", papel: "engenharia", pin: "123456" },
  { conta: "lider", nome: "Líder", papel: "lider", pin: "654321" },
  { conta: "mantenedor", nome: "Manutenção", papel: "mantenedor", pin: "123321" },
  { conta: "mantenedor2", nome: "Pedro", papel: "mantenedor" },
  { conta: "operador", nome: "Maria", papel: "operador" },
  { conta: "oficina", nome: "TV da oficina", papel: "oficina" },
];

function carregarEnv() {
  const arquivo = resolve(RAIZ, ".env.local");
  if (existsSync(arquivo)) process.loadEnvFile(arquivo);
}

function exigir(nome: string): string {
  const valor = process.env[nome];
  if (!valor) throw new Error(`Defina ${nome} no .env.local`);
  return valor;
}

/** camelCase → snake_case (as tabelas usam snake_case). */
function paraSnake(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k.replace(/[A-Z]/g, (l) => `_${l.toLowerCase()}`), v]));
}

async function gravar(db: SupabaseClient, tabela: string, linhas: Linha[]) {
  for (let i = 0; i < linhas.length; i += MAX_LOTE) {
    const { error } = await db.from(tabela).upsert(linhas.slice(i, i + MAX_LOTE).map(paraSnake));
    if (error) throw new Error(`${tabela}: ${error.message}`);
  }
  console.log(`  ${tabela}: ${linhas.length}`);
}

async function buscarUsuarioPorEmail(db: SupabaseClient, email: string) {
  for (let pagina = 1; ; pagina++) {
    const { data, error } = await db.auth.admin.listUsers({ page: pagina, perPage: 200 });
    if (error) throw new Error(error.message);
    const achado = data.users.find((u) => u.email === email);
    if (achado || data.users.length < 200) return achado ?? null;
  }
}

/** Contas de demonstração com PIN. O PIN só é gerado (e mostrado) na criação ou com --novos-pins. */
async function criarContasDemo(db: SupabaseClient) {
  const novosPins = process.argv.includes("--novos-pins");
  const pins: string[] = [];
  for (const c of CONTAS_DEMO) {
    const email = `demo-${c.conta}@usuarios.acionamento.invalid`;
    const existente = await buscarUsuarioPorEmail(db, email);
    const usuario =
      existente ??
      (await db.auth.admin.createUser({ email, password: crypto.randomUUID(), email_confirm: true })).data.user;
    if (!usuario) throw new Error(`Falha ao criar ${c.conta}`);
    const { error: erroSenha } = await db.auth.admin.updateUserById(usuario.id, { password: senhaInterna(usuario.id) });
    if (erroSenha) throw new Error(`${c.conta}: ${erroSenha.message}`);
    const { error: erroPerfil } = await db.from("perfis").upsert({ id: usuario.id, nome: c.nome, papel: c.papel, ativo: true });
    if (erroPerfil) throw new Error(`perfil ${c.conta}: ${erroPerfil.message}`);

    const { data: temPin } = await db.from("pins").select("usuario_id").eq("usuario_id", usuario.id).maybeSingle();
    if (c.pin) {
      await definirPin(db, usuario.id, c.pin);
      pins.push(`  ${c.nome.padEnd(16)} ${c.papel.padEnd(11)} PIN ${c.pin} (fixo)`);
    } else if (!temPin || novosPins) {
      pins.push(`  ${c.nome.padEnd(16)} ${c.papel.padEnd(11)} PIN ${await definirNovoPin(db, usuario.id)}`);
    } else {
      pins.push(`  ${c.nome.padEnd(16)} ${c.papel.padEnd(11)} PIN já definido (use --novos-pins para trocar)`);
    }
  }
  console.log(pins.join("\n"));
}

async function main() {
  carregarEnv();
  exigir("PIN_SEGREDO");
  const db = createClient(exigir("NEXT_PUBLIC_SUPABASE_URL"), exigir("SUPABASE_SECRET_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const arquivo = resolve(RAIZ, "data/seed.json");
  if (!existsSync(arquivo)) throw new Error("data/seed.json não encontrado (rode scripts/gerar_seed.py)");
  const seed = JSON.parse(readFileSync(arquivo, "utf-8")) as Seed;

  console.log("Gravando catálogo…");
  await gravar(db, "maquinas", seed.maquinas);
  await gravar(db, "subdivisoes", seed.subdivisoes);
  await gravar(db, "erros", seed.erros);
  const { error } = await db.from("config").upsert({ id: "priorizacao", dados: seed.config });
  if (error) throw new Error(`config: ${error.message}`);
  console.log("  config/priorizacao");

  console.log("Contas de demonstração (anote os PINs):");
  await criarContasDemo(db);
  console.log("Pronto.");
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
