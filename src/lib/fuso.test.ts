import { describe, expect, it } from "vitest";
import { dataHoraRecife } from "./fuso";

describe("dataHoraRecife", () => {
  it("formata no calendário de Recife, independente do fuso do navegador", () => {
    // 01/04 01:30 UTC = 31/03 22:30 em Recife.
    expect(dataHoraRecife(Date.UTC(2026, 3, 1, 1, 30))).toBe("2026-03-31 22:30");
  });
});
