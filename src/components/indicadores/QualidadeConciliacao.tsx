import { CLASSES_CONCILIACAO, CONFIANCAS, type ClasseConciliacao, type Confianca } from "@/lib/historico";
import type { FiltroLista, QualidadeConciliacao } from "@/lib/indicadores-historico";
import { BotaoNumero } from "./BotaoNumero";

export const COR_CLASSE: Record<ClasseConciliacao, string> = {
  "MES + SAP": "bg-hist-conciliado",
  "MES sem SAP": "bg-hist-producao",
  "SAP sem MES": "bg-hist-manutencao",
};

/** Texto sobre a faixa: claro no azul escuro, marinho nas cores claras. */
const TEXTO_CLASSE: Record<ClasseConciliacao, string> = {
  "MES + SAP": "text-white",
  "MES sem SAP": "text-moura-marinho",
  "SAP sem MES": "text-moura-marinho",
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

/** Barras 100% por máquina com as três classes e, ao lado, a confiança dos vínculos. */
export function QualidadeConciliacaoBloco({ qualidade, onAbrir }: Props) {
  const maiorConfianca = Math.max(1, ...CONFIANCAS.map((c) => qualidade.confianca[c]));

  return (
    <section className="grid gap-4 rounded-2xl border bg-card p-4 shadow-xs">
      <h2 className="text-lg font-semibold">Qualidade da conciliação</h2>
      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <figure className="grid content-start gap-3">
          <figcaption className="text-sm text-muted-foreground">Classe dos eventos, por máquina (100% = eventos da máquina)</figcaption>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-label="Legenda">
            {CLASSES_CONCILIACAO.map((c) => (
              <li key={c} className="flex items-center gap-1.5">
                <span className={`size-3 rounded-sm ${COR_CLASSE[c]}`} aria-hidden />
                {c}
              </li>
            ))}
          </ul>
          <div className="grid gap-2">
            {qualidade.porMaquina.map((m) => (
              <div key={m.maquina} className="grid grid-cols-[5.5rem_1fr] items-center gap-2">
                <span className="text-sm font-semibold">Máquina {m.maquina}</span>
                <div className="flex h-8 gap-0.5" role="group" aria-label={`Máquina ${m.maquina}, ${m.total} eventos`}>
                  {CLASSES_CONCILIACAO.filter((c) => m.classes[c] > 0).map((c) => {
                    const n = m.classes[c];
                    const p = pct(n, m.total);
                    const rotulo = `Máquina ${m.maquina} · ${c}: ${n} eventos (${Math.round(p)}%)`;
                    return (
                      <button
                        key={c}
                        type="button"
                        title={rotulo}
                        aria-label={`${rotulo}. Ver na lista`}
                        onClick={() => onAbrir({ maquina: m.maquina, classe: c })}
                        style={{ width: `${p}%` }}
                        className={`${COR_CLASSE[c]} flex min-w-2.5 items-center justify-center overflow-hidden first:rounded-l-sm last:rounded-r-sm hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring`}
                      >
                        {p >= 8 && <span className={`truncate px-1 text-xs font-semibold tabular-nums ${TEXTO_CLASSE[c]}`}>{n}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Clique numa faixa para ver os eventos. Faixas estreitas mostram o número ao passar o mouse.</p>
        </figure>

        <figure className="grid content-start gap-3">
          <figcaption className="text-sm text-muted-foreground">
            Confiança dos vínculos ({qualidade.totalVinculos} ordens SAP)
          </figcaption>
          <dl className="grid gap-2">
            {CONFIANCAS.map((c) => {
              const n = qualidade.confianca[c];
              const eventos = qualidade.confiancaEventos[c];
              return (
                <div key={c} className="grid grid-cols-[9.5rem_1fr_auto_5.5rem] items-center gap-2 text-sm">
                  <dt>{ROTULO_CONFIANCA[c]}</dt>
                  <dd className="h-3 rounded-r-sm bg-muted" aria-hidden>
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
