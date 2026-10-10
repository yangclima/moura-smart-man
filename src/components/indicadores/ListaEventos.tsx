"use client";

import { ChevronLeftIcon, ChevronRightIcon, FlagIcon, XIcon } from "lucide-react";
import { useState, type Ref } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CLASSES_CONCILIACAO, CONFIANCAS, type ClasseConciliacao, type Confianca, type EventoHistorico } from "@/lib/historico";
import { precisaRevisao, ROTULOS_DIVERGENCIA, type FiltroLista } from "@/lib/indicadores-historico";
import { formatarDataHora, formatarMinutos } from "@/lib/tempo";
import { COR_CLASSE, ROTULO_CONFIANCA } from "./QualidadeConciliacao";

const POR_PAGINA = 20;
const MIN_POR_H = 60;
const QUALQUER = "qualquer";

const horas = (h: number | null) => (h === null ? "—" : formatarMinutos(h * MIN_POR_H));

interface ListaEventosProps {
  ref?: Ref<HTMLElement>;
  eventos: EventoHistorico[];
  motivos: string[];
  filtro: FiltroLista;
  onFiltro: (f: FiltroLista) => void;
  onSelecionar: (idEvento: string) => void;
}

interface FiltroSelectProps {
  rotulo: string;
  valor: string | undefined;
  opcoes: { valor: string; rotulo: string }[];
  onChange: (v: string | undefined) => void;
  largura?: string;
}

function FiltroSelect({ rotulo, valor, opcoes, onChange, largura = "w-44" }: FiltroSelectProps) {
  return (
    <Select value={valor ?? QUALQUER} onValueChange={(v) => onChange(v === QUALQUER ? undefined : v)}>
      <SelectTrigger className={largura} aria-label={rotulo}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={QUALQUER}>{rotulo}: todas</SelectItem>
        {opcoes.map((o) => (
          <SelectItem key={o.valor} value={o.valor}>
            {o.rotulo}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function Chip({ children, onRemover }: { children: string; onRemover: () => void }) {
  return (
    <Badge variant="secondary" className="h-7 gap-1 pr-1">
      {children}
      <button type="button" onClick={onRemover} aria-label={`Remover filtro ${children}`} className="rounded-sm p-0.5 hover:bg-muted">
        <XIcon className="size-3" />
      </button>
    </Badge>
  );
}

/** Tabela paginada dos eventos; clicar numa linha abre o detalhe com a linha do tempo. */
export function ListaEventos({ ref, eventos, motivos, filtro, onFiltro, onSelecionar }: ListaEventosProps) {
  const [pagina, setPagina] = useState({ filtro, eventos, n: 0 });
  // Filtro ou dados novos voltam para a primeira página.
  const atual = pagina.filtro === filtro && pagina.eventos === eventos ? pagina.n : 0;
  const totalPaginas = Math.max(1, Math.ceil(eventos.length / POR_PAGINA));
  const visiveis = eventos.slice(atual * POR_PAGINA, (atual + 1) * POR_PAGINA);
  const irPara = (n: number) => setPagina({ filtro, eventos, n });
  const mudar = (parcial: Partial<FiltroLista>) => onFiltro({ ...filtro, ...parcial });
  const temFiltro = Object.values(filtro).some((v) => v !== undefined);

  return (
    <section ref={ref} className="grid scroll-mt-4 gap-3 rounded-2xl border bg-card p-4 shadow-xs">
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 className="text-lg font-semibold">Eventos</h2>
        <span className="text-sm text-muted-foreground">{eventos.length} na lista</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <FiltroSelect
          rotulo="Classe"
          valor={filtro.classe}
          opcoes={CLASSES_CONCILIACAO.map((c) => ({ valor: c, rotulo: c }))}
          onChange={(v) => mudar({ classe: v as ClasseConciliacao | undefined })}
        />
        <FiltroSelect
          rotulo="Confiança"
          valor={filtro.confianca}
          opcoes={CONFIANCAS.map((c) => ({ valor: c, rotulo: ROTULO_CONFIANCA[c] }))}
          onChange={(v) => mudar({ confianca: v as Confianca | undefined })}
        />
        <FiltroSelect
          rotulo="Revisar"
          valor={filtro.revisar === undefined ? undefined : String(filtro.revisar)}
          opcoes={[
            { valor: "true", rotulo: "Só para revisar" },
            { valor: "false", rotulo: "Sem pendência" },
          ]}
          onChange={(v) => mudar({ revisar: v === undefined ? undefined : v === "true" })}
          largura="w-40"
        />
        <FiltroSelect
          rotulo="Motivo"
          valor={filtro.motivo}
          opcoes={[...new Set([...motivos, ...(filtro.motivo ? [filtro.motivo] : [])])].map((m) => ({ valor: m, rotulo: m }))}
          onChange={(v) => mudar({ motivo: v })}
          largura="w-64"
        />
        {filtro.maquina && <Chip onRemover={() => mudar({ maquina: undefined })}>{`Máquina ${filtro.maquina}`}</Chip>}
        {filtro.divergencia && (
          <Chip onRemover={() => mudar({ divergencia: undefined })}>{ROTULOS_DIVERGENCIA[filtro.divergencia]}</Chip>
        )}
        {temFiltro && (
          <Button variant="ghost" size="sm" onClick={() => onFiltro({})}>
            Limpar filtros
          </Button>
        )}
      </div>

      {eventos.length === 0 ? (
        <p className="py-6 text-center text-muted-foreground">Nenhum evento com esses filtros.</p>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Evento</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Classe</TableHead>
                <TableHead>Confiança</TableHead>
                <TableHead className="text-right">Parada (MES)</TableHead>
                <TableHead className="text-right">Atuação (SAP)</TableHead>
                <TableHead>Componente</TableHead>
                <TableHead>
                  <span className="sr-only">Revisar</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visiveis.map((e) => (
                <TableRow key={e.idEvento} className="cursor-pointer" onClick={() => onSelecionar(e.idEvento)}>
                  <TableCell>
                    <button
                      type="button"
                      className="font-mono font-medium text-moura-azul-claro hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onSelecionar(e.idEvento);
                      }}
                    >
                      {e.idEvento}
                    </button>
                  </TableCell>
                  <TableCell className="tabular-nums">{formatarDataHora(e.inicioEvento)}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5">
                      <span className={`size-2.5 rounded-sm ${COR_CLASSE[e.classe]}`} aria-hidden />
                      {e.classe}
                    </span>
                  </TableCell>
                  <TableCell>{e.confianca ? ROTULO_CONFIANCA[e.confianca] : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{horas(e.indisponibilidadeH)}</TableCell>
                  <TableCell className="text-right tabular-nums">{horas(e.atuacaoH)}</TableCell>
                  <TableCell>{e.componenteMes ?? "—"}</TableCell>
                  <TableCell>
                    {precisaRevisao(e) && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
                        <FlagIcon className="size-3.5" aria-hidden /> revisar
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex items-center justify-end gap-2 text-sm">
            <span className="text-muted-foreground tabular-nums">
              Página {atual + 1} de {totalPaginas}
            </span>
            <Button variant="outline" size="icon-sm" onClick={() => irPara(atual - 1)} disabled={atual === 0} aria-label="Página anterior">
              <ChevronLeftIcon />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => irPara(atual + 1)}
              disabled={atual >= totalPaginas - 1}
              aria-label="Próxima página"
            >
              <ChevronRightIcon />
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
