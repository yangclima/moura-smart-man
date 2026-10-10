import { prioridadeAtual } from "./prioridade";
import { mediana, percentil, temposChamado, type TemposChamado } from "./tempo";
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

const iso = (t?: Instante) => (t === undefined ? "" : new Date(t).toISOString());

function celula(v: unknown): string {
  const s = String(v ?? "");
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

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
      c.numero, c.maquinaNome, c.tag, c.subdivisaoNome, c.erroNome, c.erroIdRevisado ?? "", c.descricaoLivre,
      c.condicao, c.riscoPessoas, c.impactoQualidade, c.prioridade.classeBase, c.prioridade.scoreBase,
      c.override?.classe ?? "", c.solicitante.nome, c.responsavel?.nome ?? "", c.status,
      iso(c.marcos.abertura), iso(c.marcos.recebido), iso(c.marcos.inicio), iso(c.marcos.fimAtuacao), iso(c.marcos.liberado),
      c.pausas.map((p) => `${iso(p.inicio)}/${iso(p.fim)} ${p.motivo}`).join(" | "),
      r(t.reacaoMin), r(t.esperaMin), r(t.reparoMin), r(t.indisponibilidadeMin),
      c.conclusao?.componente ?? "", c.conclusao?.modoFalha ?? "", c.conclusao?.acao ?? "", c.conclusao?.pecas ?? "", c.conclusao?.obs ?? "",
    ].map(celula).join(";");
  });
  return [cab.join(";"), ...linhas].join("\n");
}
