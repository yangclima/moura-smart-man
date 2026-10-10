"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface DialogPinProps {
  pin: { nome: string; pin: string } | null;
  onFechar: () => void;
}

/** Mostra o PIN recém-gerado uma única vez, com botão de copiar. */
export function DialogPin({ pin, onFechar }: DialogPinProps) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    if (!pin) return;
    try {
      await navigator.clipboard.writeText(pin.pin);
      setCopiado(true);
    } catch {
      toast.error("Não foi possível copiar. Anote o PIN.");
    }
  }

  function fechar() {
    setCopiado(false);
    onFechar();
  }

  return (
    <Dialog open={pin !== null} onOpenChange={(aberto) => !aberto && fechar()}>
      <DialogContent showCloseButton={false} onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>PIN de {pin?.nome}</DialogTitle>
          <DialogDescription>Anote e entregue à pessoa agora: por segurança, ele não será mostrado de novo.</DialogDescription>
        </DialogHeader>
        <p className="rounded-xl bg-muted py-5 text-center font-mono text-5xl font-bold tracking-[0.3em] text-moura-azul tabular-nums">
          {pin?.pin}
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={copiar}>
            {copiado ? <CheckIcon /> : <CopyIcon />} {copiado ? "Copiado" : "Copiar"}
          </Button>
          <Button onClick={fechar}>Já anotei</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
