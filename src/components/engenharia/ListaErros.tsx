"use client";

import { ArrowDownIcon, ArrowUpIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { atualizarErro, moverErro } from "@/lib/catalogo";
import { mensagemDeErro } from "@/lib/chamados";
import type { ErroCatalogo, Subdivisao } from "@/lib/tipos";
import { DialogErro } from "./DialogErro";

async function tentar(acao: () => Promise<void>) {
  try {
    await acao();
  } catch (e) {
    toast.error(mensagemDeErro(e));
  }
}

/** Catálogo de erros de uma subdivisão. Desativar, nunca excluir. */
export function ListaErros({ subdivisao, erros }: { subdivisao: Subdivisao; erros: ErroCatalogo[] }) {
  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-2">
        <p className="text-sm text-muted-foreground">
          A ordem abaixo é a ordem em que o operador vê a lista. Erros inativos somem para o operador,
          mas continuam no histórico.
        </p>
        <DialogErro
          subdivisao={subdivisao}
          ordem={erros.length}
          gatilho={
            <Button size="sm" className="ml-auto shrink-0">
              <PlusIcon /> Novo erro
            </Button>
          }
        />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Erro</TableHead>
            <TableHead className="text-center">⚠ Risco</TableHead>
            <TableHead className="text-center">◆ Qualidade</TableHead>
            <TableHead className="text-center">Ativo</TableHead>
            <TableHead className="text-right">Ordem</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {erros.map((e, i) => (
            <TableRow key={e.id} className={e.ativo ? "" : "opacity-50"}>
              <TableCell className="whitespace-normal">
                {e.nome}
                {e.origem !== "seed" && (
                  <Badge variant="outline" className="ml-2">
                    {e.origem}
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-center">
                <Switch
                  checked={e.riscoPessoas}
                  onCheckedChange={(v) => tentar(() => atualizarErro(e.id, { riscoPessoas: v }))}
                  aria-label="Risco a pessoas"
                />
              </TableCell>
              <TableCell className="text-center">
                <Switch
                  checked={e.impactoQualidade}
                  onCheckedChange={(v) => tentar(() => atualizarErro(e.id, { impactoQualidade: v }))}
                  aria-label="Impacto na qualidade"
                />
              </TableCell>
              <TableCell className="text-center">
                <Switch
                  checked={e.ativo}
                  onCheckedChange={(v) => tentar(() => atualizarErro(e.id, { ativo: v }))}
                  aria-label="Ativo"
                />
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={i === 0}
                  onClick={() => tentar(() => moverErro(erros, i, -1))}
                  aria-label="Subir"
                >
                  <ArrowUpIcon />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={i === erros.length - 1}
                  onClick={() => tentar(() => moverErro(erros, i, 1))}
                  aria-label="Descer"
                >
                  <ArrowDownIcon />
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {erros.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                Nenhum erro cadastrado nesta subdivisão.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
