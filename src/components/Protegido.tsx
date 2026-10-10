"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useUsuario } from "@/hooks/useUsuario";
import type { Papel } from "@/lib/tipos";
import { Carregando } from "./Carregando";

/** Redireciona para /login quando não há usuário ou o papel não é permitido. */
export function Protegido({ papeis, children }: { papeis: Papel[]; children: ReactNode }) {
  const { usuario, carregando } = useUsuario();
  const router = useRouter();
  const permitido = Boolean(usuario?.papel && papeis.includes(usuario.papel));

  useEffect(() => {
    if (!carregando && !permitido) router.replace("/login");
  }, [carregando, permitido, router]);

  if (!permitido) return <Carregando texto="Verificando acesso…" />;
  return <>{children}</>;
}
