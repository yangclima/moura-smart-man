import { describe, expect, it } from "vitest";
import { eventoDeLinha, type EventoHistorico } from "./historico";
import {
  chaveMes,
  componentesReincidentes,
  confiabilidadePorMaquina,
  distribuicaoEspera,
  divergencias,
  entraNasMetricas,
  filtrarHistorico,
  filtrarLista,
  gerarCsvHistorico,
  itensAteFracao,
  janelaObservacao,
  mesesDoHistorico,
  motivosSemPar,
  paretoComponentes,
  porMaquinaHistorico,
  porTipoManutencao,
  qualidadeConciliacao,
  quebrasReincidentes,
  reincidenciaPorMaquina,
  serieMensal,
  temposHistorico,
} from "./indicadores-historico";

/** 10/01/2026 08:00 em Recife (UTC−3), independente do fuso de quem roda os testes. */
const T0 = Date.UTC(2026, 0, 10, 11, 0);
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
    contemQuebra: true,
    microParada: false,
    mesInicio: em(0),
    mesFim: em(60),
    indisponibilidadeH: 1,
    idsRegistroMes: ["2"],
    ordens: ["1001700366"],
    descricaoEquipSap: "ROLOS",
    tipoSap: "CORRETIVA",
    tipoAtividadeSap: "CO",
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

  it("lê micro_parada; nulo ou ausente vira false", () => {
    const base = { id_evento: "A-1", maquina: "A", classe: "MES sem SAP" };
    expect(eventoDeLinha({ ...base, micro_parada: true }).microParada).toBe(true);
    expect(eventoDeLinha({ ...base, micro_parada: null }).microParada).toBe(false);
    expect(eventoDeLinha(base).microParada).toBe(false);
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
      atuacaoNaParadaH: 0.5,
      atuacaoForaDeParadaH: 2,
      mesSemSap: 2,
      comParada: 3,
      sapSemMes: 1,
      comOrdem: 2,
      componenteMaisFrequente: "BCL",
    });
  });

  it("separa atuação na parada das ordens sem parada e deixa as ordens longas de fora", () => {
    const [a] = porMaquinaHistorico([
      evento({ atuacaoH: 3, atuacaoNaParadaH: 1, indisponibilidadeH: 2 }),
      sapSemMes({ atuacaoH: 2 }),
      sapSemMes({ atuacaoH: 50, ordemLonga: true }),
      mesSemSap({ indisponibilidadeH: 1.5 }),
    ]);
    expect(a.atuacaoNaParadaH).toBe(1);
    expect(a.atuacaoForaDeParadaH).toBe(2);
    expect(a.paradoH).toBe(3.5);
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
  const fev = Date.UTC(2026, 1, 3, 12, 0);
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

  it("filtro de quebra exclui micro-paradas", () => {
    const lista = [evento({ idEvento: "1" }), evento({ idEvento: "2", microParada: true }), mesSemSap({ idEvento: "3", contemQuebra: false })];
    expect(filtrarLista(lista, { quebra: true }).map((e) => e.idEvento)).toEqual(["1"]);
    expect(filtrarLista(lista, { quebra: false }).map((e) => e.idEvento)).toEqual(["3"]);
  });

  it("filtra por componente e por tipo de manutenção", () => {
    const lista = [
      evento({ idEvento: "1", componenteMes: "FD" }),
      evento({ idEvento: "2", componenteMes: "BCL" }),
      sapSemMes({ idEvento: "3", tipoSap: "PREVENTIVA" }),
      sapSemMes({ idEvento: "4", tipoSap: null }),
      mesSemSap({ idEvento: "5", tipoSap: null, componenteMes: "BCL" }),
    ];
    expect(filtrarLista(lista, { componente: "FD" }).map((e) => e.idEvento)).toEqual(["1"]);
    expect(filtrarLista(lista, { tipoSap: "PREVENTIVA" }).map((e) => e.idEvento)).toEqual(["3"]);
    // "Sem tipo" pega só as ordens sem tipo, não as paradas sem ordem.
    expect(filtrarLista(lista, { tipoSap: "Sem tipo" }).map((e) => e.idEvento)).toEqual(["4"]);
  });

  it("filtro de reincidência exige o conjunto", () => {
    const lista = [evento({ idEvento: "1" }), evento({ idEvento: "2" })];
    expect(() => filtrarLista(lista, { reincidente: true })).toThrow(/conjunto/);
    expect(filtrarLista(lista, { reincidente: true }, new Set(["2"])).map((e) => e.idEvento)).toEqual(["2"]);
  });

  it("chaveMes usa o calendário de Recife", () => {
    // 01/04 01:30 UTC = 31/03 22:30 em Recife.
    expect(chaveMes(Date.UTC(2026, 3, 1, 1, 30))).toBe("2026-03");
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

  it("traz micro_parada e reincidente logo depois de componente_mes", () => {
    const [cab, linha] = gerarCsvHistorico([evento({ microParada: true })], new Set(["A-EV0001"])).split("\n");
    expect(cab).toContain(";componente_mes;micro_parada;reincidente;ids_registro_mes;");
    expect(linha).toContain(";FD;sim;sim;2;");
    expect(gerarCsvHistorico([evento({})])).toContain(";FD;não;não;2;");
  });
});

describe("distribuicaoEspera", () => {
  it("usa só os pares confiáveis e conta os valores fora do eixo de ±120 min", () => {
    const [a] = distribuicaoEspera([
      ...[-200, -10, 0, 10, 20, 30, 40, 50, 60, 300].map((m, i) => evento({ idEvento: `A-${i}`, esperaAteAtuacaoMin: m })),
      evento({ confianca: "baixa", esperaAteAtuacaoMin: 999 }),
      mesSemSap(),
    ]);
    expect(a).toMatchObject({ maquina: "A", n: 10, abaixo: 1, acima: 1, mediana: 25 });
    expect(a.p25).toBeLessThan(a.mediana!);
    expect(a.p90).toBeGreaterThan(a.p75!);
  });
});

describe("serieMensal", () => {
  const dia = (ano: number, mes: number, d: number) => Date.UTC(ano, mes, d, 12);

  it("agrupa por mês quando há 4 meses ou mais e marca as pontas incompletas", () => {
    const s = serieMensal(
      [
        mesSemSap({ mesInicio: dia(2026, 0, 15), indisponibilidadeH: 2 }),
        evento({ mesInicio: dia(2026, 1, 1), indisponibilidadeH: 1 }),
        evento({ mesInicio: dia(2026, 1, 28), indisponibilidadeH: 0.5, maquina: "B" }),
        evento({ mesInicio: dia(2026, 4, 20), indisponibilidadeH: 3 }),
        sapSemMes({ maquina: "C" }),
      ],
      "horas",
    );
    expect(s.granularidade).toBe("mes");
    expect(s.maquinas).toEqual(["A", "B"]);
    expect(s.periodos.map((p) => p.rotulo)).toEqual(["jan/26", "fev/26", "mar/26", "abr/26", "mai/26"]);
    expect(s.periodos.map((p) => p.incompleto)).toEqual([true, false, false, false, true]);
    expect(s.periodos[1].valores).toEqual({ A: 1, B: 0.5 });
    expect(s.periodos[2].valores).toEqual({ A: 0, B: 0 });
  });

  it("agrupa por semana (segunda a domingo) com menos de 4 meses e conta quebras", () => {
    const s = serieMensal(
      [
        evento({ mesInicio: dia(2026, 9, 5), contemQuebra: true }), // segunda
        evento({ mesInicio: dia(2026, 9, 11), contemQuebra: false }), // domingo
        evento({ mesInicio: dia(2026, 9, 12), contemQuebra: true }),
      ],
      "quebras",
    );
    expect(s.granularidade).toBe("semana");
    expect(s.periodos.map((p) => [p.rotulo, p.valores.A, p.n.A])).toEqual([
      ["05/10", 1, 1],
      ["12/10", 1, 1],
    ]);
  });

  it("filtra a lista pelo período e pelas quebras do ponto clicado", () => {
    const s = serieMensal([evento({ mesInicio: dia(2026, 9, 5) }), evento({ idEvento: "x", mesInicio: dia(2026, 9, 12) })], "horas");
    const [p] = s.periodos;
    const lista = filtrarLista([evento({ mesInicio: dia(2026, 9, 5) }), evento({ idEvento: "x", mesInicio: dia(2026, 9, 12) })], {
      periodo: { inicio: p.inicio, fim: p.fim, rotulo: p.rotulo },
      quebra: true,
    });
    expect(lista.map((e) => e.idEvento)).toEqual(["A-EV0001"]);
  });

  it("devolve série vazia sem paradas", () => {
    expect(serieMensal([sapSemMes()], "horas").periodos).toEqual([]);
  });
});

const H = 3_600_000;

describe("janelaObservacao", () => {
  const inicio = Date.UTC(2026, 0, 10, 11, 0);
  const fim = Date.UTC(2026, 2, 20, 15, 0);
  const todos = [
    evento({ mesInicio: inicio, mesFim: inicio + H }),
    mesSemSap({ idEvento: "B-1", maquina: "B", mesInicio: fim - 2 * H, mesFim: fim }),
    sapSemMes({ idEvento: "S-1", sapInicio: Date.UTC(2026, 3, 10) }),
  ];

  it("sem mês: da primeira parada à última retomada do histórico completo", () => {
    expect(janelaObservacao(todos, null)).toEqual({ inicio, fim });
  });

  it("com mês: o mês de calendário em Recife, cortado à janela sem filtro", () => {
    expect(janelaObservacao(todos, "2026-02")).toEqual({ inicio: Date.UTC(2026, 1, 1, 3), fim: Date.UTC(2026, 2, 1, 3) });
    expect(janelaObservacao(todos, "2026-01")).toEqual({ inicio, fim: Date.UTC(2026, 1, 1, 3) });
  });

  it("devolve null sem paradas", () => {
    expect(janelaObservacao([sapSemMes()], null)).toBeNull();
  });
});

describe("confiabilidadePorMaquina", () => {
  const janela = { inicio: T0, fim: T0 + 100 * H };
  const quebra = (id: string, h: number, p: Partial<EventoHistorico> = {}) =>
    evento({ idEvento: id, mesInicio: T0 + h * H, mesFim: T0 + (h + 1) * H, indisponibilidadeH: 1, ...p });
  const ajuste = (h: number, duracaoH: number) =>
    mesSemSap({
      idEvento: `AJ-${h}`,
      familiaMes: "AJUSTE",
      contemQuebra: false,
      mesInicio: T0 + h * H,
      mesFim: T0 + (h + duracaoH) * H,
      indisponibilidadeH: duracaoH,
    });

  it("calcula MTBF, MTTR e disponibilidade com operação contínua", () => {
    const [a] = confiabilidadePorMaquina([quebra("1", 10), quebra("2", 30), quebra("3", 50), ajuste(70, 2)], janela);
    expect(a.quebras).toBe(3);
    expect(a.tempoOperandoH).toBeCloseTo(95);
    expect(a.mtbfH).toBeCloseTo(31.67, 2);
    expect(a.disponibilidade).toBeCloseTo(0.95);
    expect(a.mttrMin).toBe(60);
    expect(a.mttrMedianaMin).toBe(60);
  });

  it("micro-parada não conta como quebra nem no MTTR, mas conta no tempo parado", () => {
    const micro = quebra("3", 50, { microParada: true, mesFim: T0 + 50.5 * H, indisponibilidadeH: 0.5 });
    const [a] = confiabilidadePorMaquina([quebra("1", 10), quebra("2", 30), micro], janela);
    expect(a.quebras).toBe(2);
    expect(a.mttrMin).toBe(60);
    expect(a.tempoOperandoH).toBeCloseTo(97.5);
  });

  it("com uma quebra só, o MTBF não é calculável", () => {
    const [a] = confiabilidadePorMaquina([quebra("1", 10)], janela);
    expect(a.mtbfH).toBeNull();
    expect(a.mttrMin).toBe(60);
  });

  it("parada que cruza a borda entra só com a parte dentro da janela", () => {
    const [a] = confiabilidadePorMaquina([quebra("1", -2, { mesFim: T0 + H, indisponibilidadeH: 3 })], janela);
    expect(a.tempoOperandoH).toBeCloseTo(99);
    // Começou antes da janela: não é quebra desta janela.
    expect(a.quebras).toBe(0);
    expect(a.mttrMin).toBeNull();
  });

  it("SAP sem MES nunca conta como quebra", () => {
    const linhas = confiabilidadePorMaquina([quebra("1", 10), sapSemMes({ contemQuebra: true, mesInicio: T0 + 20 * H })], janela);
    expect(linhas.map((l) => [l.maquina, l.quebras])).toEqual([["A", 1]]);
  });

  it("ordena pelo maior número de quebras", () => {
    const linhas = confiabilidadePorMaquina(
      [quebra("1", 10), quebra("2", 20, { maquina: "B" }), quebra("3", 30, { maquina: "B" })],
      janela,
    );
    expect(linhas.map((l) => l.maquina)).toEqual(["B", "A"]);
  });
});

describe("paretoComponentes", () => {
  it("agrupa por máquina + componente e ordena pelo valor", () => {
    const p = paretoComponentes(
      [
        evento({ idEvento: "1", componenteMes: "FD", indisponibilidadeH: 3 }),
        evento({ idEvento: "2", componenteMes: "FD", indisponibilidadeH: 1 }),
        evento({ idEvento: "3", maquina: "B", componenteMes: "FD", indisponibilidadeH: 2 }),
        mesSemSap({ idEvento: "4", componenteMes: null, indisponibilidadeH: 0.5 }),
        sapSemMes(),
      ],
      "horas",
    );
    expect(p.itens.map((i) => [i.rotulo, i.valor, i.n])).toEqual([
      ["A · FD", 4, 2],
      ["B · FD", 2, 1],
      ["A · Sem componente", 0.5, 1],
    ]);
    expect(p.total).toBe(6.5);
    expect(p.outros).toBeNull();
    expect(p.itens.at(-1)?.acumulado).toBe(1);
    expect(itensAteFracao(p.itens, 0.8)).toBe(2);
  });

  it("junta o que passa do limite em 'outros', e o acumulado usa o total geral", () => {
    const p = paretoComponentes(
      ["X", "Y", "Z", "W"].map((c, i) => evento({ idEvento: c, componenteMes: c, indisponibilidadeH: 4 - i })),
      "horas",
      2,
    );
    expect(p.itens.map((i) => i.rotulo)).toEqual(["X", "Y"]);
    expect(p.itens[1].acumulado).toBeCloseTo(0.7);
    expect(p.outros).toEqual({ valor: 3, n: 2 });
    expect(itensAteFracao(p.itens, 0.8)).toBeNull();
  });

  it("na métrica de quebras, ignora ajustes e micro-paradas", () => {
    const p = paretoComponentes(
      [
        evento({ idEvento: "1" }),
        evento({ idEvento: "2", microParada: true }),
        mesSemSap({ idEvento: "3", contemQuebra: false, componenteMes: "FD" }),
      ],
      "quebras",
    );
    expect(p.itens.map((i) => [i.rotulo, i.valor, i.n])).toEqual([["FD", 1, 1]]);
  });
});

describe("porTipoManutencao", () => {
  it("conta eventos com ordem por tipo e máquina, sem lista fixa de tipos", () => {
    const t = porTipoManutencao([
      evento({ idEvento: "1" }),
      evento({ idEvento: "2", maquina: "B" }),
      sapSemMes({ idEvento: "3", tipoSap: "PREVENTIVA" }),
      sapSemMes({ idEvento: "4", tipoSap: null }),
      mesSemSap({ idEvento: "5" }),
    ]);
    expect(t.maquinas).toEqual(["A", "B"]);
    expect(t.linhas.map((l) => [l.chave, l.total, l.porMaquina])).toEqual([
      ["CORRETIVA", 2, { A: 1, B: 1 }],
      ["PREVENTIVA", 1, { A: 1, B: 0 }],
      ["Sem tipo", 1, { A: 1, B: 0 }],
    ]);
  });
});

describe("reincidência", () => {
  const dia = (d: number, mes = 0) => Date.UTC(2026, mes, d, 12);
  const q = (id: string, t: number, p: Partial<EventoHistorico> = {}) =>
    evento({ idEvento: id, mesInicio: t, mesFim: t + H, inicioEvento: t, ...p });
  const ids = (s: Set<string>) => [...s].sort();

  it("marca a segunda quebra do mesmo componente em até 7 dias", () => {
    expect(ids(quebrasReincidentes([q("1", dia(1)), q("2", dia(4))]))).toEqual(["2"]);
  });

  it("8 dias de distância não é reincidência", () => {
    expect(ids(quebrasReincidentes([q("1", dia(1)), q("2", dia(9))]))).toEqual([]);
  });

  it("exige a mesma máquina e componente não nulo", () => {
    expect(ids(quebrasReincidentes([q("1", dia(1)), q("2", dia(3), { maquina: "B" })]))).toEqual([]);
    const semComponente = [q("1", dia(1), { componenteMes: null }), q("2", dia(3), { componenteMes: null })];
    expect(ids(quebrasReincidentes(semComponente))).toEqual([]);
  });

  it("ajuste sem quebra não serve de referência nem é reincidente", () => {
    const ajuste = mesSemSap({ idEvento: "AJ", contemQuebra: false, mesInicio: dia(5), mesFim: dia(5) + H });
    expect(ids(quebrasReincidentes([q("1", dia(1)), ajuste, q("2", dia(10))]))).toEqual([]);
  });

  it("usa o histórico completo: a quebra de 02/03 continua reincidente com o filtro de março", () => {
    const todos = [q("1", dia(27, 1)), q("2", dia(2, 2))];
    const reincidentes = quebrasReincidentes(todos);
    const marco = filtrarHistorico({ eventos: todos, vinculos: [] }, { maquina: null, mes: "2026-03" }).eventos;
    expect(reincidenciaPorMaquina(marco, reincidentes)).toEqual([{ maquina: "A", quebras: 1, reincidentes: 1, taxa: 1 }]);
  });

  it("taxa é null sem quebras", () => {
    expect(reincidenciaPorMaquina([mesSemSap({ contemQuebra: false })], new Set())).toEqual([
      { maquina: "A", quebras: 0, reincidentes: 0, taxa: null },
    ]);
  });

  it("lista os componentes que mais reincidem", () => {
    const todos = [
      q("1", dia(1)),
      q("2", dia(3)),
      q("3", dia(5)),
      q("4", dia(1), { componenteMes: "BCL" }),
      q("5", dia(20), { componenteMes: "BCL" }),
    ];
    expect(componentesReincidentes(todos, quebrasReincidentes(todos))).toEqual([
      { maquina: "A", componente: "FD", reincidentes: 2, quebras: 3 },
    ]);
  });
});
