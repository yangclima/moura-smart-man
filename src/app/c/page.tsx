"use client";

import { ChevronRightIcon, FactoryIcon, ScanLineIcon } from "lucide-react";
import Link from "next/link";
import { Carregando } from "@/components/Carregando";
import { useMaquinas } from "@/hooks/useCatalogo";
import { useOperador } from "@/hooks/useOperador";

/** Alternativa ao QR: o operador escolhe a máquina na lista. */
export default function EscolherMaquina() {
  const op = useOperador();
  const { dados, carregando } = useMaquinas(op.pronto);

  if (!op.pronto || carregando) return <Carregando />;
  const maquinas = dados.filter((m) => m.ativo).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  return (
    <main className="mx-auto grid w-full max-w-lg content-start gap-5 p-4 pb-10">
      <section className="relative overflow-hidden rounded-2xl bg-moura-azul p-5 text-white shadow-md">
        <div className="absolute inset-y-0 right-0 w-2 bg-moura-amarelo" aria-hidden />
        <h1 className="text-3xl font-bold">Chamar a manutenção</h1>
        <p className="mt-1 flex items-start gap-2 text-white/80">
          <ScanLineIcon className="mt-0.5 size-5 shrink-0 text-moura-amarelo" />
          Escaneie o QR Code da máquina ou escolha abaixo.
        </p>
      </section>

      <h2 className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">Máquinas · {maquinas.length}</h2>
      <ul className="grid gap-2">
        {maquinas.map((m) => (
          <li key={m.id}>
            <Link
              href={`/c/${m.id}`}
              className="group flex min-h-16 items-center gap-3 rounded-xl border bg-card p-3 shadow-xs transition-all hover:border-moura-azul/40 hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none active:scale-[0.99]"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-moura-azul transition-colors group-hover:bg-moura-azul group-hover:text-white">
                <FactoryIcon className="size-5" />
              </span>
              <span className="grid min-w-0 flex-1">
                <span className="truncate text-lg font-semibold">{m.nome}</span>
                <span className="font-mono text-xs text-muted-foreground">{m.tag}</span>
              </span>
              <ChevronRightIcon className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-moura-azul" />
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
