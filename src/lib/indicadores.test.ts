import { describe, expect, it } from "vitest";
import { gerarCsv, metaPorClasse, porMaquina, resumir } from "./indicadores";
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
