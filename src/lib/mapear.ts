/** Conversão entre as linhas do Postgres (snake_case, datas ISO) e os tipos do domínio. */
import type {
  Chamado,
  ConfigPriorizacao,
  ErroCatalogo,
  Impacto,
  Instante,
  Maquina,
  Papel,
  Pessoa,
  Subdivisao,
} from "./tipos";
import { CONFIG_PADRAO } from "./tipos";

type Linha = Record<string, unknown>;

const ms = (v: unknown): Instante | undefined => (typeof v === "string" ? Date.parse(v) : undefined);
const texto = (v: unknown, padrao = "") => (typeof v === "string" ? v : padrao);

export function maquinaDeLinha(r: Linha): Maquina {
  return {
    id: texto(r.id),
    nome: texto(r.nome),
    tag: texto(r.tag),
    linha: texto(r.linha),
    impacto: r.impacto as Impacto,
    impactoValor: Number(r.impacto_valor),
    ativo: Boolean(r.ativo),
  };
}

export function subdivisaoDeLinha(r: Linha): Subdivisao {
  return {
    id: texto(r.id),
    maquinaId: texto(r.maquina_id),
    nome: texto(r.nome),
    ordem: Number(r.ordem),
    critHist: Number(r.crit_hist),
    componentes: Array.isArray(r.componentes) ? (r.componentes as string[]) : [],
  };
}

export function erroDeLinha(r: Linha): ErroCatalogo {
  return {
    id: texto(r.id),
    maquinaId: texto(r.maquina_id),
    subdivisaoId: texto(r.subdivisao_id),
    nome: texto(r.nome),
    riscoPessoas: Boolean(r.risco_pessoas),
    impactoQualidade: Boolean(r.impacto_qualidade),
    ordem: Number(r.ordem),
    ativo: Boolean(r.ativo),
    origem: r.origem as ErroCatalogo["origem"],
  };
}

export function configDeLinha(r: Linha | null): ConfigPriorizacao {
  return r?.dados ? { ...CONFIG_PADRAO, ...(r.dados as Partial<ConfigPriorizacao>) } : CONFIG_PADRAO;
}

export interface PerfilEquipe extends Pessoa {
  papel: Papel;
}

export function perfilDeLinha(r: Linha): PerfilEquipe {
  return { uid: texto(r.id), nome: texto(r.nome), papel: r.papel as Papel };
}

export function chamadoDeLinha(r: Linha): Chamado {
  const override = r.override as { classe: Chamado["prioridade"]["classeBase"]; justificativa: string; por: string; em: string } | null;
  const pausas = (Array.isArray(r.pausas) ? r.pausas : []) as { inicio: string; fim?: string; motivo: string }[];
  return {
    id: texto(r.id),
    numero: texto(r.numero),
    maquinaId: texto(r.maquina_id),
    maquinaNome: texto(r.maquina_nome),
    tag: texto(r.tag),
    subdivisaoId: texto(r.subdivisao_id),
    subdivisaoNome: texto(r.subdivisao_nome),
    erroId: (r.erro_id as string | null) ?? null,
    erroNome: texto(r.erro_nome),
    erroIdRevisado: (r.erro_id_revisado as string | null) ?? null,
    descricaoLivre: texto(r.descricao_livre),
    condicao: r.condicao as Chamado["condicao"],
    riscoPessoas: Boolean(r.risco_pessoas),
    impactoQualidade: Boolean(r.impacto_qualidade),
    fotoPath: (r.foto_path as string | null) ?? null,
    solicitante: { uid: texto(r.solicitante_id), nome: texto(r.solicitante_nome) },
    responsavel: r.responsavel_id ? { uid: texto(r.responsavel_id), nome: texto(r.responsavel_nome) } : null,
    status: r.status as Chamado["status"],
    prioridade: r.prioridade as Chamado["prioridade"],
    override: override ? { ...override, em: ms(override.em) ?? 0 } : null,
    marcos: {
      abertura: ms(r.abertura) ?? 0,
      recebido: ms(r.recebido),
      inicio: ms(r.inicio),
      fimAtuacao: ms(r.fim_atuacao),
      liberado: ms(r.liberado),
    },
    pausas: pausas.map((p) => ({ inicio: ms(p.inicio) ?? 0, fim: ms(p.fim), motivo: p.motivo })),
    conclusao: (r.conclusao as Chamado["conclusao"]) ?? undefined,
    cancelamento: (r.cancelamento as Chamado["cancelamento"]) ?? undefined,
    demo: Boolean(r.demo),
  };
}
