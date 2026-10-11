import { CONFIANCAS, type ClasseConciliacao, type Confianca } from "@/lib/historico";
import type { FiltroLista, QualidadeConciliacao } from "@/lib/indicadores-historico";
import { BotaoNumero } from "./BotaoNumero";
import { GraficoClasses } from "./graficos/GraficoClasses";

export const COR_CLASSE: Record<ClasseConciliacao, string> = {
  "MES + SAP": "bg-hist-conciliado",
  "MES sem SAP": "bg-hist-producao",
  "SAP sem MES": "bg-hist-manutencao",
};

export const ROTULO_CONFIANCA: Record<Confianca, string> = {
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
  "sem correspondencia": "Sem correspondência",
};

const pct = (n: number, total: number) => (total === 0 ? 0 : (100 * n) / total);

interface Props {
  qualidade: QualidadeConciliacao;
  onAbrir: (f: FiltroLista) => void;
}

/** Classes por máquina (gráfico da task 14) e, ao lado, a confiança dos vínculos. */
export function QualidadeConciliacaoBloco({ qualidade, onAbrir }: Props) {
  const maiorConfianca = Math.max(1, ...CONFIANCAS.map((c) => qualidade.confianca[c]));

  return (
    <section className="grid gap-4 rounded-2xl border bg-card p-4 shadow-xs">
      <h2 className="text-lg font-semibold">Qualidade da conciliação</h2>
      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <GraficoClasses porMaquina={qualidade.porMaquina} onAbrir={onAbrir} />

        <figure className="grid content-start gap-3">
          <figcaption className="text-sm text-muted-foreground">
            Confiança dos vínculos ({qualidade.totalVinculos} ordens SAP)
          </figcaption>
          <dl className="grid gap-2">
            {CONFIANCAS.map((c) => {
              const n = qualidade.confianca[c];
              const eventos = qualidade.confiancaEventos[c];
              return (
                <div key={c} className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 gap-y-1 text-sm sm:grid-cols-[9.5rem_1fr_auto_5.5rem] sm:gap-2">
                  <dt>{ROTULO_CONFIANCA[c]}</dt>
                  <dd className="h-3 rounded-r-sm bg-muted max-sm:order-last max-sm:col-span-3" aria-hidden>
                    <div className="h-3 rounded-r-sm bg-hist-conciliado" style={{ width: `${pct(n, maiorConfianca)}%` }} />
                  </dd>
                  <dd className="text-right tabular-nums">
                    {n} <span className="text-xs text-muted-foreground">({Math.round(pct(n, qualidade.totalVinculos))}%)</span>
                  </dd>
                  <dd className="text-right text-xs">
                    {eventos === 0 ? (
                      <span className="text-muted-foreground">0 eventos</span>
                    ) : (
                      <BotaoNumero rotulo={`Ver os ${eventos} eventos com confiança ${ROTULO_CONFIANCA[c].toLowerCase()}`} onClick={() => onAbrir({ confianca: c })}>
                        {eventos} eventos
                      </BotaoNumero>
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
          <p className="text-xs text-muted-foreground">
            Barra e número contam ordens SAP; um evento pode reunir várias ordens. O link abre os eventos com essa confiança.
          </p>
        </figure>
      </div>
    </section>
  );
}
