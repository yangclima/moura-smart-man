/** Pessoas com acesso por PIN: tipo e filtros da página de Acessos. */
import { casaBusca, normalizar } from "./busca";
import type { Papel } from "./tipos";

export interface Pessoa {
  id: string;
  nome: string;
  papel: Papel;
  ativo: boolean;
}

export type Situacao = "ativos" | "desativados" | "todos";

export interface FiltroEquipe {
  busca: string;
  /** null = todos os perfis. */
  papel: Papel | null;
  situacao: Situacao;
}

export const FILTRO_EQUIPE_PADRAO: FiltroEquipe = { busca: "", papel: null, situacao: "ativos" };

const naSituacao = (p: Pessoa, s: Situacao) => s === "todos" || p.ativo === (s === "ativos");

/** Aplica busca, perfil e situação; ativos primeiro, depois por nome. */
export function filtrarPessoas(pessoas: Pessoa[], f: FiltroEquipe): Pessoa[] {
  return pessoas
    .filter((p) => (f.papel === null || p.papel === f.papel) && naSituacao(p, f.situacao) && casaBusca(f.busca, [p.nome]))
    .sort((a, b) => Number(b.ativo) - Number(a.ativo) || normalizar(a.nome).localeCompare(normalizar(b.nome), "pt-BR"));
}

/** Quantas pessoas há em cada perfil, respeitando busca e situação (para os contadores dos filtros). */
export function contarPorPapel(pessoas: Pessoa[], f: FiltroEquipe): Partial<Record<Papel, number>> {
  return filtrarPessoas(pessoas, { ...f, papel: null }).reduce<Partial<Record<Papel, number>>>(
    (acc, p) => ({ ...acc, [p.papel]: (acc[p.papel] ?? 0) + 1 }),
    {},
  );
}

export function iniciais(nome: string): string {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}
