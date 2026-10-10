import { chamadoDeLinha, erroDeLinha, maquinaDeLinha, subdivisaoDeLinha } from "./mapear";
import { supabase } from "./supabase";
import {
  IMPACTO_VALOR,
  type Chamado,
  type ErroCatalogo,
  type Impacto,
  type Maquina,
  type Subdivisao,
} from "./tipos";

const CRIT_HIST_NEUTRO = 0.5;

export function slug(texto: string, maiusculo = false): string {
  const s = texto
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return maiusculo ? s.toUpperCase() : s.toLowerCase();
}

/** Lança o erro do Supabase como Error comum. */
function ok<T>({ data, error }: { data: T; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data;
}

function lista<T>(r: { data: T[] | null; error: { message: string } | null }): T[] {
  return ok(r) ?? [];
}

// ------------------------------------------------------------ leituras
export async function listarMaquinas(): Promise<Maquina[]> {
  return lista(await supabase.from("maquinas").select("*").order("nome")).map(maquinaDeLinha);
}

export async function buscarMaquina(id: string): Promise<Maquina | null> {
  const linha = ok(await supabase.from("maquinas").select("*").eq("id", id).maybeSingle());
  return linha ? maquinaDeLinha(linha) : null;
}

export async function listarSubdivisoes(maquinaId?: string): Promise<Subdivisao[]> {
  let q = supabase.from("subdivisoes").select("*");
  if (maquinaId) q = q.eq("maquina_id", maquinaId);
  return lista(await q).map(subdivisaoDeLinha);
}

export async function buscarSubdivisao(id: string): Promise<Subdivisao | null> {
  const linha = ok(await supabase.from("subdivisoes").select("*").eq("id", id).maybeSingle());
  return linha ? subdivisaoDeLinha(linha) : null;
}

export async function listarErros(maquinaId?: string): Promise<ErroCatalogo[]> {
  let q = supabase.from("erros").select("*");
  if (maquinaId) q = q.eq("maquina_id", maquinaId);
  return lista(await q).map(erroDeLinha);
}

/** Chamados em que o operador escolheu "Outro" (para a revisão). */
export async function listarChamadosOutro(): Promise<Chamado[]> {
  return lista(await supabase.from("chamados").select("*").is("erro_id", null).order("abertura", { ascending: false })).map(
    chamadoDeLinha,
  );
}

export const porOrdem = <T extends { ordem: number; nome: string }>(a: T, b: T) =>
  a.ordem - b.ordem || a.nome.localeCompare(b.nome, "pt-BR");

// ------------------------------------------------------------ escritas
export interface DadosMaquina {
  nome: string;
  tag: string;
  linha: string;
  impacto: Impacto;
}

export async function salvarMaquina(dados: DadosMaquina, id?: string): Promise<string> {
  const maqId = id ?? slug(dados.nome);
  if (!maqId) throw new Error("Nome inválido");
  ok(
    await supabase.from("maquinas").upsert({
      id: maqId,
      nome: dados.nome.trim(),
      tag: dados.tag.trim(),
      linha: dados.linha.trim(),
      impacto: dados.impacto,
      impacto_valor: IMPACTO_VALOR[dados.impacto],
    }),
  );
  return maqId;
}

export async function alternarMaquinaAtiva(maquina: Maquina): Promise<void> {
  ok(await supabase.from("maquinas").update({ ativo: !maquina.ativo }).eq("id", maquina.id));
}

export async function criarSubdivisao(maquinaId: string, nome: string, ordem: number, componentes: string[]): Promise<string> {
  const id = `${maquinaId}-${slug(nome, true)}`;
  ok(
    await supabase.from("subdivisoes").insert({
      id,
      maquina_id: maquinaId,
      nome: nome.trim().toUpperCase(),
      ordem,
      crit_hist: CRIT_HIST_NEUTRO,
      componentes,
    }),
  );
  return id;
}

export async function atualizarComponentes(subId: string, componentes: string[]): Promise<void> {
  ok(await supabase.from("subdivisoes").update({ componentes }).eq("id", subId));
}

export interface DadosErro {
  nome: string;
  riscoPessoas: boolean;
  impactoQualidade: boolean;
}

export async function criarErro(
  sub: Subdivisao,
  dados: DadosErro,
  ordem: number,
  origem: ErroCatalogo["origem"],
): Promise<string> {
  const id = `${sub.id}-${slug(dados.nome)}`;
  ok(
    await supabase.from("erros").insert({
      id,
      maquina_id: sub.maquinaId,
      subdivisao_id: sub.id,
      nome: dados.nome.trim(),
      risco_pessoas: dados.riscoPessoas,
      impacto_qualidade: dados.impactoQualidade,
      ordem,
      origem,
    }),
  );
  return id;
}

export async function atualizarErro(
  erroId: string,
  campos: Partial<Pick<ErroCatalogo, "riscoPessoas" | "impactoQualidade" | "ativo" | "nome">>,
): Promise<void> {
  const linha: Record<string, unknown> = {};
  if (campos.riscoPessoas !== undefined) linha.risco_pessoas = campos.riscoPessoas;
  if (campos.impactoQualidade !== undefined) linha.impacto_qualidade = campos.impactoQualidade;
  if (campos.ativo !== undefined) linha.ativo = campos.ativo;
  if (campos.nome !== undefined) linha.nome = campos.nome;
  ok(await supabase.from("erros").update(linha).eq("id", erroId));
}

/** Move o erro da posição i uma casa para cima (-1) ou para baixo (+1) e regrava a ordem 0..n-1. */
export async function moverErro(erros: ErroCatalogo[], i: number, direcao: -1 | 1): Promise<void> {
  const j = i + direcao;
  if (j < 0 || j >= erros.length) return;
  const nova = [...erros];
  [nova[i], nova[j]] = [nova[j], nova[i]];
  await Promise.all(
    nova
      .map((e, ordem) => ({ e, ordem }))
      .filter(({ e, ordem }) => e.ordem !== ordem)
      .map(async ({ e, ordem }) => ok(await supabase.from("erros").update({ ordem }).eq("id", e.id))),
  );
}

export async function associarErroRevisado(chamadoId: string, erroId: string): Promise<void> {
  ok(await supabase.rpc("revisar_chamado", { p_id: chamadoId, p_erro_id: erroId }));
}
