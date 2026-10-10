import type { Chamado, Instante } from "./tipos";

const MS_POR_MIN = 60_000;

export type ChamadoTemporal = Pick<Chamado, "marcos" | "pausas">;

export interface TemposChamado {
  reacaoMin: number | null;
  esperaMin: number | null;
  reparoMin: number | null;
  indisponibilidadeMin: number | null;
}

function minutosEntre(a?: Instante, b?: Instante): number | null {
  if (a === undefined || b === undefined) return null;
  return (b - a) / MS_POR_MIN;
}

/** Soma das pausas (fechadas ou até `ate`) dentro de [de, ate], em minutos. */
export function minutosPausados(pausas: Chamado["pausas"], de: number, ate: number): number {
  return pausas.reduce((total, p) => {
    const ini = Math.max(p.inicio, de);
    const fim = Math.min(p.fim ?? ate, ate);
    return total + Math.max(0, fim - ini) / MS_POR_MIN;
  }, 0);
}

/** Reação = T1−T0 · Espera = T2−T0 · Reparo = T4−T2 sem pausas · Indisponibilidade = T5−T0. */
export function temposChamado(c: ChamadoTemporal): TemposChamado {
  const m = c.marcos;
  const reparoBruto = minutosEntre(m.inicio, m.fimAtuacao);
  const reparo =
    reparoBruto === null || m.inicio === undefined || m.fimAtuacao === undefined
      ? null
      : reparoBruto - minutosPausados(c.pausas, m.inicio, m.fimAtuacao);
  return {
    reacaoMin: minutosEntre(m.abertura, m.recebido),
    esperaMin: minutosEntre(m.abertura, m.inicio),
    reparoMin: reparo,
    indisponibilidadeMin: minutosEntre(m.abertura, m.liberado),
  };
}

/** mm:ss abaixo de uma hora; h:mm acima. */
export function formatarCronometro(ms: number): string {
  const totalSeg = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeg / 3600);
  const m = Math.floor((totalSeg % 3600) / 60);
  const s = totalSeg % 60;
  const dois = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${dois(m)}h` : `${dois(m)}:${dois(s)}`;
}

export function formatarMinutos(min: number | null): string {
  if (min === null || Number.isNaN(min)) return "—";
  if (min < 1) return "< 1 min";
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60);
  const resto = Math.round(min % 60);
  return resto ? `${h} h ${resto} min` : `${h} h`;
}

export function formatarHora(t?: Instante): string {
  if (t === undefined) return "—";
  return new Date(t).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function formatarDataHora(t?: Instante): string {
  if (t === undefined) return "—";
  return new Date(t).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function mediana(valores: number[]): number | null {
  return percentil(valores, 0.5);
}

/** Percentil com interpolação linear (p em [0, 1]). */
export function percentil(valores: number[], p: number): number | null {
  if (valores.length === 0) return null;
  const v = [...valores].sort((a, b) => a - b);
  const pos = (v.length - 1) * p;
  const base = Math.floor(pos);
  const prox = v[base + 1];
  return prox === undefined ? v[base] : v[base] + (pos - base) * (prox - v[base]);
}
