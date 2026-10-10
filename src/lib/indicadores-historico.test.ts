import { describe, expect, it } from "vitest";
import { eventoDeLinha, type EventoHistorico } from "./historico";
import {
  divergencias,
  entraNasMetricas,
  filtrarHistorico,
  filtrarLista,
  gerarCsvHistorico,
  mesesDoHistorico,
  motivosSemPar,
  porMaquinaHistorico,
  qualidadeConciliacao,
  temposHistorico,
} from "./indicadores-historico";

const T0 = new Date(2026, 0, 10, 8, 0).getTime();
const em = (min: number) => T0 + min * 60_000;

function evento(parcial: Partial<EventoHistorico>): EventoHistorico {
  return {
    idEvento: "A-EV0001",
    maquina: "A",
    classe: "MES + SAP",
    confianca: "alta",
    score: 0.91,
    revisar: false,
    ambiguo: false,
    ordemLonga: false,
    possivelDuplicidadeSap: false,
    idParada: "A-ROLOS-0001",
    equipamentoMes: "ROLOS",
    familiaMes: "QUEBRA",
    componenteMes: "FD",
    mesInicio: em(0),
    mesFim: em(60),
    indisponibilidadeH: 1,
    idsRegistroMes: ["2"],
    ordens: ["1001700366"],
    descricaoEquipSap: "ROLOS",
    tipoSap: "M2",
    tipoAtividadeSap: "CORRETIVA",
    textoSap: "troca; rolo",
    sapInicio: em(10),
    sapFim: em(40),
    atuacaoH: 0.5,
    atuacaoNaParadaH: 0.5,
    inicioEvento: em(0),
    esperaAteAtuacaoMin: 10,
    retomadaAposAtuacaoMin: 20,
    difDuracaoH: -0.5,
    divergenciaDuracao: "compatível",
    sapAntesDaParada: false,
    motivoSemPar: "",
    ...parcial,
  };
}

const mesSemSap = (p: Partial<EventoHistorico> = {}) =>
  evento({
    classe: "MES sem SAP",
    confianca: null,
    ordens: [],
    sapInicio: undefined,
    sapFim: undefined,
    atuacaoH: null,
    atuacaoNaParadaH: null,
    esperaAteAtuacaoMin: null,
    divergenciaDuracao: null,
    motivoSemPar: "quebra sem ordem",
    ...p,
  });

const sapSemMes = (p: Partial<EventoHistorico> = {}) =>
  evento({
    classe: "SAP sem MES",
    confianca: "sem correspondencia",
    idParada: null,
    componenteMes: null,
    mesInicio: undefined,
    mesFim: undefined,
    indisponibilidadeH: null,
    esperaAteAtuacaoMin: null,
    atuacaoNaParadaH: null,
    atuacaoH: 2,
    divergenciaDuracao: null,
    motivoSemPar: "nenhuma parada na janela",
    ...p,
  });

describe("eventoDeLinha", () => {
  it("converte a linha do Postgres, com numeric em texto e datas ISO", () => {
    const e = eventoDeLinha({
      id_evento: "B-EV0002",
      maquina: "B",
      classe: "MES + SAP",
      confianca: "media",
      score: "0.75",
      revisar: true,
      mes_inicio: "2026-01-02T11:30:00+00:00",
      indisponibilidade_h: 0.55,
      ordens: ["1", "2"],
      ids_registro_mes: null,
      motivo_sem_par: null,
    });
    expect(e).toMatchObject({ idEvento: "B-EV0002", score: 0.75, revisar: true, ambiguo: false, ordens: ["1", "2"] });
    expect(e.mesInicio).toBe(Date.parse("2026-01-02T11:30:00Z"));
    expect(e.idsRegistroMes).toEqual([]);
    expect(e.motivoSemPar).toBe("");
    expect(e.sapInicio).toBeUndefined();
  });
});

describe("regra das métricas", () => {
  it("usa só MES + SAP de confiança alta ou média e não ambíguos", () => {
    expect(entraNasMetricas(evento({}))).toBe(true);
    expect(entraNasMetricas(evento({ confianca: "media" }))).toBe(true);
    expect(entraNasMetricas(evento({ confianca: "baixa" }))).toBe(false);
    expect(entraNasMetricas(evento({ ambiguo: true }))).toBe(false);
    expect(entraNasMetricas(mesSemSap())).toBe(false);
  });
});

describe("temposHistorico", () => {
  it("calcula espera e atuação só nos confiáveis e indisponibilidade em todas as paradas do MES", () => {
    const t = temposHistorico([
      evento({ esperaAteAtuacaoMin: -11, atuacaoNaParadaH: 1 }),
      evento({ esperaAteAtuacaoMin: 9, atuacaoNaParadaH: 0.5 }),
      evento({ confianca: "baixa", esperaAteAtuacaoMin: 500, indisponibilidadeH: 3 }),
      mesSemSap({ indisponibilidadeH: 2 }),
      sapSemMes(),
    ]);
    expect(t.esperaMin).toEqual({ mediana: -1, p90: 7, n: 2 });
    expect(t.atuacaoMin).toEqual({ mediana: 45, p90: 57, n: 2 });
    expect(t.indisponibilidadeMin.n).toBe(4);
    expect(t.indisponibilidadeMin.mediana).toBe(90);
  });

  it("devolve nulos e n = 0 sem eventos", () => {
    expect(temposHistorico([]).esperaMin).toEqual({ mediana: null, p90: null, n: 0 });
  });
});

describe("porMaquinaHistorico", () => {
  it("soma tempos, calcula as bases dos percentuais e ordena pelo maior tempo parado", () => {
    const linhas = porMaquinaHistorico([
      evento({ maquina: "A", indisponibilidadeH: 1 }),
      mesSemSap({ maquina: "A", indisponibilidadeH: 1, componenteMes: "BCL" }),
      mesSemSap({ maquina: "A", indisponibilidadeH: 1, componenteMes: "BCL" }),
      sapSemMes({ maquina: "A" }),
      evento({ maquina: "B", indisponibilidadeH: 5 }),
    ]);
    expect(linhas.map((l) => l.maquina)).toEqual(["B", "A"]);
    expect(linhas[1]).toEqual({
      maquina: "A",
      eventos: 4,
      paradoH: 3,
      atuacaoH: 2.5,
      mesSemSap: 2,
      comParada: 3,
      sapSemMes: 1,
      comOrdem: 2,
      componenteMaisFrequente: "BCL",
    });
  });
});

describe("qualidadeConciliacao", () => {
  it("conta classes por máquina e a confiança dos vínculos", () => {
    const q = qualidadeConciliacao({
      eventos: [evento({}), mesSemSap(), sapSemMes({ maquina: "B" })],
      vinculos: [
        { nOrdem: "1", maquina: "A", confianca: "alta" },
        { nOrdem: "2", maquina: "B", confianca: "sem correspondencia" },
      ],
    });
    expect(q.porMaquina).toEqual([
      { maquina: "A", total: 2, classes: { "MES + SAP": 1, "MES sem SAP": 1, "SAP sem MES": 0 } },
      { maquina: "B", total: 1, classes: { "MES + SAP": 0, "MES sem SAP": 0, "SAP sem MES": 1 } },
    ]);
    expect(q.confianca).toEqual({ alta: 1, media: 0, baixa: 0, "sem correspondencia": 1 });
    expect(q.confiancaEventos).toEqual({ alta: 1, media: 0, baixa: 0, "sem correspondencia": 1 });
    expect(q.totalVinculos).toBe(2);
  });
});

describe("motivosSemPar e divergencias", () => {
  it("cruza motivos por máquina, do mais frequente ao menos", () => {
    const t = motivosSemPar([mesSemSap(), sapSemMes(), sapSemMes({ maquina: "B" }), evento({})]);
    expect(t.maquinas).toEqual(["A", "B"]);
    expect(t.linhas[0]).toMatchObject({ chave: "nenhuma parada na janela", total: 2, porMaquina: { A: 1, B: 1 } });
    expect(t.linhas).toHaveLength(2);
  });

  it("conta divergências só nos eventos conciliados", () => {
    const t = divergencias([
      evento({ sapAntesDaParada: true, divergenciaDuracao: "SAP maior" }),
      evento({ possivelDuplicidadeSap: true }),
      sapSemMes({ possivelDuplicidadeSap: true }),
    ]);
    const total = Object.fromEntries(t.linhas.map((l) => [l.chave, l.total]));
    expect(total).toEqual({ sap_antes: 1, sap_maior: 1, mes_maior: 0, duplicidade: 1 });
  });
});

describe("filtros", () => {
  const fev = new Date(2026, 1, 3, 9, 0).getTime();
  const dados = {
    eventos: [evento({ ordens: ["1"] }), evento({ idEvento: "B-1", maquina: "B", inicioEvento: fev, ordens: ["2"] })],
    vinculos: [
      // A ordem 2 começou no fim de janeiro, mas pertence ao evento de fevereiro: acompanha o evento.
      { nOrdem: "1", maquina: "A", confianca: "alta" as const, inicio: em(5) },
      { nOrdem: "2", maquina: "B", confianca: "alta" as const, inicio: new Date(2026, 0, 31, 23, 50).getTime() },
    ],
  };

  it("filtra a aba por máquina e por mês", () => {
    expect(mesesDoHistorico(dados.eventos)).toEqual(["2026-01", "2026-02"]);
    const f = filtrarHistorico(dados, { maquina: null, mes: "2026-02" });
    expect(f.eventos.map((e) => e.idEvento)).toEqual(["B-1"]);
    expect(f.vinculos.map((v) => v.nOrdem)).toEqual(["2"]);
    expect(filtrarHistorico(dados, { maquina: "A", mes: null }).eventos).toHaveLength(1);
  });

  it("filtra a lista por revisar, motivo e divergência", () => {
    const lista = [
      evento({ idEvento: "1", confianca: "baixa" }),
      evento({ idEvento: "2", ambiguo: true }),
      evento({ idEvento: "3", divergenciaDuracao: "MES maior" }),
      mesSemSap({ idEvento: "4" }),
    ];
    expect(filtrarLista(lista, { revisar: true }).map((e) => e.idEvento)).toEqual(["1", "2"]);
    expect(filtrarLista(lista, { motivo: "quebra sem ordem" }).map((e) => e.idEvento)).toEqual(["4"]);
    expect(filtrarLista(lista, { divergencia: "mes_maior" }).map((e) => e.idEvento)).toEqual(["3"]);
    expect(filtrarLista(lista, {})).toHaveLength(4);
  });
});

describe("gerarCsvHistorico", () => {
  it("usa ponto e vírgula, decimal com vírgula e escapa textos", () => {
    const [cab, linha] = gerarCsvHistorico([evento({})]).split("\n");
    expect(cab.startsWith("id_evento;maquina;classe")).toBe(true);
    expect(linha).toContain(";1,00;0,50;");
    expect(linha).toContain('"troca; rolo"');
    expect(linha).toContain("2026-01-10 08:00");
    expect(gerarCsvHistorico([evento({ textoSap: "=SOMA(A1)" })])).toContain(";'=SOMA(A1);");
  });
});
