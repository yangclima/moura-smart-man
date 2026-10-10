import { Suspense } from "react";
import { Carregando } from "@/components/Carregando";
import { AcompanharChamado } from "./AcompanharChamado";

export default function Pagina({ params }: PageProps<"/chamado/[id]">) {
  return (
    <Suspense fallback={<Carregando />}>
      <AcompanharChamado params={params} />
    </Suspense>
  );
}
