import { ClipboardListIcon } from "lucide-react";
import Link from "next/link";
import { FaixaMoura, LogoMoura } from "@/components/marca/Marca";

/** Barra do topo das telas do operador (sem login). */
export function TopoOperador() {
  return (
    <header className="nao-imprimir border-b bg-card">
      <FaixaMoura />
      <div className="mx-auto flex w-full max-w-lg items-center gap-3 px-4 py-2.5">
        <Link href="/c" aria-label="Início: escolher máquina" className="rounded-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
          <LogoMoura className="h-6" prioritario />
        </Link>
        <Link
          href="/chamado"
          className="ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-moura-azul transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <ClipboardListIcon className="size-4" /> Meus chamados
        </Link>
      </div>
    </header>
  );
}
