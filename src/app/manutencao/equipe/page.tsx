"use client";

import { GestaoEquipe } from "@/components/equipe/GestaoEquipe";
import { useUsuario } from "@/hooks/useUsuario";

/** Líderes também gerenciam os PINs da equipe. */
export default function EquipeManutencao() {
  const { usuario } = useUsuario();
  if (usuario?.papel !== "lider") return <p className="text-muted-foreground">Só líderes gerenciam acessos.</p>;
  return <GestaoEquipe />;
}
