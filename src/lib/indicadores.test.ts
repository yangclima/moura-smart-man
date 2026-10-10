import { describe, expect, it } from "vitest";
import {
  decomposicaoTempo,
  gerarCsv,
  metaPorClasse,
  porMaquina,
  resumir,
  serieDiaria,
  trechosChamado,
  TRECHOS,
} from "./indicadores";
import { CONFIG_PADRAO, type Chamado } from "./tipos";

const T0 = Date.UTC(2026, 9, 14, 14, 0);
const em = (min: number) => T0 + min * 60_000;

function chamado(parcial: Partial<Chamado> & { inicioMin: number; scoreBase: number }): Chamado {
  return {
    id: "x",
    numero: "CH-000001",
    maquinaId: "A",
    maquinaNome: "Máquina A",
    tag: "TAG",
    subdivisaoId: "A-ROLOS",
    subdivisaoNome: "ROLOS",
    erroId: null,
    erroNome: "Rolo travado",
    descricaoLivre: 'disse "parou"; sem aviso',
    condicao: "parada",
    riscoPessoas: false,
    impactoQualidade: false,
    fotoPath: null,
    solicitante: { uid: "m", nome: "Maria" },
    responsavel: { uid: "j", nome: "João" },
    status: "encerrado",
    prioridade: {
      scoreBase: parcial.scoreBase,
      classeBase: "P1",
      criterios: { c1: 1, c2: 1, c3: 0, c4: 0, c5: 0 },
      versaoConfig: 1,
    },
    override: null,
    marcos: { abertura: em(0), recebido: em(1), inicio: em(parcial.inicioMin), fimAtuacao: em(60), liberado: em(70) },
    pausas: [],
    ...parcial,
  };
}

describe("indicadores", () => {
  it("resume mediana e P90 ignorando nulos", () => {
    expect(resumir([10, null, 20, 30])).toEqual({ mediana: 20, p90: 28 });
  });

  it("conta cumprimento de meta pela classe no início do atendimento", () => {
    const linhas = metaPorClasse(
      [chamado({ inicioMin: 10, scoreBase: 75 }), chamado({ inicioMin: 20, scoreBase: 75 })],
      CONFIG_PADRAO,
    );
    expect(linhas).toEqual([{ classe: "P1", total: 2, cumpriu: 1 }]);
  });

  it("agrupa por máquina com tempo parado e erro mais frequente", () => {
    const [linha] = porMaquina([chamado({ inicioMin: 5, scoreBase: 75 }), chamado({ inicioMin: 5, scoreBase: 75 })]);
    expect(linha).toEqual({ maquina: "Máquina A", chamados: 2, paradoMin: 140, erroMaisFrequente: "Rolo travado" });
  });

  it("gera CSV com escape de aspas e separador", () => {
    const csv = gerarCsv([chamado({ inicioMin: 5, scoreBase: 75 })]);
    const [cab, linha] = csv.split("\n");
    expect(cab.startsWith("numero;maquina")).toBe(true);
    expect(linha).toContain('"disse ""parou""; sem aviso"');
  });
});

describe("decomposicaoTempo", () => {
  it("fecha a soma dos trechos em T5−T0, descontando as pausas da atuação", () => {
    const c = chamado({
      inicioMin: 12,
      scoreBase: 75,
      marcos: { abertura: em(0), recebido: em(3), inicio: em(12), fimAtuacao: em(80), liberado: em(95) },
      pausas: [{ inicio: em(30), fim: em(45), motivo: "peça" }],
    });
    const t = trechosChamado(c)!;
    expect(t).toEqual({ reacao: 3, deslocamento: 9, reparo: 53, pausas: 15, liberacao: 15 });
    expect(TRECHOS.reduce((s, k) => s + t[k], 0)).toBe(95);
  });

  it("usa a média por trecho, ignora chamados sem todos os marcos e ordena pela indisponibilidade", () => {
    const a1 = chamado({ inicioMin: 10, scoreBase: 75 });
    const a2 = chamado({ inicioMin: 20, scoreBase: 75 });
    const b = chamado({
      inicioMin: 5,
      scoreBase: 75,
      maquinaNome: "Máquina B",
      marcos: { abertura: em(0), recebido: em(1), inicio: em(5), fimAtuacao: em(30), liberado: em(40) },
    });
    const semT1 = chamado({ inicioMin: 5, scoreBase: 75, marcos: { abertura: em(0), inicio: em(5), fimAtuacao: em(60), liberado: em(70) } });
    const d = decomposicaoTempo([b, a1, a2, semT1], "maquina", CONFIG_PADRAO);
    expect(d).toMatchObject({ n: 3, total: 4 });
    expect(d.grupos.map((g) => g.grupo)).toEqual(["Máquina A", "Máquina B"]);
    const [a] = d.grupos;
    expect(a.n).toBe(2);
    expect(a.media.deslocamento).toBe(14);
    expect(a.indisponibilidadeMedia).toBe(70);
  });

  it("agrupa pela classe vigente no início do atendimento", () => {
    const d = decomposicaoTempo([chamado({ inicioMin: 10, scoreBase: 75 })], "classe", CONFIG_PADRAO);
    expect(d.grupos.map((g) => g.grupo)).toEqual(["P1"]);
  });
});

describe("serieDiaria", () => {
  it("preenche todos os dias, com zero chamados e sem mediana nos dias vazios", () => {
    // T0 = 14/10 11:00 em Recife; o intervalo vai de 13/10 a 15/10.
    const serie = serieDiaria(
      [chamado({ inicioMin: 10, scoreBase: 75 }), chamado({ inicioMin: 30, scoreBase: 75 })],
      Date.UTC(2026, 9, 13, 3),
      Date.UTC(2026, 9, 15, 20),
    );
    expect(serie.map((p) => [p.rotulo, p.encerrados, p.esperaMediana])).toEqual([
      ["13/10", 0, null],
      ["14/10", 2, 20],
      ["15/10", 0, null],
    ]);
  });

  it("agrupa pelo dia em Recife, não em UTC", () => {
    // 01:30 UTC de 15/10 = 22:30 de 14/10 em Recife.
    const tarde = chamado({
      inicioMin: 5,
      scoreBase: 75,
      marcos: { abertura: Date.UTC(2026, 9, 15, 1, 30), inicio: Date.UTC(2026, 9, 15, 1, 35) },
    });
    const serie = serieDiaria([tarde], Date.UTC(2026, 9, 14, 3), Date.UTC(2026, 9, 15, 20));
    expect(serie.find((p) => p.dia === "2026-10-14")?.encerrados).toBe(1);
  });
});
