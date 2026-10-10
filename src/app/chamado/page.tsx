"use client";

import Link from "next/link";
import { Carregando } from "@/components/Carregando";
import { MeusChamados } from "@/components/chamado/MeusChamados";
import { Button } from "@/components/ui/button";
import { useOperador } from "@/hooks/useOperador";

export default function Meus() {
  const op = useOperador();
  if (!op.pronto) return <Carregando />;
  return (
    <main className="mx-auto grid w-full max-w-lg content-start gap-4 p-4">
      <h1 className="text-3xl font-bold text-moura-azul">Meus chamados</h1>
      <MeusChamados />
      <Button asChild variant="outline">
        <Link href="/c">Abrir chamado</Link>
      </Button>
    </main>
  );
}
