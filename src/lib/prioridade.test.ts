import { describe, expect, it } from "vitest";
import {
  classe,
  criterios,
  estourouMeta,
  explicarScore,
  ordenarFila,
  prioridadeAtual,
  scoreBase,
  scoreEfetivo,
  type ChamadoPriorizavel,
} from "./prioridade";
import { CONFIG_PADRAO as CFG, type Criterios, type Override } from "./tipos";

const AGORA = Date.UTC(2026, 9, 14, 14, 0);
const min = (n: number) => n * 60_000;
const instante = (ms: number) => ms;

function chamado(
  c: Criterios,
  opts: { esperaMin?: number; risco?: boolean; override?: Override["classe"]; inicioMin?: number } = {},
): ChamadoPriorizavel {
  const abertura = AGORA - min(opts.esperaMin ?? 0);
  return {
    riscoPessoas: opts.risco ?? false,
    override: opts.override
      ? { classe: opts.override, justificativa: "x", por: "lider", em: instante(AGORA) }
      : null,
    prioridade: { scoreBase: scoreBase(c, CFG.pesos), classeBase: "P3", criterios: c, versaoConfig: 1 },
    marcos: {
      abertura: instante(abertura),
      ...(opts.inicioMin !== undefined ? { inicio: instante(abertura + min(opts.inicioMin)) } : {}),
    },
  };
}

const ZERO: Criterios = { c1: 0, c2: 0, c3: 0, c4: 0, c5: 0 };

describe("criterios", () => {
  it("mapeia condição, impacto, qualidade, histórico e reincidência para [0, 1]", () => {
    const c = criterios(
      { impactoValor: 0.7 },
      { critHist: 0.4 },
      { condicao: "restricao", impactoQualidade: true },
      5,
      CFG,
    );
    expect(c).toEqual({ c1: 0.5, c2: 0.7, c3: 1, c4: 0.4, c5: 1 });
  });

  it("reincidência satura em 2 ocorrências", () => {
    const base = { condicao: "parada" as const, impactoQualidade: false };
    expect(criterios({ impactoValor: 1 }, { critHist: 0 }, base, 1, CFG).c5).toBe(0.5);
    expect(criterios({ impactoValor: 1 }, { critHist: 0 }, base, 0, CFG).c5).toBe(0);
  });
});

describe("scoreBase e scoreEfetivo", () => {
  it("soma ponderada em escala 0–100 com 1 casa", () => {
    expect(scoreBase({ c1: 1, c2: 1, c3: 1, c4: 1, c5: 1 }, CFG.pesos)).toBe(100);
    expect(scoreBase({ c1: 1, c2: 1, c3: 0, c4: 0.33, c5: 0 }, CFG.pesos)).toBe(71.3);
  });

  it("envelhecimento não passa de maxPts", () => {
    expect(scoreEfetivo(10, 60, CFG.aging)).toBe(40);
    expect(scoreEfetivo(10, 600, CFG.aging)).toBe(40);
    expect(scoreEfetivo(10, 20, CFG.aging)).toBe(20);
  });
});

describe("classe", () => {
  it("risco a pessoas dá sempre P0, mesmo com o restante zerado", () => {
    expect(classe(0, true, CFG.limiares)).toBe("P0");
    const p = prioridadeAtual(chamado(ZERO, { risco: true }), AGORA, CFG);
    expect(p.classe).toBe("P0");
  });

  it("respeita os limiares", () => {
    expect(classe(70, false, CFG.limiares)).toBe("P1");
    expect(classe(69.9, false, CFG.limiares)).toBe("P2");
    expect(classe(50, false, CFG.limiares)).toBe("P2");
    expect(classe(49.9, false, CFG.limiares)).toBe("P3");
    expect(classe(0, false, CFG.limiares)).toBe("P3");
  });

  it("um chamado P3 esperando 60 minutos ganha +30 pontos e sobe de classe", () => {
    const c = chamado({ c1: 0.5, c2: 0.4, c3: 0, c4: 0.5, c5: 0 }, { esperaMin: 60 });
    expect(prioridadeAtual({ ...c, marcos: { abertura: instante(AGORA) } }, AGORA, CFG).classe).toBe("P3");
    const p = prioridadeAtual(c, AGORA, CFG);
    expect(p.scoreEfetivo).toBe(c.prioridade.scoreBase + 30);
    expect(p.classe).toBe("P2");
  });

  it("override do líder define a classe vigente", () => {
    const p = prioridadeAtual(chamado(ZERO, { override: "P1" }), AGORA, CFG);
    expect(p.classeCalculada).toBe("P3");
    expect(p.classe).toBe("P1");
  });
});

describe("ordenarFila", () => {
  const parada = (impacto: number) => ({ c1: 1, c2: impacto, c3: 0, c4: 0.5, c5: 0 });

  it("Máquina A parada fica à frente de Máquina D parada", () => {
    const a = chamado(parada(1.0));
    const d = chamado(parada(0.7));
    expect(ordenarFila([d, a], AGORA, CFG)).toEqual([a, d]);
  });

  it("P0 vem primeiro, mesmo com score menor", () => {
    const risco = chamado(ZERO, { risco: true });
    const a = chamado(parada(1.0));
    expect(ordenarFila([a, risco], AGORA, CFG)[0]).toBe(risco);
  });

  it("override do líder sobe o chamado de classe", () => {
    const baixo = chamado(ZERO, { override: "P1" });
    const p2 = chamado({ c1: 1, c2: 0.4, c3: 0, c4: 0, c5: 0 });
    expect(ordenarFila([p2, baixo], AGORA, CFG)[0]).toBe(baixo);
  });

  it("empate exato: vence o mais antigo", () => {
    const novo = chamado(ZERO, { esperaMin: 0 });
    const antigo = { ...chamado(ZERO, { esperaMin: 0 }), marcos: { abertura: instante(AGORA - 1000) } };
    expect(ordenarFila([novo, antigo], AGORA, CFG)).toEqual([antigo, novo]);
  });

  it("não altera o array recebido", () => {
    const lista = [chamado(parada(0.7)), chamado(parada(1.0))];
    const copia = [...lista];
    ordenarFila(lista, AGORA, CFG);
    expect(lista).toEqual(copia);
  });
});

describe("estourouMeta", () => {
  const p1 = { c1: 1, c2: 1, c3: 0, c4: 0.5, c5: 0 };

  it("ok, atenção a partir de 80% e estourado acima de 100% da meta", () => {
    expect(estourouMeta(chamado(p1, { esperaMin: 5 }), AGORA, CFG)).toBe("ok");
    expect(estourouMeta(chamado(p1, { esperaMin: 12 }), AGORA, CFG)).toBe("atencao");
    expect(estourouMeta(chamado(p1, { esperaMin: 16 }), AGORA, CFG)).toBe("estourado");
  });

  it("congela a espera no início do atendimento", () => {
    expect(estourouMeta(chamado(p1, { esperaMin: 60, inicioMin: 5 }), AGORA, CFG)).toBe("ok");
  });

  it("P3 estoura após 120 minutos e P0 após 10 minutos", () => {
    expect(estourouMeta(chamado(ZERO, { esperaMin: 0 }), AGORA, CFG)).toBe("ok");
    expect(estourouMeta(chamado(ZERO, { esperaMin: 100 }), AGORA, CFG)).toBe("atencao");
    expect(estourouMeta(chamado(ZERO, { esperaMin: 121 }), AGORA, CFG)).toBe("estourado");
    expect(estourouMeta(chamado(ZERO, { risco: true, esperaMin: 5 }), AGORA, CFG)).toBe("ok");
    expect(estourouMeta(chamado(ZERO, { risco: true, esperaMin: 9 }), AGORA, CFG)).toBe("atencao");
    expect(estourouMeta(chamado(ZERO, { risco: true, esperaMin: 11 }), AGORA, CFG)).toBe("estourado");
  });

  it("meta 0 significa imediato: estoura após 1 minuto", () => {
    const imediato = { ...CFG, metaInicioMin: { ...CFG.metaInicioMin, P0: 0 } };
    expect(estourouMeta(chamado(ZERO, { risco: true }), AGORA, imediato)).toBe("atencao");
    expect(estourouMeta(chamado(ZERO, { risco: true, esperaMin: 2 }), AGORA, imediato)).toBe("estourado");
  });
});

describe("explicarScore", () => {
  it("decompõe o score em pontos por critério, omitindo zeros", () => {
    const partes = explicarScore({ c1: 1, c2: 1, c3: 0, c4: 0.6, c5: 0 }, CFG.pesos);
    expect(partes.map((p) => [p.rotulo, p.pontos])).toEqual([
      ["condição", 42],
      ["impacto da máquina", 26],
      ["histórico", 6],
    ]);
  });
});
