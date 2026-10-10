import { Suspense } from "react";
import { Carregando } from "@/components/Carregando";
import { DetalheMaquina } from "./DetalheMaquina";

export default function Pagina({ params }: PageProps<"/engenharia/maquinas/[maqId]">) {
  return (
    <Suspense fallback={<Carregando />}>
      <DetalheMaquina params={params} />
    </Suspense>
  );
}
