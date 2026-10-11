import { describe, expect, it } from "vitest";
import { metasParaTexto, validarMetas } from "./metas";
import { CONFIG_PADRAO } from "./tipos";

describe("metas de início", () => {
  it("converte as metas da config para o formulário, com vazio para sem meta", () => {
    expect(metasParaTexto(CONFIG_PADRAO.metaInicioMin)).toEqual({ P0: "10", P1: "15", P2: "30", P3: "120" });
  });

  it("aceita inteiros e transforma vazio em sem meta", () => {
    expect(validarMetas({ P0: "10", P1: " 15 ", P2: "0", P3: "" })).toEqual({
      ok: true,
      metas: { P0: 10, P1: 15, P2: 0, P3: null },
    });
  });

  it("recusa negativos, decimais, texto e valores acima de um dia", () => {
    const r = validarMetas({ P0: "-1", P1: "2.5", P2: "abc", P3: "1441" });
    expect(r.ok).toBe(false);
    expect(r.ok ? [] : Object.keys(r.erros)).toEqual(["P0", "P1", "P2", "P3"]);
  });
});
