import { describe, expect, it } from "vitest";
import { casaBusca, normalizar } from "./busca";
import { contarPorPapel, filtrarPessoas, iniciais, type Pessoa } from "./equipe";
import { filtrarMaquinas, linhasDasMaquinas, maquinaExata } from "./qrcodes";
import type { Maquina } from "./tipos";

describe("busca", () => {
  it("ignora acentos, caixa e ordem das palavras", () => {
    expect(normalizar("  João ÁVILA ")).toBe("joao avila");
    expect(casaBusca("avila joao", ["João Ávila"])).toBe(true);
    expect(casaBusca("ext 03", ["Extrusora 03", "TAG-1"])).toBe(true);
    expect(casaBusca("ext 04", ["Extrusora 03"])).toBe(false);
    expect(casaBusca("   ", ["qualquer"])).toBe(true);
  });
});

const pessoas: Pessoa[] = [
  { id: "1", nome: "Zeca", papel: "mantenedor", ativo: true },
  { id: "2", nome: "Ana", papel: "mantenedor", ativo: false },
  { id: "3", nome: "Ângela", papel: "lider", ativo: true },
  { id: "4", nome: "Bruno", papel: "engenharia", ativo: true },
];

describe("filtrarPessoas", () => {
  it("filtra por perfil, situação e nome, com ativos primeiro", () => {
    expect(filtrarPessoas(pessoas, { busca: "", papel: null, situacao: "todos" }).map((p) => p.nome)).toEqual([
      "Ângela", "Bruno", "Zeca", "Ana",
    ]);
    expect(filtrarPessoas(pessoas, { busca: "", papel: "mantenedor", situacao: "ativos" }).map((p) => p.id)).toEqual(["1"]);
    expect(filtrarPessoas(pessoas, { busca: "", papel: null, situacao: "desativados" }).map((p) => p.id)).toEqual(["2"]);
    expect(filtrarPessoas(pessoas, { busca: "angela", papel: null, situacao: "todos" }).map((p) => p.id)).toEqual(["3"]);
  });

  it("conta por perfil respeitando busca e situação", () => {
    expect(contarPorPapel(pessoas, { busca: "", papel: "lider", situacao: "ativos" })).toEqual({
      mantenedor: 1, lider: 1, engenharia: 1,
    });
  });

  it("gera iniciais", () => {
    expect(iniciais("maria da silva")).toBe("MD");
  });
});

const maq = (id: string, nome: string, linha: string, ativo = true): Maquina => ({
  id, nome, tag: `TAG-${id}`, linha, impacto: "gargalo", impactoValor: 1, ativo,
});
const maquinas = [maq("E10", "Extrusora 10", "L1"), maq("E2", "Extrusora 2", "L1"), maq("F1", "Forno 1", "L2"), maq("X", "Velha", "L3", false)];

describe("filtrarMaquinas", () => {
  it("busca por nome, TAG ou linha, só ativas, em ordem natural", () => {
    const todas = filtrarMaquinas(maquinas, { busca: "", linha: null, soSelecionadas: false }, new Set());
    expect(todas.map((m) => m.id)).toEqual(["E2", "E10", "F1"]);
    expect(filtrarMaquinas(maquinas, { busca: "tag-f1", linha: null, soSelecionadas: false }, new Set()).map((m) => m.id)).toEqual(["F1"]);
    expect(filtrarMaquinas(maquinas, { busca: "", linha: "L1", soSelecionadas: false }, new Set())).toHaveLength(2);
    expect(filtrarMaquinas(maquinas, { busca: "", linha: null, soSelecionadas: true }, new Set(["F1"])).map((m) => m.id)).toEqual(["F1"]);
  });

  it("lista linhas das máquinas ativas e acha por TAG exata", () => {
    expect(linhasDasMaquinas(maquinas)).toEqual(["L1", "L2"]);
    expect(maquinaExata(maquinas, " tag-e2 ")?.id).toBe("E2");
    expect(maquinaExata(maquinas, "TAG-X")).toBeUndefined();
    expect(maquinaExata(maquinas, "")).toBeUndefined();
  });
});
