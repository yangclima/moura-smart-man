import { Suspense } from "react";
import { Carregando } from "@/components/Carregando";
import { AcoesChamado } from "./AcoesChamado";

export default function Pagina({ params }: PageProps<"/manutencao/[id]">) {
  return (
    <Suspense fallback={<Carregando />}>
      <AcoesChamado params={params} />
    </Suspense>
  );
}
