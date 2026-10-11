"use client";

import { RotateCcwIcon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { EstadoTela } from "@/components/EstadoTela";
import { Button } from "@/components/ui/button";

export default function Erro({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main id="conteudo" className="grid flex-1 place-items-center">
      <EstadoTela
        icone={TriangleAlertIcon}
        tom="erro"
        titulo="Não foi possível abrir esta tela"
        acoes={
          <>
            <Button className="h-11 px-4" onClick={() => retry()}>
              <RotateCcwIcon /> Tentar de novo
            </Button>
            <Button asChild variant="outline" className="h-11 px-4">
              <Link href="/login">Ir para o início</Link>
            </Button>
          </>
        }
      >
        Verifique a conexão e tente de novo. Se continuar, avise a engenharia.
      </EstadoTela>
    </main>
  );
}
