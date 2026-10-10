import Link from "next/link";
import { formatarHora } from "@/lib/tempo";
import { STATUS_ROTULO, type Chamado } from "@/lib/tipos";
import { cn } from "@/lib/utils";

interface Props {
  chamados: Chamado[];
  /** Chamado aberto na tela, destacado na lista. */
  atual?: string;
}

function Item({ c, atual, destaque }: { c: Chamado; atual?: string; destaque?: boolean }) {
  const detalhe = destaque
    ? `${c.responsavel?.nome ?? "Manutenção"} concluiu às ${formatarHora(c.marcos.fimAtuacao)}`
    : `${c.numero} · aberto às ${formatarHora(c.marcos.abertura)}`;
  return (
    <li>
      <Link
        href={`/chamado/${c.id}`}
        className={cn(
          "flex items-center gap-3 rounded-xl border bg-card p-3 text-sm shadow-xs transition-colors hover:border-moura-azul/40",
          destaque && "border-2 border-green-600 hover:border-green-700",
          c.id === atual && "bg-accent",
        )}
      >
        <span className="grid min-w-0 flex-1">
          <span className="truncate font-medium">
            {c.maquinaNome} · {c.subdivisaoNome}
          </span>
          <span className="truncate text-xs text-muted-foreground">{detalhe}</span>
        </span>
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold",
            destaque ? "bg-green-600 text-white" : "bg-accent text-moura-azul",
          )}
        >
          {destaque ? "Confirmar liberação" : STATUS_ROTULO[c.status]}
        </span>
      </Link>
    </li>
  );
}

/**
 * Todos os chamados em aberto, de todas as máquinas, para qualquer operador.
 * Os que esperam a liberação da produção vêm primeiro: qualquer operador pode confirmar.
 */
export function ChamadosEmAberto({ chamados, atual }: Props) {
  const aguardando = chamados
    .filter((c) => c.status === "aguardando_liberacao")
    .sort((a, b) => (a.marcos.fimAtuacao ?? 0) - (b.marcos.fimAtuacao ?? 0));
  const andamento = chamados
    .filter((c) => c.status !== "aguardando_liberacao")
    .sort((a, b) => b.marcos.abertura - a.marcos.abertura);

  if (chamados.length === 0) {
    return <p className="rounded-xl border bg-card p-4 text-center text-sm text-muted-foreground">Nenhum chamado em aberto.</p>;
  }

  return (
    <div className="grid gap-4">
      {aguardando.length > 0 && (
        <section className="grid gap-2">
          <h2 className="text-sm font-semibold text-green-700 uppercase dark:text-green-400">
            Aguardando liberação da produção ({aguardando.length})
          </h2>
          <ul className="grid gap-2">
            {aguardando.map((c) => (
              <Item key={c.id} c={c} atual={atual} destaque />
            ))}
          </ul>
        </section>
      )}
      {andamento.length > 0 && (
        <section className="grid gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase">Em andamento ({andamento.length})</h2>
          <ul className="grid gap-2">
            {andamento.map((c) => (
              <Item key={c.id} c={c} atual={atual} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
