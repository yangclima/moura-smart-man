/** Histórico conciliado MES × SAP (Subproduto 2): tipos, conversão das linhas e carga do Supabase. */
import { supabase } from "./supabase";
import type { Instante } from "./tipos";

export const CLASSES_CONCILIACAO = ["MES + SAP", "MES sem SAP", "SAP sem MES"] as const;
export type ClasseConciliacao = (typeof CLASSES_CONCILIACAO)[number];

export const CONFIANCAS = ["alta", "media", "baixa", "sem correspondencia"] as const;
export type Confianca = (typeof CONFIANCAS)[number];

export type DivergenciaDuracao = "SAP maior" | "MES maior" | "compatível";

/** Um evento da conciliação. Marcos: T0 = mesInicio, T2 = sapInicio, T4 = sapFim, T5 = mesFim. */
export interface EventoHistorico {
  idEvento: string;
  maquina: string;
  classe: ClasseConciliacao;
  confianca: Confianca | null;
  score: number | null;
  revisar: boolean;
  ambiguo: boolean;
  ordemLonga: boolean;
  possivelDuplicidadeSap: boolean;

  idParada: string | null;
  equipamentoMes: string | null;
  familiaMes: string | null;
  componenteMes: string | null;
  /** A parada do MES inclui ao menos um registro de quebra. */
  contemQuebra: boolean;
  mesInicio?: Instante;
  mesFim?: Instante;
  indisponibilidadeH: number | null;
  idsRegistroMes: string[];

  ordens: string[];
  descricaoEquipSap: string | null;
  tipoSap: string | null;
  tipoAtividadeSap: string | null;
  textoSap: string | null;
  sapInicio?: Instante;
  sapFim?: Instante;
  atuacaoH: number | null;
  atuacaoNaParadaH: number | null;

  inicioEvento?: Instante;
  esperaAteAtuacaoMin: number | null;
  retomadaAposAtuacaoMin: number | null;
  difDuracaoH: number | null;
  divergenciaDuracao: DivergenciaDuracao | null;
  sapAntesDaParada: boolean;
  motivoSemPar: string;
}

/** Um vínculo ordem SAP → parada MES. */
export interface VinculoHistorico {
  nOrdem: string;
  maquina: string;
  confianca: Confianca;
  inicio?: Instante;
}

export interface DadosHistorico {
  eventos: EventoHistorico[];
  vinculos: VinculoHistorico[];
}

type Linha = Record<string, unknown>;

const ms = (v: unknown): Instante | undefined => (typeof v === "string" ? Date.parse(v) : undefined);
const textoOuNulo = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);
const numero = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const lista = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);

export function eventoDeLinha(r: Linha): EventoHistorico {
  return {
    idEvento: String(r.id_evento),
    maquina: String(r.maquina),
    classe: r.classe as ClasseConciliacao,
    confianca: (textoOuNulo(r.confianca) as Confianca | null) ?? null,
    score: numero(r.score),
    revisar: Boolean(r.revisar),
    ambiguo: Boolean(r.ambiguo),
    ordemLonga: Boolean(r.ordem_longa),
    possivelDuplicidadeSap: Boolean(r.possivel_duplicidade_sap),
    idParada: textoOuNulo(r.id_parada),
    equipamentoMes: textoOuNulo(r.equipamento_mes),
    familiaMes: textoOuNulo(r.familia_mes),
    componenteMes: textoOuNulo(r.componente_mes),
    contemQuebra: Boolean(r.contem_quebra),
    mesInicio: ms(r.mes_inicio),
    mesFim: ms(r.mes_fim),
    indisponibilidadeH: numero(r.indisponibilidade_h),
    idsRegistroMes: lista(r.ids_registro_mes),
    ordens: lista(r.ordens),
    descricaoEquipSap: textoOuNulo(r.descricao_equip_sap),
    tipoSap: textoOuNulo(r.tipo_sap),
    tipoAtividadeSap: textoOuNulo(r.tipo_atividade_sap),
    textoSap: textoOuNulo(r.texto_sap),
    sapInicio: ms(r.sap_inicio),
    sapFim: ms(r.sap_fim),
    atuacaoH: numero(r.atuacao_h),
    atuacaoNaParadaH: numero(r.atuacao_na_parada_h),
    inicioEvento: ms(r.inicio_evento),
    esperaAteAtuacaoMin: numero(r.espera_ate_atuacao_min),
    retomadaAposAtuacaoMin: numero(r.retomada_apos_atuacao_min),
    difDuracaoH: numero(r.dif_duracao_h),
    divergenciaDuracao: (textoOuNulo(r.divergencia_duracao) as DivergenciaDuracao | null) ?? null,
    sapAntesDaParada: Boolean(r.sap_antes_da_parada),
    motivoSemPar: typeof r.motivo_sem_par === "string" ? r.motivo_sem_par : "",
  };
}

export function vinculoDeLinha(r: Linha): VinculoHistorico {
  return {
    nOrdem: String(r.n_ordem),
    maquina: String(r.maquina),
    confianca: r.confianca as Confianca,
    inicio: ms(r.inicio),
  };
}

/** O PostgREST devolve no máximo 1000 linhas por pedido (max_rows); busca em páginas. */
const PAGINA = 1000;

async function buscarTudo(tabela: string, colunas: string, ordem: string): Promise<Linha[]> {
  const linhas: Linha[] = [];
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await supabase
      .from(tabela)
      .select(colunas)
      .order(ordem)
      .range(de, de + PAGINA - 1);
    if (error) throw new Error(`Não foi possível carregar o histórico (${tabela}): ${error.message}`);
    linhas.push(...(data as unknown as Linha[]));
    if (data.length < PAGINA) return linhas;
  }
}

export async function carregarHistorico(): Promise<DadosHistorico> {
  const [eventos, vinculos] = await Promise.all([
    buscarTudo("conc_eventos_atual", "*", "id_evento"),
    buscarTudo("conc_vinculos_atual", "n_ordem,maquina,confianca,inicio", "n_ordem"),
  ]);
  return { eventos: eventos.map(eventoDeLinha), vinculos: vinculos.map(vinculoDeLinha) };
}
