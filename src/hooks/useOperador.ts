"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { gravarNomeOperador, lerNomeOperador } from "@/lib/local";
import { supabase } from "@/lib/supabase";
import { useUsuario } from "./useUsuario";

const assinarNada = () => () => {};

/**
 * Acesso sem atrito para o operador: entra anonimamente se não houver login
 * e lembra o nome/matrícula no aparelho.
 */
export function useOperador() {
  const { usuario, carregando } = useUsuario();
  const [erroLogin, setErroLogin] = useState<string | null>(null);
  const nomeSalvo = useSyncExternalStore(assinarNada, lerNomeOperador, () => "");
  const [nomeEditado, setNomeEditado] = useState<string | null>(null);
  // Conta com perfil (ex.: login de demonstração) já traz o nome.
  const nome = nomeEditado ?? (nomeSalvo || (usuario?.papel ? usuario.nome : ""));

  useEffect(() => {
    if (carregando || usuario) return;
    void supabase.auth.signInAnonymously().then(({ error }) => {
      if (error) setErroLogin(error.message);
    });
  }, [carregando, usuario]);

  async function confirmarNome(novo: string) {
    const limpo = novo.trim();
    gravarNomeOperador(limpo);
    setNomeEditado(limpo);
    if (!usuario?.papel) await supabase.auth.updateUser({ data: { nome: limpo } });
  }

  return {
    usuario,
    pronto: Boolean(usuario),
    erroLogin,
    nome,
    confirmarNome,
  };
}
