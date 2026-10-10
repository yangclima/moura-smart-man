/**
 * Indicadores do histórico conciliado MES × SAP (aba "Histórico" da página de indicadores).
 * Mesma linguagem de marcos dos chamados: T0 = início da parada (MES), T2 = início no SAP,
 * T4 = fim no SAP, T5 = retomada (MES). Não há T1 nem T3 no histórico.
 */
import { celula, textoLivre } from "./csv";
import {
  CLASSES_CONCILIACAO,
  CONFIANCAS,
  type ClasseConciliacao,
  type Confianca,
  type DadosHistorico,
  type EventoHistorico,
} from "./historico";
import { resumir, type ResumoTempo } from "./indicadores";
import type { Instante } from "./tipos";

const MIN_POR_H = 60;

export interface ResumoTempoN extends ResumoTempo {
  /** Quantos eventos entraram no cálculo. */
  n: number;
}

export interface TemposHistorico {
  esperaMin: ResumoTempoN;
  atuacaoMin: ResumoTempoN;
  indisponibilidadeMin: ResumoTempoN;
}

export interface LinhaMaquinaHistorico {
  maquina: string;
  eventos: number;
  paradoH: number;
  atuacaoH: number;
  mesSemSap: number;
  /** Eventos com parada no MES (MES + SAP e MES sem SAP). */
  comParada: number;
  sapSemMes: number;
  /** Eventos com ordem no SAP (MES + SAP e SAP sem MES). */
  comOrdem: number;
  componenteMaisFrequente: string;
}

export interface QualidadeMaquina {
  maquina: string;
  total: number;
  classes: Record<ClasseConciliacao, number>;
}

export interface QualidadeConciliacao {
  porMaquina: QualidadeMaquina[];
  /** Por ordem SAP (vínculos). */
  confianca: Record<Confianca, number>;
  /** Por evento, que é o que a lista mostra ao clicar. */
  confiancaEventos: Record<Confianca, number>;
  totalVinculos: number;
}

export interface LinhaCruzada<K extends string = string> {
  chave: K;
  rotulo: string;
  porMaquina: Record<string, number>;
  total: number;
}

/** Contagem linha × máquina (tabelas "Por que não concilia" e "Divergências"). */
export interface TabelaCruzada<K extends string = string> {
  maquinas: string[];
  linhas: LinhaCruzada<K>[];
}

export const TIPOS_DIVERGENCIA = ["sap_antes", "sap_maior", "mes_maior", "duplicidade"] as const;
export type TipoDivergencia = (typeof TIPOS_DIVERGENCIA)[number];

export const ROTULOS_DIVERGENCIA: Record<TipoDivergencia, string> = {
  sap_antes: "SAP começa mais de 15 min antes da parada",
  sap_maior: "Duração maior no SAP",
  mes_maior: "Duração maior no MES",
  duplicidade: "Possível duplicidade no SAP",
};

const PREDICADOS_DIVERGENCIA: Record<TipoDivergencia, (e: EventoHistorico) => boolean> = {
  sap_antes: (e) => e.sapAntesDaParada,
  sap_maior: (e) => e.divergenciaDuracao === "SAP maior",
  mes_maior: (e) => e.divergenciaDuracao === "MES maior",
  duplicidade: (e) => e.possivelDuplicidadeSap,
};

export interface FiltroHistorico {
  maquina: string | null;
  /** "AAAA-MM"; null = todo o histórico. */
  mes: string | null;
}

/** Filtros da lista de eventos, preenchidos pelos selects ou pelos números clicáveis. */
export interface FiltroLista {
  maquina?: string;
  classe?: ClasseConciliacao;
  confianca?: Confianca;
  revisar?: boolean;
  motivo?: string;
  divergencia?: TipoDivergencia;
}

// ---------------------------------------------------------------- regras

const conciliado = (e: EventoHistorico) => e.classe === "MES + SAP";
const temParada = (e: EventoHistorico) => e.classe !== "SAP sem MES";
const temOrdem = (e: EventoHistorico) => e.classe !== "MES sem SAP";

/** Só pares MES + SAP de confiança alta ou média, e não ambíguos, entram nas métricas de tempo. */
export function entraNasMetricas(e: EventoHistorico): boolean {
  return conciliado(e) && (e.confianca === "alta" || e.confianca === "media") && !e.ambiguo;
}

/** Vínculos de confiança baixa ou ambíguos ficam fora das métricas e vão para revisão. */
export function precisaRevisao(e: EventoHistorico): boolean {
  return e.revisar || e.ambiguo || e.confianca === "baixa";
}

const horasEmMin = (h: number | null) => (h === null ? null : h * MIN_POR_H);

function resumirN(valores: (number | null)[]): ResumoTempoN {
  const v = valores.filter((x): x is number => x !== null);
  return { ...resumir(v), n: v.length };
}

function agruparPorMaquina(eventos: EventoHistorico[]): [string, EventoHistorico[]][] {
  const grupos = new Map<string, EventoHistorico[]>();
  eventos.forEach((e) => grupos.set(e.maquina, [...(grupos.get(e.maquina) ?? []), e]));
  return [...grupos.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function moda(valores: (string | null)[]): string {
  const freq = new Map<string, number>();
  valores.forEach((v) => v && freq.set(v, (freq.get(v) ?? 0) + 1));
  return [...freq.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? "—";
}

const soma = (valores: (number | null)[]) => valores.reduce<number>((s, v) => s + (v ?? 0), 0);

// ---------------------------------------------------------------- filtros

export function chaveMes(t: Instante): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function mesesDoHistorico(eventos: EventoHistorico[]): string[] {
  const meses = new Set(eventos.flatMap((e) => (e.inicioEvento === undefined ? [] : [chaveMes(e.inicioEvento)])));
  return [...meses].sort();
}

export function maquinasDoHistorico(eventos: EventoHistorico[]): string[] {
  return [...new Set(eventos.map((e) => e.maquina))].sort();
}

/**
 * Filtro da aba: máquina e mês pelo início do evento. Os vínculos acompanham os eventos
 * (pelas ordens de cada evento), para o bloco de confiança bater com a lista.
 */
export function filtrarHistorico(dados: DadosHistorico, f: FiltroHistorico): DadosHistorico {
  if (f.mes === null && f.maquina === null) return dados;
  const eventos = dados.eventos.filter(
    (e) =>
      (f.maquina === null || e.maquina === f.maquina) &&
      (f.mes === null || (e.inicioEvento !== undefined && chaveMes(e.inicioEvento) === f.mes)),
  );
  const ordens = new Set(eventos.flatMap((e) => e.ordens));
  return { eventos, vinculos: dados.vinculos.filter((v) => ordens.has(v.nOrdem)) };
}

export function filtrarLista(eventos: EventoHistorico[], f: FiltroLista): EventoHistorico[] {
  return eventos.filter(
    (e) =>
      (f.maquina === undefined || e.maquina === f.maquina) &&
      (f.classe === undefined || e.classe === f.classe) &&
      (f.confianca === undefined || e.confianca === f.confianca) &&
      (f.revisar === undefined || precisaRevisao(e) === f.revisar) &&
      (f.motivo === undefined || e.motivoSemPar === f.motivo) &&
      (f.divergencia === undefined || (conciliado(e) && PREDICADOS_DIVERGENCIA[f.divergencia](e))),
  );
}

// ---------------------------------------------------------------- indicadores

/** Cartões de tempo. Indisponibilidade usa todas as paradas do MES, com ou sem SAP. */
export function temposHistorico(eventos: EventoHistorico[]): TemposHistorico {
  const confiaveis = eventos.filter(entraNasMetricas);
  return {
    esperaMin: resumirN(confiaveis.map((e) => e.esperaAteAtuacaoMin)),
    atuacaoMin: resumirN(confiaveis.map((e) => horasEmMin(e.atuacaoNaParadaH))),
    indisponibilidadeMin: resumirN(eventos.filter(temParada).map((e) => horasEmMin(e.indisponibilidadeH))),
  };
}

export function contarClasses(eventos: EventoHistorico[]): Record<ClasseConciliacao, number> {
  const base = Object.fromEntries(CLASSES_CONCILIACAO.map((c) => [c, 0])) as Record<ClasseConciliacao, number>;
  return eventos.reduce((acc, e) => ({ ...acc, [e.classe]: acc[e.classe] + 1 }), base);
}

export function porMaquinaHistorico(eventos: EventoHistorico[]): LinhaMaquinaHistorico[] {
  return agruparPorMaquina(eventos)
    .map(([maquina, lista]) => {
      const classes = contarClasses(lista);
      return {
        maquina,
        eventos: lista.length,
        paradoH: soma(lista.map((e) => e.indisponibilidadeH)),
        atuacaoH: soma(lista.map((e) => e.atuacaoH)),
        mesSemSap: classes["MES sem SAP"],
        comParada: lista.filter(temParada).length,
        sapSemMes: classes["SAP sem MES"],
        comOrdem: lista.filter(temOrdem).length,
        componenteMaisFrequente: moda(lista.map((e) => e.componenteMes)),
      };
    })
    .sort((a, b) => b.paradoH - a.paradoH);
}

export function qualidadeConciliacao(dados: DadosHistorico): QualidadeConciliacao {
  const confianca = Object.fromEntries(CONFIANCAS.map((c) => [c, 0])) as Record<Confianca, number>;
  const confiancaEventos = dados.eventos.reduce(
    (acc, e) => (e.confianca === null ? acc : { ...acc, [e.confianca]: acc[e.confianca] + 1 }),
    confianca,
  );
  return {
    confiancaEventos,
    porMaquina: agruparPorMaquina(dados.eventos).map(([maquina, lista]) => ({
      maquina,
      total: lista.length,
      classes: contarClasses(lista),
    })),
    confianca: dados.vinculos.reduce((acc, v) => ({ ...acc, [v.confianca]: acc[v.confianca] + 1 }), confianca),
    totalVinculos: dados.vinculos.length,
  };
}

function cruzar<K extends string>(
  eventos: EventoHistorico[],
  chaves: { chave: K; rotulo: string; casa: (e: EventoHistorico) => boolean }[],
): TabelaCruzada<K> {
  const maquinas = maquinasDoHistorico(eventos);
  const linhas = chaves.map(({ chave, rotulo, casa }) => {
    const doTipo = eventos.filter(casa);
    const porMaquina = Object.fromEntries(maquinas.map((m) => [m, doTipo.filter((e) => e.maquina === m).length]));
    return { chave, rotulo, porMaquina, total: doTipo.length };
  });
  return { maquinas, linhas };
}

/** Contagem de motivo_sem_par por máquina, do mais frequente para o menos. */
export function motivosSemPar(eventos: EventoHistorico[]): TabelaCruzada {
  const motivos = [...new Set(eventos.map((e) => e.motivoSemPar).filter(Boolean))];
  const tabela = cruzar(
    eventos,
    motivos.map((m) => ({ chave: m, rotulo: m, casa: (e: EventoHistorico) => e.motivoSemPar === m })),
  );
  return { ...tabela, linhas: [...tabela.linhas].sort((a, b) => b.total - a.total) };
}

/** Divergências sobre os eventos conciliados (MES + SAP), por máquina. */
export function divergencias(eventos: EventoHistorico[]): TabelaCruzada<TipoDivergencia> {
  return cruzar(
    eventos.filter(conciliado),
    TIPOS_DIVERGENCIA.map((t) => ({ chave: t, rotulo: ROTULOS_DIVERGENCIA[t], casa: PREDICADOS_DIVERGENCIA[t] })),
  );
}

// ---------------------------------------------------------------- CSV

/** Data e hora local "AAAA-MM-DD hh:mm", que o Excel reconhece como data. */
function dataHoraLocal(t?: Instante): string {
  if (t === undefined) return "";
  const d = new Date(t);
  const dois = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())} ${dois(d.getHours())}:${dois(d.getMinutes())}`;
}

/** Decimal com vírgula, como o Excel em português espera. */
const decimal = (n: number | null, casas = 2) => (n === null ? "" : n.toFixed(casas).replace(".", ","));
const simNao = (b: boolean) => (b ? "sim" : "não");

export function gerarCsvHistorico(eventos: EventoHistorico[]): string {
  const cab = [
    "id_evento", "maquina", "classe", "confianca", "score", "revisar", "ambiguo", "ordem_longa",
    "possivel_duplicidade_sap", "id_parada", "equipamento_mes", "familia_mes", "componente_mes", "ids_registro_mes",
    "t0_mes_inicio", "t2_sap_inicio", "t4_sap_fim", "t5_mes_fim", "indisponibilidade_h", "atuacao_h",
    "atuacao_na_parada_h", "espera_ate_atuacao_min", "retomada_apos_atuacao_min", "dif_duracao_h",
    "divergencia_duracao", "sap_antes_da_parada", "ordens", "tipo_sap", "tipo_atividade_sap", "descricao_equip_sap",
    "texto_sap", "motivo_sem_par",
  ];
  const linhas = eventos.map((e) =>
    [
      e.idEvento, e.maquina, e.classe, e.confianca ?? "", decimal(e.score, 3), simNao(e.revisar), simNao(e.ambiguo),
      simNao(e.ordemLonga), simNao(e.possivelDuplicidadeSap), e.idParada ?? "", e.equipamentoMes ?? "",
      e.familiaMes ?? "", e.componenteMes ?? "", e.idsRegistroMes.join(", "),
      dataHoraLocal(e.mesInicio), dataHoraLocal(e.sapInicio), dataHoraLocal(e.sapFim), dataHoraLocal(e.mesFim),
      decimal(e.indisponibilidadeH), decimal(e.atuacaoH), decimal(e.atuacaoNaParadaH),
      decimal(e.esperaAteAtuacaoMin, 1), decimal(e.retomadaAposAtuacaoMin, 1), decimal(e.difDuracaoH),
      e.divergenciaDuracao ?? "", simNao(e.sapAntesDaParada), e.ordens.join(", "), e.tipoSap ?? "",
      e.tipoAtividadeSap ?? "", textoLivre(e.descricaoEquipSap), textoLivre(e.textoSap), e.motivoSemPar,
    ]
      .map(celula)
      .join(";"),
  );
  return [cab.join(";"), ...linhas].join("\n");
}
