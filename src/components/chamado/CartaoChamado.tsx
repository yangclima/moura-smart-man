import { StarIcon, TriangleAlertIcon } from "lucide-react";
import { estourouMeta, prioridadeAtual } from "@/lib/prioridade";
import { formatarHora, formatarMinutos } from "@/lib/tempo";
import type { Chamado, ConfigPriorizacao } from "@/lib/tipos";
import { cn } from "@/lib/utils";
import { BadgePrioridade, BARRA_CLASSE } from "./BadgePrioridade";
import { Cronometro } from "./Cronometro";
import { FotoChamado } from "./FotoChamado";

export function SeloCondicao({ chamado, className }: { chamado: Pick<Chamado, "condicao">; className?: string }) {
  const parada = chamado.condicao === "parada";
  return (
    <span
      className={cn(
        "rounded px-1.5 py-0.5 text-[0.75em] font-bold tracking-wide",
        parada ? "bg-red-600 text-white" : "bg-amber-200 text-amber-950",
        className,
      )}
    >
      {parada ? "PARADA" : "COM PROBLEMA"}
    </span>
  );
}

function linhaStatus(c: Chamado, agora: number): string | null {
  const ultimaPausa = c.pausas.at(-1);
  if (c.status === "recebido" && c.responsavel && c.marcos.recebido) {
    return `Recebido por ${c.responsavel.nome} há ${formatarMinutos((agora - c.marcos.recebido) / 60_000)}`;
  }
  if (c.status === "em_atendimento" && c.responsavel && c.marcos.inicio) {
    return `${c.responsavel.nome} · ${formatarMinutos((agora - c.marcos.inicio) / 60_000)} em atuação`;
  }
  if (c.status === "pausado" && ultimaPausa) {
    return `Pausado: ${ultimaPausa.motivo}${c.responsavel ? ` · ${c.responsavel.nome}` : ""}`;
  }
  if (c.status === "aguardando_liberacao") return "Aguardando o operador liberar a máquina";
  return null;
}

export function CartaoChamado({
  chamado: c,
  agora,
  config,
  destaque = false,
  variante = "tv",
  rotulo,
}: {
  chamado: Chamado;
  agora: number;
  config: ConfigPriorizacao;
  destaque?: boolean;
  variante?: "tv" | "compacto";
  rotulo?: string;
}) {
  const p = prioridadeAtual(c, agora, config);
  const situacao = estourouMeta(c, agora, config);
  const status = linhaStatus(c, agora);
  const tv = variante === "tv";

  return (
    <article
      className={cn(
        "flex gap-3 rounded-xl border border-l-8 bg-card p-3 text-card-foreground shadow-sm",
        BARRA_CLASSE[p.classe],
        destaque && "chegou",
      )}
    >
      <div className="grid min-w-0 flex-1 gap-1">
        {rotulo && (
          <div className="inline-flex w-fit items-center gap-1 rounded-full bg-moura-amarelo px-2.5 py-0.5 text-[0.7em] font-bold tracking-wider text-moura-azul uppercase">
            <StarIcon className="size-[1.1em] fill-current" aria-hidden /> {rotulo}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <BadgePrioridade classe={p.classe} ajustada={Boolean(c.override)} />
          <span className="font-mono text-muted-foreground">{c.numero}</span>
          <span className="font-semibold">
            {c.maquinaNome} · {c.subdivisaoNome}
          </span>
          {c.riscoPessoas && (
            <span className="inline-flex items-center text-red-600 dark:text-red-400" title="Risco a pessoas">
              <TriangleAlertIcon className="size-[1.1em]" aria-hidden />
              <span className="sr-only">Risco a pessoas</span>
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={tv ? "text-[1.05em]" : ""}>{c.erroNome}</span>
          <SeloCondicao chamado={c} />
        </div>
        {c.descricaoLivre && <p className="truncate text-[0.8em] text-muted-foreground">“{c.descricaoLivre}”</p>}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.85em] text-muted-foreground">
          <span>
            Aberto às {formatarHora(c.marcos.abertura)} por {c.solicitante.nome}
          </span>
          <Cronometro desdeMs={c.marcos.abertura} agora={agora} situacao={situacao} />
        </div>
        {status && <div className="text-[0.85em] font-medium">{status}</div>}
      </div>
      <FotoChamado chamado={c} className="shrink-0 self-start" />
    </article>
  );
}
