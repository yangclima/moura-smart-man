"use client";

import { useState } from "react";
import { Cabecalho } from "@/components/Cabecalho";
import { AbaHistorico } from "@/components/indicadores/AbaHistorico";
import { AbaOperacao, type Periodo } from "@/components/indicadores/AbaOperacao";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTempoReal } from "@/hooks/useTempoReal";
import { useConfig } from "@/hooks/useConfig";
import { resumoTempos } from "@/lib/indicadores";
import { carregarEncerrados } from "@/lib/chamados";
import type { Chamado } from "@/lib/tipos";

function inicioDoPeriodo(p: Periodo): number {
  if (p === "hoje") {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime() - (Number(p) - 1) * 86_400_000;
}

const VAZIO: Chamado[] = [];

type Aba = "operacao" | "historico";

/** Abas ficam montadas depois de abertas: trocar de aba não recarrega nada. */
const CONTEUDO_ABA = "data-[state=inactive]:hidden";

export default function Indicadores() {
  const [aba, setAba] = useState<Aba>("operacao");
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const [periodo, setPeriodo] = useState<Periodo>("7");
  const config = useConfig();
  const desde = inicioDoPeriodo(periodo);
  // Os chamados ficam aqui, e não na aba, porque o bloco "Antes × depois" do histórico também os usa.
  const { dados: encerrados, carregando, erro } = useTempoReal(
    `indicadores/${desde}`,
    () => carregarEncerrados(desde),
    [{ tabela: "chamados" }],
    VAZIO,
  );
  const tempos = resumoTempos(encerrados);

  function trocarAba(v: string) {
    setAba(v as Aba);
    if (v === "historico") setHistoricoAberto(true);
  }

  return (
    <>
      <Cabecalho titulo="Indicadores" links={[{ href: "/oficina", rotulo: "TV" }]} />
      <main id="conteudo" className="mx-auto grid w-full max-w-6xl gap-6 p-4">
        <h1 className="text-3xl font-bold text-moura-azul">Indicadores</h1>
        <Tabs value={aba} onValueChange={trocarAba} className="gap-6">
          <TabsList>
            <TabsTrigger value="operacao" className="px-3">
              Operação
            </TabsTrigger>
            <TabsTrigger value="historico" className="px-3">
              Histórico MES × SAP
            </TabsTrigger>
          </TabsList>
          <TabsContent value="operacao" forceMount className={CONTEUDO_ABA}>
            <AbaOperacao
              periodo={periodo}
              desde={desde}
              onPeriodo={setPeriodo}
              encerrados={encerrados}
              tempos={tempos}
              config={config}
              carregando={carregando}
              erro={erro}
            />
          </TabsContent>
          {historicoAberto && (
            <TabsContent value="historico" forceMount className={CONTEUDO_ABA}>
              <AbaHistorico
                operacao={{ reacao: tempos.reacaoMin, encerrados: encerrados.length, periodo, carregando }}
              />
            </TabsContent>
          )}
        </Tabs>
      </main>
    </>
  );
}
