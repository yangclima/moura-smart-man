import { Suspense } from "react";
import { Carregando } from "@/components/Carregando";
import { AbrirChamado } from "./AbrirChamado";

/** Destino do QR Code da máquina. */
export default function Pagina({ params, searchParams }: PageProps<"/c/[maqId]">) {
  return (
    <Suspense fallback={<Carregando />}>
      <AbrirChamado params={params} searchParams={searchParams} />
    </Suspense>
  );
}
