"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAgora } from "@/hooks/useAgora";
import { formatarMinutos } from "@/lib/tempo";
import type { Chamado } from "@/lib/tipos";

export function DialogDuplicado({
  chamado,
  aoAcompanhar,
  aoAbrirNovo,
  aoFechar,
}: {
  chamado: Chamado | null;
  aoAcompanhar: (c: Chamado) => void;
  aoAbrirNovo: () => void;
  aoFechar: () => void;
}) {
  const agora = useAgora(30_000);
  const minutos = chamado ? (agora - chamado.marcos.abertura) / 60_000 : 0;

  return (
    <Dialog open={chamado !== null} onOpenChange={(aberto) => !aberto && aoFechar()}>
      <DialogContent>
        {chamado && (
          <>
            <DialogHeader>
              <DialogTitle>Já existe um chamado aberto</DialogTitle>
              <DialogDescription className="text-base">
                Já existe o chamado <b>{chamado.numero}</b> aberto há {formatarMinutos(minutos)} para{" "}
                <b>{chamado.subdivisaoNome}</b> ({chamado.erroNome}). Deseja acompanhar esse ou abrir um novo?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button variant="outline" className="h-12" onClick={aoAbrirNovo}>
                Abrir um novo
              </Button>
              <Button className="h-12" onClick={() => aoAcompanhar(chamado)}>
                Acompanhar {chamado.numero}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
