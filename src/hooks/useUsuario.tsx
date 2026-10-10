"use client";

import type { User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import type { Papel, Usuario } from "@/lib/tipos";

interface EstadoUsuario {
  usuario: Usuario | null;
  carregando: boolean;
}

const Contexto = createContext<EstadoUsuario>({ usuario: null, carregando: true });

type Perfil = { uid: string; nome?: string; papel?: Papel };

/** Lê a sessão do Supabase Auth e o perfil em public.perfis. */
export function ProvedorUsuario({ children }: { children: ReactNode }) {
  const [authUser, setAuthUser] = useState<User | null | undefined>(undefined);
  const [perfil, setPerfil] = useState<Perfil | null>(null);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setAuthUser(data.session?.user ?? null));
    const { data } = supabase.auth.onAuthStateChange((_evento, sessao) => setAuthUser(sessao?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  const uid = authUser && !authUser.is_anonymous ? authUser.id : null;
  useEffect(() => {
    if (!uid) return;
    let ativo = true;
    void supabase
      .from("perfis")
      .select("nome, papel")
      .eq("id", uid)
      .maybeSingle()
      .then(({ data }) => ativo && setPerfil({ uid, nome: data?.nome, papel: data?.papel as Papel | undefined }));
    return () => {
      ativo = false;
    };
  }, [uid]);

  let estado: EstadoUsuario;
  if (authUser === undefined) {
    estado = { usuario: null, carregando: true };
  } else if (authUser === null) {
    estado = { usuario: null, carregando: false };
  } else if (authUser.is_anonymous) {
    const nome = (authUser.user_metadata?.nome as string | undefined) ?? "Operador";
    estado = { usuario: { uid: authUser.id, nome, papel: null }, carregando: false };
  } else if (perfil?.uid !== authUser.id) {
    estado = { usuario: null, carregando: true };
  } else {
    estado = {
      usuario: { uid: authUser.id, nome: perfil.nome ?? authUser.email ?? "Usuário", papel: perfil.papel ?? null },
      carregando: false,
    };
  }

  return <Contexto.Provider value={estado}>{children}</Contexto.Provider>;
}

export function useUsuario(): EstadoUsuario {
  return useContext(Contexto);
}
