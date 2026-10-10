import { describe, expect, it } from "vitest";
import {
  formatarCronometro,
  formatarMinutos,
  mediana,
  minutosPausados,
  percentil,
  temposChamado,
} from "./tempo";

const T0 = Date.UTC(2026, 9, 14, 14, 0);
const em = (min: number) => T0 + min * 60_000;

describe("temposChamado", () => {
  it("calcula reação, espera, reparo sem pausas e indisponibilidade", () => {
    const t = temposChamado({
      marcos: { abertura: em(0), recebido: em(3), inicio: em(10), fimAtuacao: em(70), liberado: em(80) },
      pausas: [{ inicio: em(20), fim: em(35), motivo: "peça" }],
    });
    expect(t).toEqual({ reacaoMin: 3, esperaMin: 10, reparoMin: 45, indisponibilidadeMin: 80 });
  });

  it("devolve null para marcos ainda não registrados", () => {
    const t = temposChamado({ marcos: { abertura: em(0) }, pausas: [] });
    expect(t.reacaoMin).toBeNull();
    expect(t.reparoMin).toBeNull();
  });
});

describe("minutosPausados", () => {
  it("corta pausas abertas no limite informado", () => {
    expect(minutosPausados([{ inicio: em(10), motivo: "x" }], T0, em(25))).toBe(15);
  });
});

describe("formatação", () => {
  it("cronômetro em mm:ss e h:mm", () => {
    expect(formatarCronometro(65_000)).toBe("01:05");
    expect(formatarCronometro(3_600_000 + 5 * 60_000)).toBe("1:05h");
    expect(formatarCronometro(-10)).toBe("00:00");
  });

  it("minutos legíveis", () => {
    expect(formatarMinutos(null)).toBe("—");
    expect(formatarMinutos(0.4)).toBe("< 1 min");
    expect(formatarMinutos(42)).toBe("42 min");
    expect(formatarMinutos(125)).toBe("2 h 5 min");
    expect(formatarMinutos(-11)).toBe("−11 min");
    expect(formatarMinutos(-0.4)).toBe("< 1 min");
  });
});

describe("estatísticas", () => {
  it("mediana e P90", () => {
    expect(mediana([])).toBeNull();
    expect(mediana([5, 1, 3])).toBe(3);
    expect(percentil([0, 10], 0.9)).toBe(9);
  });
});
