"use client";

import { InboxIcon, WifiOffIcon } from "lucide-react";
import Link from "next/link";
import { Carregando } from "@/components/Carregando";
import { CartaoChamado } from "@/components/chamado/CartaoChamado";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAgora } from "@/hooks/useAgora";
import { useChamadosAbertos } from "@/hooks/useChamadosAbertos";
import { useConfig } from "@/hooks/useConfig";
import { useUsuario } from "@/hooks/useUsuario";
import { ordenarFila } from "@/lib/prioridade";
import type { Chamado, ConfigPriorizacao } from "@/lib/tipos";

export default function FilaManutencao() {
  const { usuario } = useUsuario();
  const agora = useAgora();
  const config = useConfig();
  const { chamados, carregando, offline } = useChamadosAbertos();

  if (carregando) return <Carregando />;

  const fila = ordenarFila(chamados.filter((c) => c.status === "aberto"), agora, config);
  const meus = ordenarFila(
    chamados.filter((c) => c.responsavel?.uid === usuario?.uid),
    agora,
    config,
  );
  const comEquipe = ordenarFila(
    chamados.filter((c) => c.status !== "aberto" && c.responsavel?.uid !== usuario?.uid),
    agora,
    config,
  );

  return (
    <div className="grid gap-4">
      {offline && (
        <p role="status" className="flex items-center justify-center gap-2 rounded-xl bg-red-600 p-2.5 text-center font-medium text-white">
          <WifiOffIcon className="size-4" /> Sem conexão
        </p>
      )}
      <Tabs defaultValue="fila">
        <TabsList className="h-12! w-full rounded-xl bg-card p-1 shadow-xs ring-1 ring-border">
          <Aba valor="fila" rotulo="Fila" qtd={fila.length} />
          <Aba valor="meus" rotulo="Meus" qtd={meus.length} />
          <Aba valor="equipe" rotulo="Equipe" qtd={comEquipe.length} />
        </TabsList>
        <TabsContent value="fila">
          <Lista lista={fila} agora={agora} config={config} vazio="Fila vazia." recomendar />
        </TabsContent>
        <TabsContent value="meus">
          <Lista lista={meus} agora={agora} config={config} vazio="Nenhum chamado com você." />
        </TabsContent>
        <TabsContent value="equipe">
          <Lista lista={comEquipe} agora={agora} config={config} vazio="Ninguém atendendo." />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Lista({
  lista,
  agora,
  config,
  vazio,
  recomendar = false,
}: {
  lista: Chamado[];
  agora: number;
  config: ConfigPriorizacao;
  vazio: string;
  recomendar?: boolean;
}) {
  if (lista.length === 0) {
    return (
      <div className="grid justify-items-center gap-2 rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
        <InboxIcon className="size-8 text-moura-azul/40" />
        <p>{vazio}</p>
      </div>
    );
  }
  return (
    <div className="grid gap-3 pt-2">
      {lista.map((c, i) => (
        <Link key={c.id} href={`/manutencao/${c.id}`} className="rounded-lg transition-transform hover:-translate-y-0.5 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none [&>article]:transition-shadow hover:[&>article]:shadow-md">
          <CartaoChamado
            chamado={c}
            agora={agora}
            config={config}
            variante="compacto"
            rotulo={recomendar && i === 0 ? "Próximo recomendado" : undefined}
          />
        </Link>
      ))}
    </div>
  );
}

function Aba({ valor, rotulo, qtd }: { valor: string; rotulo: string; qtd: number }) {
  return (
    <TabsTrigger
      value={valor}
      className="h-full! rounded-lg text-base data-active:bg-moura-azul! data-active:text-white! data-active:shadow-sm"
    >
      {rotulo}
      <span className="rounded-full bg-current/15 px-2 text-xs font-bold tabular-nums">{qtd}</span>
    </TabsTrigger>
  );
}
