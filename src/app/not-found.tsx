import { MapPinOffIcon, QrCodeIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EstadoTela } from "@/components/EstadoTela";
import { FaixaMoura } from "@/components/marca/Marca";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Página não encontrada" };

export default function NaoEncontrada() {
  return (
    <>
      <FaixaMoura />
      <main id="conteudo" className="grid flex-1 place-items-center">
        <EstadoTela
          icone={MapPinOffIcon}
          titulo="Página não encontrada"
          acoes={
            <>
              <Button asChild className="h-11 px-4">
                <Link href="/login">Ir para o início</Link>
              </Button>
              <Button asChild variant="outline" className="h-11 px-4">
                <Link href="/c">
                  <QrCodeIcon /> Abrir chamado
                </Link>
              </Button>
            </>
          }
        >
          O endereço não existe ou mudou. Se você escaneou uma etiqueta, avise a engenharia.
        </EstadoTela>
      </main>
    </>
  );
}
