import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { TabelaCruzada } from "@/lib/indicadores-historico";
import { BotaoNumero } from "./BotaoNumero";

interface Props<K extends string> {
  titulo: string;
  nota?: string;
  tabela: TabelaCruzada<K>;
  /** `maquina` vazio = total da linha. */
  onAbrir: (chave: K, maquina?: string) => void;
}

/** Contagem linha × máquina; cada número abre a lista de eventos filtrada. */
export function TabelaCruzadaBloco<K extends string>({ titulo, nota, tabela, onAbrir }: Props<K>) {
  return (
    <section className="grid content-start gap-2 rounded-2xl border bg-card p-4 shadow-xs">
      <div>
        <h2 className="text-lg font-semibold">{titulo}</h2>
        {nota && <p className="text-sm text-muted-foreground italic">{nota}</p>}
      </div>
      {tabela.linhas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum evento neste filtro.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead />
              {tabela.maquinas.map((m) => (
                <TableHead key={m} className="text-right">
                  {m}
                </TableHead>
              ))}
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tabela.linhas.map((l) => (
              <TableRow key={l.chave}>
                <TableCell className="max-w-56 whitespace-normal">{l.rotulo}</TableCell>
                {tabela.maquinas.map((m) => (
                  <TableCell key={m} className="text-right">
                    {l.porMaquina[m] === 0 ? (
                      <span className="text-muted-foreground tabular-nums">0</span>
                    ) : (
                      <BotaoNumero rotulo={`Ver na lista: ${l.rotulo}, máquina ${m}`} onClick={() => onAbrir(l.chave, m)}>
                        {l.porMaquina[m]}
                      </BotaoNumero>
                    )}
                  </TableCell>
                ))}
                <TableCell className="text-right font-semibold">
                  {l.total === 0 ? (
                    <span className="tabular-nums">0</span>
                  ) : (
                    <BotaoNumero rotulo={`Ver na lista: ${l.rotulo}`} onClick={() => onAbrir(l.chave)}>
                      {l.total}
                    </BotaoNumero>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}
