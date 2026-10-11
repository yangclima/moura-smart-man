import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { dataRecife } from "@/lib/fuso";
import {
  JANELA_REINCIDENCIA_DIAS,
  type ComponenteReincidente,
  type ConfiabilidadeMaquina,
  type FiltroLista,
  type Janela,
  type ReincidenciaMaquina,
} from "@/lib/indicadores-historico";
import { formatarMinutos } from "@/lib/tempo";
import { BotaoNumero } from "./BotaoNumero";

const dois = (n: number) => String(n).padStart(2, "0");

/** "dd/mm/aaaa" em Recife. */
function data(t: number): string {
  const d = dataRecife(t);
  return `${dois(d.dia)}/${dois(d.mes + 1)}/${d.ano}`;
}

const decimal = (n: number, casas = 1) => n.toFixed(casas).replace(".", ",");

interface Props {
  linhas: ConfiabilidadeMaquina[];
  reincidencia: ReincidenciaMaquina[];
  componentes: ComponenteReincidente[];
  janela: Janela;
  onAbrir: (f: FiltroLista) => void;
}

/** Quebras, MTTR, MTBF, disponibilidade e reincidência por máquina, na mesma janela para todas. */
export function TabelaConfiabilidade({ linhas, reincidencia, componentes, janela, onAbrir }: Props) {
  const reinc = new Map(reincidencia.map((r) => [r.maquina, r]));
  // A janela é [inicio, fim): o último dia mostrado é o do instante anterior ao fim.
  const ultimoDia = Math.max(janela.inicio, janela.fim - 1);

  return (
    <section className="grid gap-2 rounded-2xl border bg-card p-4 shadow-xs">
      <h2 className="text-lg font-semibold">Confiabilidade por máquina</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Máquina</TableHead>
            <TableHead className="text-right">Quebras</TableHead>
            <TableHead className="text-right">MTTR (média)</TableHead>
            <TableHead className="text-right">MTTR (mediana)</TableHead>
            <TableHead className="text-right">MTBF</TableHead>
            <TableHead className="text-right">Disponibilidade</TableHead>
            <TableHead className="text-right">Reincidência</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {linhas.map((m) => {
            const r = reinc.get(m.maquina);
            return (
              <TableRow key={m.maquina}>
                <TableCell className="font-semibold">Máquina {m.maquina}</TableCell>
                <TableCell className="text-right">
                  {m.quebras === 0 ? (
                    <span className="tabular-nums">0</span>
                  ) : (
                    <BotaoNumero
                      rotulo={`Ver as ${m.quebras} quebras da máquina ${m.maquina}`}
                      onClick={() => onAbrir({ maquina: m.maquina, quebra: true })}
                    >
                      {m.quebras}
                    </BotaoNumero>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatarMinutos(m.mttrMin)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatarMinutos(m.mttrMedianaMin)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {m.mtbfH === null ? (
                    <span className="text-muted-foreground" title="Menos de 2 quebras na janela">
                      não calculável
                    </span>
                  ) : (
                    `${decimal(m.mtbfH)} h`
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {m.disponibilidade === null ? "—" : `${decimal(100 * m.disponibilidade)}%`}
                </TableCell>
                <TableCell className="text-right">
                  {!r || r.taxa === null ? (
                    "—"
                  ) : r.reincidentes === 0 ? (
                    <span className="tabular-nums">0 de {r.quebras} (0%)</span>
                  ) : (
                    <BotaoNumero
                      rotulo={`Ver as ${r.reincidentes} quebras reincidentes da máquina ${m.maquina}`}
                      onClick={() => onAbrir({ maquina: m.maquina, reincidente: true })}
                    >
                      {r.reincidentes} de {r.quebras} ({Math.round(100 * r.taxa)}%)
                    </BotaoNumero>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {componentes.length > 0 && (
        <div className="grid gap-1 pt-1">
          <h3 className="text-sm font-semibold">Componentes que mais reincidem</h3>
          <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {componentes.map((c) => (
              <li key={`${c.maquina}-${c.componente}`}>
                <BotaoNumero
                  rotulo={`Ver as quebras reincidentes de ${c.componente} na máquina ${c.maquina}`}
                  onClick={() => onAbrir({ maquina: c.maquina, componente: c.componente, reincidente: true })}
                >
                  {c.maquina} · {c.componente}: {c.reincidentes} de {c.quebras} quebras
                </BotaoNumero>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-0.5 text-xs text-muted-foreground">
        <p>
          Quebra = parada do MES com registro de QUEBRA, sem contar micro-paradas (&lt; 2 min). MTTR vai da parada à
          retomada da produção (T0→T5).
        </p>
        <p>
          MTBF e disponibilidade supõem operação contínua: tempo operando = janela − tempo parado. Janela:{" "}
          {data(janela.inicio)} a {data(ultimoDia)}.
        </p>
        <p>Reincidente = quebra no mesmo componente em até {JANELA_REINCIDENCIA_DIAS} dias depois da anterior.</p>
      </div>
    </section>
  );
}
