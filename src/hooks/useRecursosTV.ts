"use client";

import { useEffect, useRef, useState } from "react";

/** Bipe curto gerado com Web Audio (dispensa arquivo de som). */
function bipar(ctx: AudioContext) {
  const agora = ctx.currentTime;
  [0, 0.25].forEach((atraso, i) => {
    const osc = ctx.createOscillator();
    const ganho = ctx.createGain();
    osc.frequency.value = i === 0 ? 880 : 1320;
    ganho.gain.setValueAtTime(0.0001, agora + atraso);
    ganho.gain.exponentialRampToValueAtTime(0.4, agora + atraso + 0.02);
    ganho.gain.exponentialRampToValueAtTime(0.0001, agora + atraso + 0.2);
    osc.connect(ganho).connect(ctx.destination);
    osc.start(agora + atraso);
    osc.stop(agora + atraso + 0.22);
  });
}

/**
 * Som (liberado por um toque, exigência dos navegadores), tela cheia e
 * wake lock para a TV não apagar.
 */
export function useRecursosTV() {
  const audio = useRef<AudioContext | null>(null);
  const [somAtivo, setSomAtivo] = useState(false);

  async function ativarSom() {
    audio.current ??= new AudioContext();
    await audio.current.resume();
    bipar(audio.current);
    setSomAtivo(true);
  }

  function alertar() {
    if (audio.current && somAtivo) bipar(audio.current);
  }

  function telaCheia() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen().catch(() => undefined);
  }

  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    const pedir = () => {
      if (document.visibilityState !== "visible" || !("wakeLock" in navigator)) return;
      navigator.wakeLock
        .request("screen")
        .then((l) => {
          lock = l;
        })
        .catch(() => undefined);
    };
    pedir();
    // O wake lock cai quando a aba fica oculta; pede de novo ao voltar.
    document.addEventListener("visibilitychange", pedir);
    return () => {
      document.removeEventListener("visibilitychange", pedir);
      void lock?.release();
    };
  }, []);

  return { somAtivo, ativarSom, alertar, telaCheia };
}
