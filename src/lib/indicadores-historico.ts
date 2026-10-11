/**
 * Indicadores do histórico conciliado MES × SAP (aba "Histórico" da página de indicadores).
 * Mesma linguagem de marcos dos chamados: T0 = início da parada (MES), T2 = início no SAP,
 * T4 = fim no SAP, T5 = retomada (MES). Não há T1 nem T3 no histórico.
 */
import { celula, textoLivre } from "./csv";
import { dataHoraRecife, dataRecife, meiaNoiteRecife, MS_POR_DIA, rotuloDia, rotuloMesCurto } from "./fuso";
import {
  CLASSES_CONCILIACAO,
  CONFIANCAS,
  type ClasseConciliacao,
  type Confianca,
  type DadosHistorico,
  type EventoHistorico,
} from "./historico";
import { resumir, type ResumoTempo } from "./indicadores";
import { percentil } from "./tempo";
import { CONFIG_PADRAO, type Instante } from "./tipos";

const MIN_POR_H = 60;
const MS_POR_H = 3_600_000;

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
  /** Tempo das ordens SAP dentro das paradas conciliadas (MES + SAP). */
  atuacaoNaParadaH: number;
  /** Tempo das ordens SAP sem parada correspondente (SAP sem MES). */
  atuacaoForaDeParadaH: number;
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
  /** Início da parada (T0) em [inicio, fim): vem do clique num ponto do gráfico mensal. */
  periodo?: { inicio: Instante; fim: Instante; rotulo: string };
  /** true = só quebras (sem micro-paradas); false = paradas sem registro de quebra. */
  quebra?: boolean;
  /** Componente do MES. */
  componente?: string;
  /** Tipo da ordem SAP; "Sem tipo" pega as ordens sem tipo. */
  tipoSap?: string;
  /** Quebras reincidentes: exige o conjunto calculado sobre o histórico completo. */
  reincidente?: boolean;
}

// ---------------------------------------------------------------- regras

const conciliado = (e: EventoHistorico) => e.classe === "MES + SAP";
const temParada = (e: EventoHistorico) => e.classe !== "SAP sem MES";
const temOrdem = (e: EventoHistorico) => e.classe !== "MES sem SAP";

/** Quebra = parada do MES com registro de QUEBRA, sem contar micro-paradas (< 2 min). */
export function ehQuebra(e: EventoHistorico): boolean {
  return temParada(e) && e.contemQuebra && !e.microParada;
}

export const SEM_TIPO = "Sem tipo";
export const SEM_COMPONENTE = "Sem componente";
const tipoDaOrdem = (e: EventoHistorico) => e.tipoSap ?? SEM_TIPO;

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

/** "AAAA-MM" no calendário de Recife, o mesmo da série mensal. */
export function chaveMes(t: Instante): string {
  const d = dataRecife(t);
  return `${d.ano}-${String(d.mes + 1).padStart(2, "0")}`;
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

/** `reincidentes` vem de `quebrasReincidentes` e só é exigido quando o filtro `reincidente` está definido. */
export function filtrarLista(eventos: EventoHistorico[], f: FiltroLista, reincidentes?: Set<string>): EventoHistorico[] {
  if (f.reincidente !== undefined && reincidentes === undefined) {
    throw new Error("filtrarLista: o filtro 'reincidente' precisa do conjunto de quebras reincidentes.");
  }
  return eventos.filter(
    (e) =>
      (f.maquina === undefined || e.maquina === f.maquina) &&
      (f.classe === undefined || e.classe === f.classe) &&
      (f.confianca === undefined || e.confianca === f.confianca) &&
      (f.revisar === undefined || precisaRevisao(e) === f.revisar) &&
      (f.motivo === undefined || e.motivoSemPar === f.motivo) &&
      (f.divergencia === undefined || (conciliado(e) && PREDICADOS_DIVERGENCIA[f.divergencia](e))) &&
      (f.periodo === undefined ||
        (e.mesInicio !== undefined && e.mesInicio >= f.periodo.inicio && e.mesInicio < f.periodo.fim)) &&
      (f.quebra === undefined || (f.quebra ? ehQuebra(e) : !e.contemQuebra)) &&
      (f.componente === undefined || e.componenteMes === f.componente) &&
      (f.tipoSap === undefined || (temOrdem(e) && tipoDaOrdem(e) === f.tipoSap)) &&
      (f.reincidente === undefined || (reincidentes?.has(e.idEvento) ?? false) === f.reincidente),
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

/**
 * Atuação na parada: ordens dos eventos conciliados, só a parte dentro da parada.
 * Ordens sem parada: duração das ordens "SAP sem MES". Ordens longas (> 24 h de calendário)
 * ficam fora das duas somas, porque medem calendário e não atuação.
 */
export function porMaquinaHistorico(eventos: EventoHistorico[]): LinhaMaquinaHistorico[] {
  return agruparPorMaquina(eventos)
    .map(([maquina, lista]) => {
      const classes = contarClasses(lista);
      return {
        maquina,
        eventos: lista.length,
        paradoH: soma(lista.map((e) => e.indisponibilidadeH)),
        atuacaoNaParadaH: soma(lista.filter((e) => conciliado(e) && !e.ordemLonga).map((e) => e.atuacaoNaParadaH)),
        atuacaoForaDeParadaH: soma(
          lista.filter((e) => e.classe === "SAP sem MES" && !e.ordemLonga).map((e) => e.atuacaoH),
        ),
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

/**
 * Eventos com ordem (MES + SAP e SAP sem MES) por tipo da ordem SAP e máquina. Os tipos saem
 * dos dados, sem lista fixa; quando uma parada recebeu várias ordens, vale o tipo da de maior score.
 */
export function porTipoManutencao(eventos: EventoHistorico[]): TabelaCruzada {
  const comOrdem = eventos.filter(temOrdem);
  const tipos = [...new Set(comOrdem.map(tipoDaOrdem))];
  const tabela = cruzar(
    comOrdem,
    tipos.map((t) => ({ chave: t, rotulo: t, casa: (e: EventoHistorico) => tipoDaOrdem(e) === t })),
  );
  return { ...tabela, linhas: [...tabela.linhas].sort((a, b) => b.total - a.total || a.rotulo.localeCompare(b.rotulo)) };
}

// ---------------------------------------------------------------- confiabilidade

export interface Janela {
  inicio: Instante;
  fim: Instante;
}

export interface ConfiabilidadeMaquina {
  maquina: string;
  quebras: number;
  /** Média de T5−T0 das quebras. */
  mttrMin: number | null;
  mttrMedianaMin: number | null;
  /** null com menos de 2 quebras. */
  mtbfH: number | null;
  /** 0..1; null se a janela tem duração zero. */
  disponibilidade: number | null;
  tempoOperandoH: number;
}

type ComInicio = EventoHistorico & { mesInicio: Instante };
const paradaComInicio = (e: EventoHistorico): e is ComInicio => temParada(e) && e.mesInicio !== undefined;
const fimDaParada = (e: ComInicio) => e.mesFim ?? e.mesInicio + (e.indisponibilidadeH ?? 0) * MS_POR_H;

/**
 * Janela de observação [inicio, fim), a mesma para todas as máquinas. Sem mês: da primeira parada
 * à última retomada do histórico completo. Com mês ("AAAA-MM"): o mês de calendário em Recife,
 * cortado à janela sem filtro (o primeiro e o último mês podem estar incompletos).
 * null quando não há nenhuma parada.
 */
export function janelaObservacao(todos: EventoHistorico[], mes: string | null): Janela | null {
  const paradas = todos.filter(paradaComInicio);
  if (paradas.length === 0) return null;
  const inicio = Math.min(...paradas.map((e) => e.mesInicio));
  const fim = Math.max(...paradas.map(fimDaParada));
  if (mes === null) return { inicio, fim };
  const [ano, m] = mes.split("-").map(Number);
  const deMes = Math.max(inicio, meiaNoiteRecife(ano, m - 1, 1));
  const ateMes = Math.min(fim, meiaNoiteRecife(ano, m, 1));
  return { inicio: deMes, fim: Math.max(deMes, ateMes) };
}

/**
 * Confiabilidade por máquina na janela, sobre os eventos já filtrados por máquina e mês.
 * - Quebra: parada do MES com registro de QUEBRA e sem micro-parada, com início dentro da janela.
 * - Tempo parado: soma das paradas (todas as famílias, inclusive ajustes e micro-paradas) cortadas
 *   à janela. As paradas de uma máquina não se sobrepõem, então a soma é a união.
 * - Tempo operando = janela − tempo parado: a planta opera em regime contínuo.
 * - MTBF = tempo operando ÷ quebras (null com menos de 2). MTTR = média de T5−T0 das quebras,
 *   com a mediana ao lado porque a distribuição é assimétrica. Disponibilidade = operando ÷ janela.
 */
export function confiabilidadePorMaquina(eventos: EventoHistorico[], janela: Janela): ConfiabilidadeMaquina[] {
  const duracaoH = (janela.fim - janela.inicio) / MS_POR_H;
  return agruparPorMaquina(eventos.filter(paradaComInicio))
    .map(([maquina, lista]) => {
      const paradas = lista as ComInicio[];
      const paradoH = soma(
        paradas.map((e) => Math.max(0, Math.min(janela.fim, fimDaParada(e)) - Math.max(janela.inicio, e.mesInicio)) / MS_POR_H),
      );
      const quebras = paradas.filter((e) => ehQuebra(e) && e.mesInicio >= janela.inicio && e.mesInicio < janela.fim);
      const reparos = quebras.flatMap((e) => (e.indisponibilidadeH === null ? [] : [e.indisponibilidadeH * MIN_POR_H]));
      const tempoOperandoH = Math.max(0, duracaoH - paradoH);
      return {
        maquina,
        quebras: quebras.length,
        mttrMin: reparos.length === 0 ? null : soma(reparos) / reparos.length,
        mttrMedianaMin: percentil(reparos, 0.5),
        mtbfH: quebras.length < 2 ? null : tempoOperandoH / quebras.length,
        disponibilidade: duracaoH > 0 ? tempoOperandoH / duracaoH : null,
        tempoOperandoH,
      };
    })
    .sort((a, b) => b.quebras - a.quebras || a.maquina.localeCompare(b.maquina));
}

// ---------------------------------------------------------------- Pareto

export type MetricaPareto = "horas" | "quebras";

export interface ItemPareto {
  maquina: string;
  /** componenteMes; nulo vira "Sem componente". */
  componente: string;
  /** Só o componente se houver uma máquina; "A · FD" se houver várias. */
  rotulo: string;
  /** Horas paradas ou nº de quebras. */
  valor: number;
  /** Eventos que entraram. */
  n: number;
  /** 0..1, fração acumulada até este item (sobre o total, incluindo "outros"). */
  acumulado: number;
}

export interface Pareto {
  itens: ItemPareto[];
  outros: { valor: number; n: number } | null;
  total: number;
}

/**
 * Pareto por máquina + componente (o mesmo código pode existir em máquinas diferentes).
 * Entram só as paradas do MES; na métrica "quebras", só as quebras (sem ajustes nem micro-paradas).
 */
export function paretoComponentes(eventos: EventoHistorico[], metrica: MetricaPareto, limite = 10): Pareto {
  const entram = eventos.filter((e) => temParada(e) && (metrica === "horas" || ehQuebra(e)));
  const grupos = new Map<string, { maquina: string; componente: string; valor: number; n: number }>();
  for (const e of entram) {
    const componente = e.componenteMes ?? SEM_COMPONENTE;
    const chave = `${e.maquina}\u0000${componente}`;
    const g = grupos.get(chave) ?? { maquina: e.maquina, componente, valor: 0, n: 0 };
    grupos.set(chave, { ...g, valor: g.valor + (metrica === "horas" ? (e.indisponibilidadeH ?? 0) : 1), n: g.n + 1 });
  }
  const variasMaquinas = new Set(entram.map((e) => e.maquina)).size > 1;
  const rotulo = (g: { maquina: string; componente: string }) => (variasMaquinas ? `${g.maquina} · ${g.componente}` : g.componente);
  const ordenados = [...grupos.values()].sort(
    (a, b) => b.valor - a.valor || b.n - a.n || rotulo(a).localeCompare(rotulo(b)),
  );
  const total = soma(ordenados.map((g) => g.valor));
  const resto = ordenados.slice(limite);
  let acc = 0;
  const itens = ordenados.slice(0, limite).map((g) => {
    acc += g.valor;
    return { ...g, rotulo: rotulo(g), acumulado: total > 0 ? acc / total : 0 };
  });
  const outros = resto.length === 0 ? null : { valor: soma(resto.map((g) => g.valor)), n: soma(resto.map((g) => g.n)) };
  return { itens, outros, total };
}

/** Quantos itens do Pareto são necessários para chegar à fração; null se não chegar dentro dos itens. */
export function itensAteFracao(itens: ItemPareto[], fracao: number): number | null {
  const i = itens.findIndex((it) => it.acumulado >= fracao);
  return i === -1 ? null : i + 1;
}

// ---------------------------------------------------------------- reincidência

/** A mesma janela do critério C5 da priorização (`reincidenciaDias` em tipos.ts). */
export const JANELA_REINCIDENCIA_DIAS = CONFIG_PADRAO.reincidenciaDias;

/**
 * idEvento das quebras reincidentes, calculado sobre o histórico completo. Uma quebra é
 * reincidente se outra quebra da mesma máquina e do mesmo componente (não nulo) começou nos
 * JANELA_REINCIDENCIA_DIAS dias anteriores ao seu início. Calcular sobre o histórico completo
 * mantém a referência da quebra do fim do mês anterior quando a tela filtra um mês.
 */
export function quebrasReincidentes(todos: EventoHistorico[]): Set<string> {
  const janelaMs = JANELA_REINCIDENCIA_DIAS * MS_POR_DIA;
  const grupos = new Map<string, ComInicio[]>();
  for (const e of todos) {
    if (!paradaComInicio(e) || !ehQuebra(e) || e.componenteMes === null) continue;
    const chave = `${e.maquina}\u0000${e.componenteMes}`;
    grupos.set(chave, [...(grupos.get(chave) ?? []), e]);
  }
  const reincidentes = new Set<string>();
  for (const lista of grupos.values()) {
    const ordenada = [...lista].sort((a, b) => a.mesInicio - b.mesInicio);
    ordenada.forEach((e, i) => {
      if (i > 0 && e.mesInicio - ordenada[i - 1].mesInicio <= janelaMs) reincidentes.add(e.idEvento);
    });
  }
  return reincidentes;
}

export interface ReincidenciaMaquina {
  maquina: string;
  quebras: number;
  reincidentes: number;
  /** null sem quebras. */
  taxa: number | null;
}

export function reincidenciaPorMaquina(eventos: EventoHistorico[], reincidentes: Set<string>): ReincidenciaMaquina[] {
  return agruparPorMaquina(eventos.filter(temParada)).map(([maquina, lista]) => {
    const quebras = lista.filter(ehQuebra);
    const r = quebras.filter((e) => reincidentes.has(e.idEvento)).length;
    return { maquina, quebras: quebras.length, reincidentes: r, taxa: quebras.length === 0 ? null : r / quebras.length };
  });
}

export interface ComponenteReincidente {
  maquina: string;
  componente: string;
  reincidentes: number;
  quebras: number;
}

/** Componentes com mais quebras reincidentes, de máquina + componente. */
export function componentesReincidentes(
  eventos: EventoHistorico[],
  reincidentes: Set<string>,
  limite = 5,
): ComponenteReincidente[] {
  const grupos = new Map<string, ComponenteReincidente>();
  for (const e of eventos) {
    if (!ehQuebra(e) || e.componenteMes === null) continue;
    const chave = `${e.maquina}\u0000${e.componenteMes}`;
    const g = grupos.get(chave) ?? { maquina: e.maquina, componente: e.componenteMes, reincidentes: 0, quebras: 0 };
    grupos.set(chave, { ...g, quebras: g.quebras + 1, reincidentes: g.reincidentes + (reincidentes.has(e.idEvento) ? 1 : 0) });
  }
  return [...grupos.values()]
    .filter((g) => g.reincidentes > 0)
    .sort(
      (a, b) =>
        b.reincidentes - a.reincidentes ||
        b.quebras - a.quebras ||
        `${a.maquina}${a.componente}`.localeCompare(`${b.maquina}${b.componente}`),
    )
    .slice(0, limite);
}

// ---------------------------------------------------------------- gráficos

/** O gráfico de espera recorta o eixo em ±2 h; os valores de fora viram aviso. */
export const LIMITE_EIXO_ESPERA_MIN = 120;

export interface DistribuicaoEspera {
  maquina: string;
  p10: number | null;
  p25: number | null;
  mediana: number | null;
  p75: number | null;
  p90: number | null;
  n: number;
  /** Eventos fora do eixo recortado. */
  abaixo: number;
  acima: number;
}

/** Espera até a atuação (T2−T0) por máquina, só nos pares confiáveis (mesma regra dos cartões). */
export function distribuicaoEspera(eventos: EventoHistorico[]): DistribuicaoEspera[] {
  return agruparPorMaquina(eventos).map(([maquina, lista]) => {
    const v = lista.filter(entraNasMetricas).flatMap((e) => (e.esperaAteAtuacaoMin === null ? [] : [e.esperaAteAtuacaoMin]));
    return {
      maquina,
      p10: percentil(v, 0.1),
      p25: percentil(v, 0.25),
      mediana: percentil(v, 0.5),
      p75: percentil(v, 0.75),
      p90: percentil(v, 0.9),
      n: v.length,
      abaixo: v.filter((x) => x < -LIMITE_EIXO_ESPERA_MIN).length,
      acima: v.filter((x) => x > LIMITE_EIXO_ESPERA_MIN).length,
    };
  });
}

export type MetricaSerie = "horas" | "quebras";
export type Granularidade = "mes" | "semana";

/** Abaixo de ~4 meses de dados, a série mensal teria poucos pontos: agrupa por semana. */
export const DIAS_MINIMOS_MENSAL = 120;
/** Período com menos de 90% de cobertura pelos dados é marcado como incompleto. */
const COBERTURA_MINIMA = 0.9;

export interface PeriodoSerie {
  chave: string;
  rotulo: string;
  inicio: Instante;
  fim: Instante;
  /** Primeiro ou último período sem cobertura completa: não é queda, é falta de dado. */
  incompleto: boolean;
  /** Por máquina: horas paradas ou número de quebras. */
  valores: Record<string, number>;
  /** Por máquina: eventos que entraram no valor. */
  n: Record<string, number>;
}

export interface SerieMensal {
  granularidade: Granularidade;
  maquinas: string[];
  periodos: PeriodoSerie[];
}

function inicioDoPeriodo(t: Instante, g: Granularidade): Instante {
  const d = dataRecife(t);
  if (g === "mes") return meiaNoiteRecife(d.ano, d.mes, 1);
  // Semana começando na segunda-feira.
  return meiaNoiteRecife(d.ano, d.mes, d.dia - ((d.diaSemana + 6) % 7));
}

function proximoPeriodo(inicio: Instante, g: Granularidade): Instante {
  if (g === "semana") return inicio + 7 * MS_POR_DIA;
  const d = dataRecife(inicio);
  return meiaNoiteRecife(d.ano, d.mes + 1, 1);
}

/**
 * Horas paradas ou quebras por máquina ao longo do tempo, pelo início da parada (T0, fuso America/Recife).
 * Entram só eventos com parada no MES (MES + SAP e MES sem SAP).
 */
export function serieMensal(eventos: EventoHistorico[], metrica: MetricaSerie): SerieMensal {
  const comParada = eventos.filter((e): e is EventoHistorico & { mesInicio: Instante } => temParada(e) && e.mesInicio !== undefined);
  const maquinas = maquinasDoHistorico(comParada);
  if (comParada.length === 0) return { granularidade: "mes", maquinas, periodos: [] };

  const instantes = comParada.map((e) => e.mesInicio);
  const primeiro = Math.min(...instantes);
  const ultimo = Math.max(...instantes);
  const granularidade: Granularidade = ultimo - primeiro < DIAS_MINIMOS_MENSAL * MS_POR_DIA ? "semana" : "mes";
  const conta = (e: EventoHistorico) => (metrica === "horas" ? (e.indisponibilidadeH ?? 0) : ehQuebra(e) ? 1 : 0);
  const entra = (e: EventoHistorico) => (metrica === "horas" ? true : ehQuebra(e));

  const periodos: PeriodoSerie[] = [];
  for (let inicio = inicioDoPeriodo(primeiro, granularidade); inicio <= ultimo; ) {
    const fim = proximoPeriodo(inicio, granularidade);
    const doPeriodo = comParada.filter((e) => e.mesInicio >= inicio && e.mesInicio < fim);
    const coberto = Math.min(fim, ultimo + MS_POR_DIA) - Math.max(inicio, primeiro);
    const porMaquina = (f: (lista: EventoHistorico[]) => number) =>
      Object.fromEntries(maquinas.map((m) => [m, f(doPeriodo.filter((e) => e.maquina === m))]));
    periodos.push({
      chave: String(inicio),
      rotulo: granularidade === "mes" ? rotuloMesCurto(inicio) : rotuloDia(inicio),
      inicio,
      fim,
      incompleto: coberto / (fim - inicio) < COBERTURA_MINIMA,
      valores: porMaquina((l) => soma(l.map(conta))),
      n: porMaquina((l) => l.filter(entra).length),
    });
    inicio = fim;
  }
  return { granularidade, maquinas, periodos };
}

// ---------------------------------------------------------------- CSV

/** Data e hora em Recife "AAAA-MM-DD hh:mm", que o Excel reconhece como data. */
const dataHora = (t?: Instante) => (t === undefined ? "" : dataHoraRecife(t));

/** Decimal com vírgula, como o Excel em português espera. */
const decimal = (n: number | null, casas = 2) => (n === null ? "" : n.toFixed(casas).replace(".", ","));
const simNao = (b: boolean) => (b ? "sim" : "não");

/** `reincidentes` (de `quebrasReincidentes`) preenche a coluna "reincidente"; sem ele, fica "não". */
export function gerarCsvHistorico(eventos: EventoHistorico[], reincidentes: Set<string> = new Set()): string {
  const cab = [
    "id_evento", "maquina", "classe", "confianca", "score", "revisar", "ambiguo", "ordem_longa",
    "possivel_duplicidade_sap", "id_parada", "equipamento_mes", "familia_mes", "componente_mes", "micro_parada",
    "reincidente", "ids_registro_mes",
    "t0_mes_inicio", "t2_sap_inicio", "t4_sap_fim", "t5_mes_fim", "indisponibilidade_h", "atuacao_h",
    "atuacao_na_parada_h", "espera_ate_atuacao_min", "retomada_apos_atuacao_min", "dif_duracao_h",
    "divergencia_duracao", "sap_antes_da_parada", "ordens", "tipo_sap", "tipo_atividade_sap", "descricao_equip_sap",
    "texto_sap", "motivo_sem_par",
  ];
  const linhas = eventos.map((e) =>
    [
      e.idEvento, e.maquina, e.classe, e.confianca ?? "", decimal(e.score, 3), simNao(e.revisar), simNao(e.ambiguo),
      simNao(e.ordemLonga), simNao(e.possivelDuplicidadeSap), e.idParada ?? "", e.equipamentoMes ?? "",
      e.familiaMes ?? "", e.componenteMes ?? "", simNao(e.microParada), simNao(reincidentes.has(e.idEvento)),
      e.idsRegistroMes.join(", "),
      dataHora(e.mesInicio), dataHora(e.sapInicio), dataHora(e.sapFim), dataHora(e.mesFim),
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
