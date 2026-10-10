/**
 * Credenciais por PIN — só para o servidor (rotas /api e script de seed).
 * Usa SUPABASE_SECRET_KEY e PIN_SEGREDO, que nunca têm prefixo NEXT_PUBLIC_.
 */
import { createHmac, randomInt } from "node:crypto";
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import type { Papel } from "../tipos";

export const TAMANHO_PIN = 6;
const FORMATO_PIN = /^\d{6}$/;
const MAX_TENTATIVAS = 20;
const JANELA_TENTATIVAS_MIN = 10;
const ATRASO_FALHA_MS = 400;
const DOMINIO_INTERNO = "usuarios.acionamento.invalid";
const PAPEIS: Papel[] = ["engenharia", "lider", "mantenedor", "operador", "oficina"];
const BANIDO = "876000h"; // ~100 anos

function exigirEnv(nome: string): string {
  const valor = process.env[nome];
  if (!valor) throw new Error(`Variável de ambiente ${nome} não configurada no servidor`);
  return valor;
}

const segredo = () => exigirEnv("PIN_SEGREDO");

export function pinValido(pin: unknown): pin is string {
  return typeof pin === "string" && FORMATO_PIN.test(pin);
}

/** HMAC do PIN: sem o segredo, um vazamento do banco não revela os PINs. */
export function hashPin(pin: string): string {
  return createHmac("sha256", segredo()).update(`pin:${pin}`).digest("hex");
}

/** Senha interna da conta no Supabase Auth, derivada do id. Ninguém digita. */
export function senhaInterna(uid: string): string {
  return createHmac("sha256", segredo()).update(`senha:${uid}`).digest("base64url");
}

export function gerarPin(): string {
  return String(randomInt(0, 10 ** TAMANHO_PIN)).padStart(TAMANHO_PIN, "0");
}

export function clienteAdmin(): SupabaseClient {
  return createClient(exigirEnv("NEXT_PUBLIC_SUPABASE_URL"), exigirEnv("SUPABASE_SECRET_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function clientePublico(): SupabaseClient {
  return createClient(exigirEnv("NEXT_PUBLIC_SUPABASE_URL"), exigirEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export class ErroLogin extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

const esperar = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

async function bloqueado(admin: SupabaseClient, ip: string): Promise<boolean> {
  const desde = new Date(Date.now() - JANELA_TENTATIVAS_MIN * 60_000).toISOString();
  const { count } = await admin
    .from("tentativas_login")
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .gte("em", desde);
  return (count ?? 0) >= MAX_TENTATIVAS;
}

/** Troca um PIN por uma sessão do Supabase. Lança ErroLogin com o status HTTP. */
export async function entrarComPin(pin: unknown, ip: string): Promise<Pick<Session, "access_token" | "refresh_token">> {
  if (!pinValido(pin)) throw new ErroLogin(`O PIN tem ${TAMANHO_PIN} dígitos`, 400);
  const admin = clienteAdmin();
  if (await bloqueado(admin, ip)) {
    throw new ErroLogin("Muitas tentativas erradas. Aguarde alguns minutos.", 429);
  }

  const { data: registro } = await admin.from("pins").select("usuario_id").eq("pin_hash", hashPin(pin)).maybeSingle();
  if (!registro) {
    await admin.from("tentativas_login").insert({ ip });
    await esperar(ATRASO_FALHA_MS);
    throw new ErroLogin("PIN inválido", 401);
  }

  const uid = registro.usuario_id as string;
  const { data: perfil } = await admin.from("perfis").select("ativo").eq("id", uid).maybeSingle();
  if (!perfil?.ativo) throw new ErroLogin("Acesso desativado. Procure a engenharia.", 403);

  const { data: usuario, error: erroUsuario } = await admin.auth.admin.getUserById(uid);
  if (erroUsuario || !usuario.user.email) throw new ErroLogin("Conta não encontrada", 403);

  const { data, error } = await clientePublico().auth.signInWithPassword({
    email: usuario.user.email,
    password: senhaInterna(uid),
  });
  if (error || !data.session) throw new ErroLogin("Não foi possível iniciar a sessão", 500);
  return { access_token: data.session.access_token, refresh_token: data.session.refresh_token };
}

// ------------------------------------------------------------ gestão de pessoas

export interface PessoaEquipe {
  id: string;
  nome: string;
  papel: Papel;
  ativo: boolean;
}

/** Verifica o token de quem chama e exige papel de engenharia ou líder. */
export async function exigirGestor(admin: SupabaseClient, authorization: string | null): Promise<string> {
  const token = authorization?.replace(/^Bearer\s+/i, "");
  if (!token) throw new ErroLogin("Faça login", 401);
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new ErroLogin("Sessão inválida", 401);
  const { data: perfil } = await admin.from("perfis").select("papel, ativo").eq("id", data.user.id).maybeSingle();
  if (!perfil?.ativo || !["engenharia", "lider"].includes(perfil.papel as string)) {
    throw new ErroLogin("Só engenharia e líderes gerenciam acessos", 403);
  }
  return data.user.id;
}

export async function listarEquipe(admin: SupabaseClient): Promise<PessoaEquipe[]> {
  const { data, error } = await admin.from("perfis").select("id, nome, papel, ativo").order("nome");
  if (error) throw new Error(error.message);
  return data as PessoaEquipe[];
}

/** Grava um PIN novo e único para a pessoa e o devolve (é a única vez que ele aparece). */
/** Define um PIN escolhido (ex.: contas de demonstração). Falha se outra pessoa já usa esse PIN. */
export async function definirPin(admin: SupabaseClient, uid: string, pin: string): Promise<void> {
  if (!pinValido(pin)) throw new Error(`O PIN tem ${TAMANHO_PIN} dígitos`);
  const { error } = await admin
    .from("pins")
    .upsert({ usuario_id: uid, pin_hash: hashPin(pin), atualizado_em: new Date().toISOString() });
  if (!error) return;
  if (error.message.includes("pins_pin_hash_key")) throw new Error(`O PIN ${pin} já pertence a outra pessoa`);
  throw new Error(error.message);
}

export async function definirNovoPin(admin: SupabaseClient, uid: string): Promise<string> {
  for (let tentativa = 0; tentativa < 20; tentativa++) {
    const pin = gerarPin();
    const { error } = await admin
      .from("pins")
      .upsert({ usuario_id: uid, pin_hash: hashPin(pin), atualizado_em: new Date().toISOString() });
    if (!error) return pin;
    if (!error.message.includes("pins_pin_hash_key")) throw new Error(error.message);
  }
  throw new Error("Não foi possível gerar um PIN único");
}

export async function criarPessoa(
  admin: SupabaseClient,
  nome: string,
  papel: Papel,
): Promise<{ pessoa: PessoaEquipe; pin: string }> {
  const nomeLimpo = nome.trim();
  if (nomeLimpo.length < 2 || nomeLimpo.length > 60) throw new ErroLogin("Nome deve ter de 2 a 60 caracteres", 400);
  if (!PAPEIS.includes(papel)) throw new ErroLogin("Perfil inválido", 400);

  // E-mail interno, nunca usado para envio: o Supabase Auth exige um identificador.
  const email = `${crypto.randomUUID()}@${DOMINIO_INTERNO}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password: crypto.randomUUID(), email_confirm: true });
  if (error || !data.user) throw new Error(error?.message ?? "Falha ao criar a conta");
  const uid = data.user.id;
  await admin.auth.admin.updateUserById(uid, { password: senhaInterna(uid) });
  const { error: erroPerfil } = await admin.from("perfis").insert({ id: uid, nome: nomeLimpo, papel, ativo: true });
  if (erroPerfil) throw new Error(erroPerfil.message);
  const pin = await definirNovoPin(admin, uid);
  return { pessoa: { id: uid, nome: nomeLimpo, papel, ativo: true }, pin };
}

/** Desativar também derruba as sessões abertas (ban no Auth). */
export async function definirAtivo(admin: SupabaseClient, uid: string, ativo: boolean): Promise<void> {
  const { error } = await admin.from("perfis").update({ ativo }).eq("id", uid);
  if (error) throw new Error(error.message);
  const { error: erroAuth } = await admin.auth.admin.updateUserById(uid, { ban_duration: ativo ? "none" : BANIDO });
  if (erroAuth) throw new Error(erroAuth.message);
}
