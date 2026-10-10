"use client";

import { useEffect, useState } from "react";
import { apagarNomeLegado } from "@/lib/local";
import { supabase } from "@/lib/supabase";
import { useUsuario } from "./useUsuario";

/**
 * Acesso sem atrito para o operador: entra anonimamente se não houver login.
 * O aparelho é compartilhado entre operadores, então o nome não fica salvo:
 * vale só para esta tela e é pedido de novo a cada chamado.
 */
export function useOperador() {
  const { usuario, carregando } = useUsuario();
  const [erroLogin, setErroLogin] = useState<string | null>(null);
  const [nomeDigitado, setNomeDigitado] = useState<string | null>(null);
  // Conta com perfil (ex.: login de demonstração) já traz o nome.
  const nome = nomeDigitado ?? (usuario?.papel ? usuario.nome : "");

  useEffect(apagarNomeLegado, []);

  useEffect(() => {
    if (carregando || usuario) return;
    void supabase.auth.signInAnonymously().then(({ error }) => {
      if (error) setErroLogin(error.message);
    });
  }, [carregando, usuario]);

  function confirmarNome(novo: string) {
    setNomeDigitado(novo.trim());
  }

  return {
    usuario,
    pronto: Boolean(usuario),
    erroLogin,
    nome,
    confirmarNome,
  };
}
