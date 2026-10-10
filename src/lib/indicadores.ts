import { celula, textoLivre } from "./csv";
import { chaveDia, diasEntre, rotuloDia } from "./fuso";
import { prioridadeAtual } from "./prioridade";
import { mediana, minutosPausados, percentil, temposChamado, type TemposChamado } from "./tempo";
import type { Chamado, Classe, ConfigPriorizacao, Instante } from "./tipos";

export interface ResumoTempo {
  mediana: number | null;
  p90: number | null;
}

export interface MetaPorClasse {
  classe: Classe;
  total: number;
  cumpriu: number;
}

export interface LinhaMaquina {
  maquina: string;
  chamados: number;
  paradoMin: number;
  erroMaisFrequente: string;
}

const CLASSES: Classe[] = ["P0", "P1", "P2", "P3", "P4"];

export function resumir(valores: (number | null)[]): ResumoTempo {
  const v = valores.filter((x): x is number => x !== null);
  return { mediana: mediana(v), p90: percentil(v, 0.9) };
}

export function resumoTempos(chamados: Chamado[]): Record<keyof TemposChamado, ResumoTempo> {
  const t = chamados.map(temposChamado);
  return {
    reacaoMin: resumir(t.map((x) => x.reacaoMin)),
    esperaMin: resumir(t.map((x) => x.esperaMin)),
    reparoMin: resumir(t.map((x) => x.reparoMin)),
    indisponibilidadeMin: resumir(t.map((x) => x.indisponibilidadeMin)),
  };
}

/** Classe vigente no momento do início do atendimento contra a meta dessa classe. */
export function metaPorClasse(chamados: Chamado[], config: ConfigPriorizacao): MetaPorClasse[] {
  const contagem = new Map<Classe, MetaPorClasse>(CLASSES.map((c) => [c, { classe: c, total: 0, cumpriu: 0 }]));
  for (const c of chamados) {
    if (c.marcos.inicio === undefined) continue;
    const inicio = c.marcos.inicio;
    const classe = prioridadeAtual(c, inicio, config).classe;
    const meta = config.metaInicioMin[classe];
    const espera = (inicio - c.marcos.abertura) / 60_000;
    const linha = contagem.get(classe)!;
    contagem.set(classe, {
      ...linha,
      total: linha.total + 1,
      cumpriu: linha.cumpriu + (meta === null || espera <= Math.max(meta, 1) ? 1 : 0),
    });
  }
  return [...contagem.values()].filter((l) => l.total > 0);
}

export function porMaquina(chamados: Chamado[]): LinhaMaquina[] {
  const grupos = new Map<string, Chamado[]>();
  chamados.forEach((c) => grupos.set(c.maquinaNome, [...(grupos.get(c.maquinaNome) ?? []), c]));
  return [...grupos.entries()]
    .map(([maquina, lista]) => {
      const freq = new Map<string, number>();
      lista.forEach((c) => freq.set(c.erroNome, (freq.get(c.erroNome) ?? 0) + 1));
      const [erro] = [...freq.entries()].sort((a, b) => b[1] - a[1])[0] ?? ["—"];
      const paradoMin = lista
        .filter((c) => c.condicao === "parada")
        .reduce((s, c) => s + (temposChamado(c).indisponibilidadeMin ?? 0), 0);
      return { maquina, chamados: lista.length, paradoMin, erroMaisFrequente: erro };
    })
    .sort((a, b) => b.paradoMin - a.paradoMin);
}

// ---------------------------------------------------------------- gráficos

export const TRECHOS = ["reacao", "deslocamento", "reparo", "pausas", "liberacao"] as const;
export type Trecho = (typeof TRECHOS)[number];

export const ROTULOS_TRECHO: Record<Trecho, string> = {
  reacao: "Reação (T1−T0)",
  deslocamento: "Deslocamento (T2−T1)",
  reparo: "Reparo líquido",
  pausas: "Pausas",
  liberacao: "Liberação (T5−T4)",
};

export type AgrupamentoDecomposicao = "maquina" | "classe";

export interface GrupoDecomposicao {
  grupo: string;
  n: number;
  /** Médias somáveis: a soma dos trechos é a indisponibilidade média. */
  media: Record<Trecho, number>;
  mediana: Record<Trecho, number>;
  indisponibilidadeMedia: number;
}

export interface Decomposicao {
  grupos: GrupoDecomposicao[];
  /** Chamados com todos os marcos T0, T1, T2, T4 e T5. */
  n: number;
  total: number;
}

/**
 * Os cinco trechos de um chamado, em minutos. Reparo líquido e pausas contam só as pausas
 * dentro da atuação (T2 a T4), então a soma é exatamente T5−T0. Null se faltar algum marco.
 */
export function trechosChamado(c: Pick<Chamado, "marcos" | "pausas">): Record<Trecho, number> | null {
  const { abertura, recebido, inicio, fimAtuacao, liberado } = c.marcos;
  if (recebido === undefined || inicio === undefined || fimAtuacao === undefined || liberado === undefined) return null;
  const min = (a: number, b: number) => (b - a) / 60_000;
  const pausas = minutosPausados(c.pausas, inicio, fimAtuacao);
  return {
    reacao: min(abertura, recebido),
    deslocamento: min(recebido, inicio),
    reparo: min(inicio, fimAtuacao) - pausas,
    pausas,
    liberacao: min(fimAtuacao, liberado),
  };
}

const media = (v: number[]) => (v.length === 0 ? 0 : v.reduce((s, x) => s + x, 0) / v.length);

/** "Para onde vai o tempo do chamado": média de cada trecho por máquina ou por classe. */
export function decomposicaoTempo(
  chamados: Chamado[],
  agrupamento: AgrupamentoDecomposicao,
  config: ConfigPriorizacao,
): Decomposicao {
  const grupos = new Map<string, Record<Trecho, number>[]>();
  for (const c of chamados) {
    const t = trechosChamado(c);
    if (t === null) continue;
    // Mesma classe da tabela de metas: a vigente no início do atendimento.
    const chave = agrupamento === "maquina" ? c.maquinaNome : prioridadeAtual(c, c.marcos.inicio!, config).classe;
    grupos.set(chave, [...(grupos.get(chave) ?? []), t]);
  }
  const lista = [...grupos.entries()].map(([grupo, ts]) => {
    const porTrecho = (f: (v: number[]) => number) =>
      Object.fromEntries(TRECHOS.map((k) => [k, f(ts.map((t) => t[k]))])) as Record<Trecho, number>;
    const m = porTrecho(media);
    return {
      grupo,
      n: ts.length,
      media: m,
      mediana: porTrecho((v) => mediana(v) ?? 0),
      indisponibilidadeMedia: TRECHOS.reduce((s, k) => s + m[k], 0),
    };
  });
  return {
    grupos: lista.sort((a, b) => b.indisponibilidadeMedia - a.indisponibilidadeMedia),
    n: lista.reduce((s, g) => s + g.n, 0),
    total: chamados.length,
  };
}

/** Abaixo disso a mediana do dia é instável (ponto vazado no gráfico). */
export const MIN_CHAMADOS_DIA = 3;

export interface PontoDiario {
  /** "AAAA-MM-DD" em Recife. */
  dia: string;
  rotulo: string;
  encerrados: number;
  /** Null nos dias sem chamado com T2: a linha não atravessa o vazio. */
  esperaMediana: number | null;
  nEspera: number;
}

/** Chamados por dia de abertura (T0, fuso America/Recife), com todos os dias do intervalo. */
export function serieDiaria(chamados: Chamado[], desde: Instante, ate: Instante): PontoDiario[] {
  const porDia = new Map<string, Chamado[]>();
  chamados.forEach((c) => {
    const k = chaveDia(c.marcos.abertura);
    porDia.set(k, [...(porDia.get(k) ?? []), c]);
  });
  return diasEntre(desde, ate).map((t) => {
    const lista = porDia.get(chaveDia(t)) ?? [];
    const esperas = lista.flatMap((c) => {
      const e = temposChamado(c).esperaMin;
      return e === null ? [] : [e];
    });
    return {
      dia: chaveDia(t),
      rotulo: rotuloDia(t),
      encerrados: lista.length,
      esperaMediana: mediana(esperas),
      nEspera: esperas.length,
    };
  });
}

const iso = (t?: Instante) => (t === undefined ? "" : new Date(t).toISOString());

/** CSV (separador ;) com todos os marcos — insumo da conciliação com MES/SAP. */
export function gerarCsv(chamados: Chamado[]): string {
  const cab = [
    "numero", "maquina", "tag", "subdivisao", "erro", "erro_revisado", "descricao", "condicao", "risco_pessoas",
    "impacto_qualidade", "classe_base", "score_base", "override", "solicitante", "responsavel", "status",
    "t0_abertura", "t1_recebido", "t2_inicio", "t4_fim_atuacao", "t5_liberado", "pausas",
    "reacao_min", "espera_min", "reparo_min", "indisponibilidade_min",
    "componente", "modo_falha", "acao", "pecas", "obs",
  ];
  const linhas = chamados.map((c) => {
    const t = temposChamado(c);
    const r = (n: number | null) => (n === null ? "" : n.toFixed(1));
    return [
      c.numero, c.maquinaNome, c.tag, c.subdivisaoNome, c.erroNome, c.erroIdRevisado ?? "", textoLivre(c.descricaoLivre),
      c.condicao, c.riscoPessoas, c.impactoQualidade, c.prioridade.classeBase, c.prioridade.scoreBase,
      c.override?.classe ?? "", c.solicitante.nome, c.responsavel?.nome ?? "", c.status,
      iso(c.marcos.abertura), iso(c.marcos.recebido), iso(c.marcos.inicio), iso(c.marcos.fimAtuacao), iso(c.marcos.liberado),
      c.pausas.map((p) => `${iso(p.inicio)}/${iso(p.fim)} ${p.motivo}`).join(" | "),
      r(t.reacaoMin), r(t.esperaMin), r(t.reparoMin), r(t.indisponibilidadeMin),
      c.conclusao?.componente ?? "", c.conclusao?.modoFalha ?? "", c.conclusao?.acao ?? "", c.conclusao?.pecas ?? "", textoLivre(c.conclusao?.obs),
    ].map(celula).join(";");
  });
  return [cab.join(";"), ...linhas].join("\n");
}
