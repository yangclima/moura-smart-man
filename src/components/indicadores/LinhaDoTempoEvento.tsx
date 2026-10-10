import type { EventoHistorico } from "@/lib/historico";
import { formatarDataHora, formatarMinutos } from "@/lib/tempo";
import type { Instante } from "@/lib/tipos";

const MS_POR_MIN = 60_000;

interface Marco {
  rotulo: string;
  descricao: string;
  t: Instante;
  /** Linha da etiqueta no topo: alterna para T0/T2 e T4/T5, que costumam ficar próximos. */
  linha: 0 | 1;
}

function marcos(e: EventoHistorico): Marco[] {
  const todos: (Omit<Marco, "t"> & { t?: Instante })[] = [
    { rotulo: "T0", descricao: "início da parada (MES)", t: e.mesInicio, linha: 0 },
    { rotulo: "T2", descricao: "início no SAP", t: e.sapInicio, linha: 1 },
    { rotulo: "T4", descricao: "fim no SAP", t: e.sapFim, linha: 0 },
    { rotulo: "T5", descricao: "retomada da produção (MES)", t: e.mesFim, linha: 1 },
  ];
  return todos.filter((m): m is Marco => m.t !== undefined);
}

const duracao = (a?: Instante, b?: Instante) =>
  a === undefined || b === undefined ? null : formatarMinutos((b - a) / MS_POR_MIN);

/** Etiquetas nas pontas não saem da barra: alinham pela borda em vez do centro. */
const ancora = (p: number) => (p < 5 ? "0" : p > 95 ? "-100%" : "-50%");

interface FaixaProps {
  rotulo: string;
  de?: Instante;
  ate?: Instante;
  pos: (t: Instante) => number;
  cor: string;
  vazio: string;
}

function Faixa({ rotulo, de, ate, pos, cor, vazio }: FaixaProps) {
  const existe = de !== undefined && ate !== undefined;
  return (
    <div className="grid gap-1">
      <div className="flex justify-between text-xs">
        <span className="font-medium">{rotulo}</span>
        <span className="text-muted-foreground tabular-nums">{existe ? duracao(de, ate) : vazio}</span>
      </div>
      <div className="relative h-5 rounded-sm bg-muted">
        {existe && (
          <div
            className={`absolute inset-y-0 rounded-sm ${cor}`}
            style={{ left: `${pos(de)}%`, width: `max(${pos(ate) - pos(de)}%, 3px)` }}
          />
        )}
      </div>
    </div>
  );
}

/** Barra T0 → T2 → T4 → T5: a parada da produção e a atuação da manutenção na mesma escala. */
export function LinhaDoTempoEvento({ evento: e }: { evento: EventoHistorico }) {
  const lista = marcos(e);
  if (lista.length === 0) return <p className="text-sm text-muted-foreground">Sem horários registrados.</p>;

  const inicio = Math.min(...lista.map((m) => m.t));
  const fim = Math.max(...lista.map((m) => m.t));
  const span = Math.max(fim - inicio, MS_POR_MIN);
  const pos = (t: Instante) => ((t - inicio) / span) * 100;

  return (
    <figure className="grid gap-3">
      <div className="relative">
        <div className="relative mb-1 h-8 text-[11px] font-semibold">
          {lista.map((m) => (
            <span
              key={m.rotulo}
              className="absolute tabular-nums"
              style={{ left: `${pos(m.t)}%`, top: m.linha === 0 ? 0 : "1rem", transform: `translateX(${ancora(pos(m.t))})` }}
            >
              {m.rotulo}
            </span>
          ))}
        </div>
        <div className="grid gap-2">
          <Faixa
            rotulo="Produção parada (T0 → T5)"
            de={e.mesInicio}
            ate={e.mesFim}
            pos={pos}
            cor="bg-hist-producao"
            vazio="sem parada no MES"
          />
          <Faixa
            rotulo="Atuação da manutenção (T2 → T4)"
            de={e.sapInicio}
            ate={e.sapFim}
            pos={pos}
            cor="bg-hist-conciliado"
            vazio="sem ordem no SAP"
          />
        </div>
        <div className="pointer-events-none absolute inset-x-0 top-8 bottom-0" aria-hidden>
          {lista.map((m) => (
            <span key={m.rotulo} className="absolute inset-y-0 border-l border-dashed border-foreground/40" style={{ left: `${pos(m.t)}%` }} />
          ))}
        </div>
      </div>
      <figcaption>
        <dl className="grid grid-cols-[2rem_1fr_auto] gap-x-2 gap-y-1 text-sm">
          {lista.map((m) => (
            <div key={m.rotulo} className="contents">
              <dt className="font-semibold">{m.rotulo}</dt>
              <dd className="text-muted-foreground">{m.descricao}</dd>
              <dd className="tabular-nums">{formatarDataHora(m.t)}</dd>
            </div>
          ))}
        </dl>
        {e.esperaAteAtuacaoMin !== null && (
          <p className="mt-2 text-xs text-muted-foreground">
            Espera até a atuação (T2−T0): {formatarMinutos(e.esperaAteAtuacaoMin)}
            {e.retomadaAposAtuacaoMin !== null && <> · retomada após a atuação (T5−T4): {formatarMinutos(e.retomadaAposAtuacaoMin)}</>}
          </p>
        )}
      </figcaption>
    </figure>
  );
}
