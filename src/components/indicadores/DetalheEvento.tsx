"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { EventoHistorico } from "@/lib/historico";
import { precisaRevisao } from "@/lib/indicadores-historico";
import { formatarMinutos } from "@/lib/tempo";
import { LinhaDoTempoEvento } from "./LinhaDoTempoEvento";
import { COR_CLASSE, ROTULO_CONFIANCA } from "./QualidadeConciliacao";

const MIN_POR_H = 60;
const horas = (h: number | null) => (h === null ? null : formatarMinutos(h * MIN_POR_H));

function Campo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  const vazio = children === null || children === undefined || children === "";
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-2 text-sm">
      <dt className="text-muted-foreground">{rotulo}</dt>
      <dd className="break-words">{vazio ? "—" : children}</dd>
    </div>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="grid gap-2">
      <h3 className="text-sm font-semibold">{titulo}</h3>
      <dl className="grid gap-1.5">{children}</dl>
    </section>
  );
}

interface DetalheEventoProps {
  evento: EventoHistorico | undefined;
  /** idEvento das quebras reincidentes (histórico completo). */
  reincidentes: Set<string>;
  onFechar: () => void;
}

/** Painel lateral: do indicador até o evento que o originou (Subproduto 4). */
export function DetalheEvento({ evento: e, reincidentes, onFechar }: DetalheEventoProps) {
  const flags = e
    ? [
        precisaRevisao(e) && "revisar",
        reincidentes.has(e.idEvento) && "reincidente",
        e.ambiguo && "ambíguo",
        e.ordemLonga && "ordem longa",
        e.possivelDuplicidadeSap && "possível duplicidade no SAP",
        e.sapAntesDaParada && "SAP começa antes da parada",
      ].filter((f): f is string => Boolean(f))
    : [];

  return (
    <Sheet open={e !== undefined} onOpenChange={(aberto) => !aberto && onFechar()}>
      <SheetContent className="overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-xl">
        {e && (
          <>
            <SheetHeader className="pr-12">
              <SheetTitle className="font-mono text-lg">{e.idEvento}</SheetTitle>
              <SheetDescription className="flex flex-wrap items-center gap-2">
                <span>Máquina {e.maquina}</span>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1.5">
                  <span className={`size-2.5 rounded-sm ${COR_CLASSE[e.classe]}`} aria-hidden />
                  {e.classe}
                </span>
              </SheetDescription>
            </SheetHeader>
            <div className="grid gap-6 px-4 pb-6">
              <LinhaDoTempoEvento evento={e} />

              <Bloco titulo="Conciliação">
                <Campo rotulo="Confiança">{e.confianca ? ROTULO_CONFIANCA[e.confianca] : null}</Campo>
                <Campo rotulo="Score">{e.score === null ? null : e.score.toFixed(2)}</Campo>
                <Campo rotulo="Sinais">
                  {flags.length > 0 && (
                    <span className="flex flex-wrap gap-1">
                      {flags.map((f) => (
                        <Badge key={f} variant="outline">
                          {f}
                        </Badge>
                      ))}
                    </span>
                  )}
                </Campo>
                <Campo rotulo="Divergência de duração">{e.divergenciaDuracao}</Campo>
                <Campo rotulo="Motivo sem par">{e.motivoSemPar}</Campo>
              </Bloco>

              <Bloco titulo="Produção (MES)">
                <Campo rotulo="Parada">{e.idParada}</Campo>
                <Campo rotulo="Equipamento">{e.equipamentoMes}</Campo>
                <Campo rotulo="Componente">{e.componenteMes}</Campo>
                <Campo rotulo="Família">{e.familiaMes}</Campo>
                <Campo rotulo="Registros de origem">{e.idsRegistroMes.join(", ")}</Campo>
                <Campo rotulo="Indisponibilidade">{horas(e.indisponibilidadeH)}</Campo>
                {e.microParada && <Campo rotulo="Micro-parada">sim</Campo>}
              </Bloco>

              <Bloco titulo="Manutenção (SAP)">
                <Campo rotulo="Ordens">{e.ordens.join(", ")}</Campo>
                <Campo rotulo="Tipo">{[e.tipoSap, e.tipoAtividadeSap].filter(Boolean).join(" · ")}</Campo>
                <Campo rotulo="Equipamento">{e.descricaoEquipSap}</Campo>
                <Campo rotulo="Texto">{e.textoSap}</Campo>
                <Campo rotulo="Atuação apontada">{horas(e.atuacaoH)}</Campo>
                <Campo rotulo="Atuação na parada">{horas(e.atuacaoNaParadaH)}</Campo>
              </Bloco>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
