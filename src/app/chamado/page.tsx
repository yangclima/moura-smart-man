"use client";

import Link from "next/link";
import { Carregando } from "@/components/Carregando";
import { ChamadosEmAberto } from "@/components/chamado/ChamadosEmAberto";
import { MeusChamados } from "@/components/chamado/MeusChamados";
import { Button } from "@/components/ui/button";
import { useChamadosAbertos } from "@/hooks/useChamadosAbertos";
import { useOperador } from "@/hooks/useOperador";

export default function Chamados() {
  const op = useOperador();
  const abertos = useChamadosAbertos(op.pronto);
  if (!op.pronto || abertos.carregando) return <Carregando />;
  return (
    <main className="mx-auto grid w-full max-w-lg content-start gap-4 p-4">
      <h1 className="text-3xl font-bold text-moura-azul">Chamados em aberto</h1>
      {abertos.offline && (
        <p className="rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900">Sem conexão: a lista pode estar desatualizada.</p>
      )}
      <ChamadosEmAberto chamados={abertos.chamados} />
      <Button asChild variant="outline">
        <Link href="/c">Abrir chamado</Link>
      </Button>
      <MeusChamados />
    </main>
  );
}
