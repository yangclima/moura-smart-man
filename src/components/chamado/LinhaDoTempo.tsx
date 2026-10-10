import { CheckCircle2Icon, CircleIcon, PauseCircleIcon } from "lucide-react";
import { formatarHora, formatarMinutos, minutosPausados, temposChamado } from "@/lib/tempo";
import type { Chamado, Instante, Marcos } from "@/lib/tipos";

const MARCOS: { campo: keyof Marcos; rotulo: string }[] = [
  { campo: "abertura", rotulo: "T0 · Abertura" },
  { campo: "recebido", rotulo: "T1 · Recebido" },
  { campo: "inicio", rotulo: "T2 · Início do atendimento" },
  { campo: "fimAtuacao", rotulo: "T4 · Fim da atuação" },
  { campo: "liberado", rotulo: "T5 · Liberado pela produção" },
];

const dif = (a?: Instante, b?: Instante) =>
  a !== undefined && b !== undefined ? formatarMinutos((b - a) / 60_000) : null;

export function LinhaDoTempo({
  chamado,
  agora,
}: {
  chamado: Pick<Chamado, "marcos" | "pausas">;
  agora: number;
}) {
  const m = chamado.marcos;
  const t = temposChamado(chamado);
  const pausado = m.inicio !== undefined ? minutosPausados(chamado.pausas, m.inicio, m.fimAtuacao ?? agora) : 0;

  return (
    <div className="grid gap-4 rounded-2xl border bg-card p-4 shadow-xs">
      <h2 className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">Linha do tempo</h2>
      <ol className="grid">
        {MARCOS.map(({ campo, rotulo }, i) => {
          const valor = m[campo];
          const anterior = i > 0 ? m[MARCOS[i - 1].campo] : undefined;
          return (
            <li key={campo} className="relative flex items-start gap-3 pb-4 last:pb-0">
              {i < MARCOS.length - 1 && (
                <span
                  aria-hidden
                  className={`absolute top-6 bottom-0 left-2.5 w-0.5 -translate-x-1/2 ${m[MARCOS[i + 1].campo] !== undefined ? "bg-moura-azul" : "bg-border"}`}
                />
              )}
              {valor !== undefined ? (
                <CheckCircle2Icon className="relative mt-0.5 size-5 shrink-0 rounded-full bg-card text-moura-azul" />
              ) : (
                <CircleIcon className="relative mt-0.5 size-5 shrink-0 rounded-full bg-card text-muted-foreground/50" />
              )}
              <div className="min-w-0 flex-1">
                <div className={valor !== undefined ? "font-medium" : "text-muted-foreground"}>{rotulo}</div>
                {campo === "fimAtuacao" &&
                  chamado.pausas.map((p, j) => (
                    <div key={j} className="flex items-center gap-1 text-sm text-muted-foreground">
                      <PauseCircleIcon className="size-4" /> T3 · Pausa {formatarHora(p.inicio)}–
                      {p.fim ? formatarHora(p.fim) : "agora"} · {p.motivo}
                    </div>
                  ))}
              </div>
              <div className="text-right text-sm tabular-nums">
                <div>{formatarHora(valor)}</div>
                {valor !== undefined && dif(anterior, valor) && (
                  <div className="text-muted-foreground">+{dif(anterior, valor)}</div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <Tempo rotulo="Reação" valor={t.reacaoMin} />
        <Tempo rotulo="Espera" valor={t.esperaMin} />
        <Tempo rotulo="Reparo (sem pausas)" valor={t.reparoMin} extra={pausado ? `${formatarMinutos(pausado)} pausado` : undefined} />
        <Tempo rotulo="Indisponibilidade" valor={t.indisponibilidadeMin} />
      </dl>
    </div>
  );
}

function Tempo({ rotulo, valor, extra }: { rotulo: string; valor: number | null; extra?: string }) {
  return (
    <div className="rounded-lg border-t-2 border-t-moura-amarelo bg-muted/70 p-2.5">
      <dt className="text-xs text-muted-foreground">{rotulo}</dt>
      <dd className="font-heading text-2xl font-semibold text-moura-azul tabular-nums">{formatarMinutos(valor)}</dd>
      {extra && <dd className="text-xs text-muted-foreground">{extra}</dd>}
    </div>
  );
}
