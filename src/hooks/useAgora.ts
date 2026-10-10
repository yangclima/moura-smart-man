"use client";

import { useEffect, useState } from "react";

/** Date.now() atualizado a cada intervalo: mantém cronômetros e envelhecimento vivos. */
export function useAgora(intervaloMs = 1000): number {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), intervaloMs);
    return () => clearInterval(id);
  }, [intervaloMs]);
  return agora;
}
