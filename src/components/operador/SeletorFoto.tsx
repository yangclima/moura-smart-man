"use client";

import { CameraIcon, XIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { comprimirFoto } from "@/lib/foto";

/** Abre a câmera traseira no celular e comprime a foto no navegador. A foto é opcional. */
export function SeletorFoto({ foto, aoMudar }: { foto: Blob | null; aoMudar: (b: Blob | null) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [processando, setProcessando] = useState(false);
  const preview = useMemo(() => (foto ? URL.createObjectURL(foto) : null), [foto]);

  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  async function escolher(arquivo: File | undefined) {
    if (!arquivo) return;
    setProcessando(true);
    try {
      aoMudar(await comprimirFoto(arquivo));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível usar a foto");
    } finally {
      setProcessando(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="grid gap-2">
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => escolher(e.target.files?.[0])}
      />
      {foto && preview ? (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- blob local */}
          <img src={preview} alt="Foto do problema" className="size-24 rounded-md object-cover" />
          <div className="grid gap-2">
            <Button variant="outline" className="h-12" onClick={() => input.current?.click()}>
              <CameraIcon /> Trocar foto
            </Button>
            <Button variant="ghost" onClick={() => aoMudar(null)}>
              <XIcon /> Remover
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="outline"
          className="h-14 text-base"
          disabled={processando}
          onClick={() => input.current?.click()}
        >
          <CameraIcon /> {processando ? "Processando…" : "Tirar foto (opcional)"}
        </Button>
      )}
    </div>
  );
}
