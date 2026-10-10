import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { FiltroLista, LinhaMaquinaHistorico } from "@/lib/indicadores-historico";
import { formatarMinutos } from "@/lib/tempo";
import { BotaoNumero } from "./BotaoNumero";

const MIN_POR_H = 60;

function percentual(n: number, total: number): string {
  return total === 0 ? "—" : `${Math.round((100 * n) / total)}%`;
}

interface Props {
  linhas: LinhaMaquinaHistorico[];
  onAbrir: (f: FiltroLista) => void;
}

/** Mesmo layout da tabela "Por máquina" da aba Operação, ordenada pelo maior tempo parado. */
export function TabelaMaquinasHistorico({ linhas, onAbrir }: Props) {
  return (
    <section className="grid gap-2 rounded-2xl border bg-card p-4 shadow-xs">
      <h2 className="text-lg font-semibold">Por máquina</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Máquina</TableHead>
            <TableHead className="text-right">Eventos</TableHead>
            <TableHead className="text-right">Tempo parado</TableHead>
            <TableHead className="text-right">Atuação SAP</TableHead>
            <TableHead className="text-right" title="Paradas sem ordem ÷ eventos com parada no MES">
              % MES sem SAP
            </TableHead>
            <TableHead className="text-right" title="Ordens sem parada ÷ eventos com ordem no SAP">
              % SAP sem MES
            </TableHead>
            <TableHead>Componente mais frequente</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {linhas.map((m) => (
            <TableRow key={m.maquina}>
              <TableCell className="font-semibold">Máquina {m.maquina}</TableCell>
              <TableCell className="text-right">
                <BotaoNumero rotulo={`Ver os ${m.eventos} eventos da máquina ${m.maquina}`} onClick={() => onAbrir({ maquina: m.maquina })}>
                  {m.eventos}
                </BotaoNumero>
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatarMinutos(m.paradoH * MIN_POR_H)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatarMinutos(m.atuacaoH * MIN_POR_H)}</TableCell>
              <TableCell className="text-right">
                <BotaoNumero
                  rotulo={`Ver as ${m.mesSemSap} paradas sem ordem da máquina ${m.maquina}`}
                  onClick={() => onAbrir({ maquina: m.maquina, classe: "MES sem SAP" })}
                >
                  {percentual(m.mesSemSap, m.comParada)}
                </BotaoNumero>
              </TableCell>
              <TableCell className="text-right">
                <BotaoNumero
                  rotulo={`Ver as ${m.sapSemMes} ordens sem parada da máquina ${m.maquina}`}
                  onClick={() => onAbrir({ maquina: m.maquina, classe: "SAP sem MES" })}
                >
                  {percentual(m.sapSemMes, m.comOrdem)}
                </BotaoNumero>
              </TableCell>
              <TableCell>{m.componenteMaisFrequente}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}
