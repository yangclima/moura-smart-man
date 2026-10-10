"use client";

import { ImageIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { urlDaFoto } from "@/lib/foto";
import type { Chamado } from "@/lib/tipos";
import { cn } from "@/lib/utils";

/** Miniatura clicável; o clique amplia num diálogo. */
export function FotoChamado({
  chamado,
  className,
  grande = false,
}: {
  chamado: Pick<Chamado, "fotoPath" | "numero">;
  className?: string;
  grande?: boolean;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const path = chamado.fotoPath;

  useEffect(() => {
    if (!path) return;
    let ativo = true;
    urlDaFoto(path)
      .then((u) => ativo && setUrl(u))
      .catch(() => ativo && setUrl(null));
    return () => {
      ativo = false;
    };
  }, [path]);

  if (!path) return null;
  if (!url) {
    return (
      <div className={cn("flex items-center justify-center rounded-md bg-muted", grande ? "h-48" : "size-16", className)}>
        <ImageIcon className="text-muted-foreground" />
      </div>
    );
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" className={cn("overflow-hidden rounded-md", className)} aria-label="Ampliar foto">
          {/* eslint-disable-next-line @next/next/no-img-element -- URL assinada do Storage */}
          <img src={url} alt={`Foto do chamado ${chamado.numero}`} className={cn("object-cover", grande ? "max-h-80 w-full" : "size-16")} />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogTitle>{chamado.numero}</DialogTitle>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={`Foto do chamado ${chamado.numero}`} className="max-h-[75vh] w-full object-contain" />
      </DialogContent>
    </Dialog>
  );
}
