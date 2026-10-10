"use client";

import { DownloadIcon } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Carregando } from "@/components/Carregando";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useHistorico } from "@/hooks/useHistorico";
import { baixarCsv, dataLocal } from "@/lib/csv";
import {
  divergencias,
  filtrarHistorico,
  filtrarLista,
  gerarCsvHistorico,
  maquinasDoHistorico,
  mesesDoHistorico,
  motivosSemPar,
  porMaquinaHistorico,
  qualidadeConciliacao,
  temposHistorico,
  type FiltroHistorico,
  type FiltroLista,
} from "@/lib/indicadores-historico";
import { AntesDepois, type ResumoOperacao } from "./AntesDepois";
import { CartaoTempo } from "./CartaoTempo";
import { DetalheEvento } from "./DetalheEvento";
import { GraficoSerieMensal } from "./graficos/GraficoSerieMensal";
import { ListaEventos } from "./ListaEventos";
import { QualidadeConciliacaoBloco } from "./QualidadeConciliacao";
import { TabelaCruzadaBloco } from "./TabelaCruzada";
import { TabelaMaquinasHistorico } from "./TabelaMaquinasHistorico";

const TODAS = "todas";
const TODO_HISTORICO = "tudo";
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "2026-03" → "mar/2026". */
function rotuloMes(chave: string): string {
  const [ano, mes] = chave.split("-");
  return `${MESES[Number(mes) - 1]}/${ano}`;
}

export function AbaHistorico({ operacao }: { operacao: ResumoOperacao }) {
  const { dados, carregando, erro } = useHistorico();
  const [filtro, setFiltro] = useState<FiltroHistorico>({ maquina: null, mes: null });
  const [filtroLista, setFiltroLista] = useState<FiltroLista>({});
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const listaRef = useRef<HTMLElement>(null);

  const maquinas = useMemo(() => maquinasDoHistorico(dados.eventos), [dados]);
  const meses = useMemo(() => mesesDoHistorico(dados.eventos), [dados]);
  const filtrados = useMemo(() => filtrarHistorico(dados, filtro), [dados, filtro]);
  const naLista = useMemo(() => filtrarLista(filtrados.eventos, filtroLista), [filtrados, filtroLista]);
  const evento = selecionado ? dados.eventos.find((e) => e.idEvento === selecionado) : undefined;

  const tempos = temposHistorico(filtrados.eventos);
  const espera = tempos.esperaMin;

  function abrirLista(f: FiltroLista) {
    setFiltroLista(f);
    listaRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function exportar() {
    baixarCsv(gerarCsvHistorico(naLista), `historico-conciliado-${filtro.maquina ?? TODAS}-${dataLocal()}.csv`);
  }

  if (carregando) return <Carregando texto="Carregando o histórico conciliado…" />;
  if (erro) return <p className="text-destructive">{erro}</p>;
  if (dados.eventos.length === 0) {
    return (
      <p className="text-muted-foreground">
        Nenhum evento conciliado no banco. Rode <code>carregar_conciliacao.py</code> para carregar o histórico.
      </p>
    );
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-muted-foreground">
          {filtrados.eventos.length} evento(s) de parada ou ordem
          {filtro.mes ? ` em ${rotuloMes(filtro.mes)}` : " em todo o histórico"}.
        </p>
        <Select
          value={filtro.maquina ?? TODAS}
          onValueChange={(v) => setFiltro((f) => ({ ...f, maquina: v === TODAS ? null : v }))}
        >
          <SelectTrigger className="w-40 sm:ml-auto" aria-label="Máquina">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODAS}>Todas as máquinas</SelectItem>
            {maquinas.map((m) => (
              <SelectItem key={m} value={m}>
                Máquina {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filtro.mes ?? TODO_HISTORICO}
          onValueChange={(v) => setFiltro((f) => ({ ...f, mes: v === TODO_HISTORICO ? null : v }))}
        >
          <SelectTrigger className="w-44" aria-label="Período">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODO_HISTORICO}>Todo o histórico</SelectItem>
            {meses.map((m) => (
              <SelectItem key={m} value={m}>
                {rotuloMes(m)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={exportar} disabled={naLista.length === 0}>
          <DownloadIcon /> Exportar CSV
        </Button>
      </div>

      <AntesDepois eventos={filtrados.eventos} operacao={operacao} onAbrir={abrirLista} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CartaoTempo
          rotulo="Reação (T1−T0)"
          mediana={null}
          p90={null}
          legenda="Não registrado antes do acionamento digital."
        />
        <CartaoTempo
          rotulo="Espera (T2−T0)"
          mediana={espera.mediana}
          p90={espera.p90}
          n={espera.n}
          legenda="Estimativa: horário do SAP apontado à mão."
          aviso={
            espera.mediana !== null && espera.mediana < 0
              ? "Mediana negativa: o SAP costuma ser apontado antes do início da parada."
              : undefined
          }
        />
        <CartaoTempo
          rotulo="Atuação apontada no SAP (T4−T2)"
          mediana={tempos.atuacaoMin.mediana}
          p90={tempos.atuacaoMin.p90}
          n={tempos.atuacaoMin.n}
          legenda="Sem pausas registradas: é o intervalo bruto da ordem dentro da parada."
        />
        <CartaoTempo
          rotulo="Indisponibilidade (T5−T0)"
          mediana={tempos.indisponibilidadeMin.mediana}
          p90={tempos.indisponibilidadeMin.p90}
          n={tempos.indisponibilidadeMin.n}
          legenda="Todas as paradas do MES, com ou sem ordem no SAP."
        />
      </div>
      <p className="-mt-3 text-xs text-muted-foreground">
        Espera e atuação usam só pares MES + SAP de confiança alta ou média. Os de confiança baixa e os ambíguos
        ficam fora e aparecem na lista com o filtro “revisar”.
      </p>

      <QualidadeConciliacaoBloco qualidade={qualidadeConciliacao(filtrados)} onAbrir={abrirLista} />

      <TabelaMaquinasHistorico linhas={porMaquinaHistorico(filtrados.eventos)} onAbrir={abrirLista} />

      <GraficoSerieMensal eventos={filtrados.eventos} onAbrir={abrirLista} />

      <div className="grid gap-6 lg:grid-cols-2">
        <TabelaCruzadaBloco
          titulo="Por que não concilia"
          nota="Hipótese de trabalho, não conclusão."
          tabela={motivosSemPar(filtrados.eventos)}
          onAbrir={(chave, maquina) => abrirLista({ motivo: chave, maquina })}
        />
        <TabelaCruzadaBloco
          titulo="Divergências nos eventos conciliados"
          tabela={divergencias(filtrados.eventos)}
          onAbrir={(chave, maquina) => abrirLista({ divergencia: chave, maquina })}
        />
      </div>

      <ListaEventos
        ref={listaRef}
        eventos={naLista}
        motivos={motivosSemPar(filtrados.eventos).linhas.map((l) => l.chave)}
        filtro={filtroLista}
        onFiltro={setFiltroLista}
        onSelecionar={setSelecionado}
      />

      <DetalheEvento evento={evento} onFechar={() => setSelecionado(null)} />
    </div>
  );
}
