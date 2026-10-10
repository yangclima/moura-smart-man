"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useConfig } from "@/hooks/useConfig";
import { useUsuario } from "@/hooks/useUsuario";
import { mensagemDeErro } from "@/lib/chamados";
import { criarCenarioDemo, limparDemo } from "@/lib/demo";
import type { ErroCatalogo, Maquina, Subdivisao } from "@/lib/tipos";

export function CenarioDemo(cat: { maquinas: Maquina[]; subdivisoes: Subdivisao[]; erros: ErroCatalogo[] }) {
  const { usuario } = useUsuario();
  const config = useConfig();
  const [ocupado, setOcupado] = useState<"criar" | "limpar" | null>(null);

  async function criar() {
    if (!usuario) return;
    setOcupado("criar");
    try {
      await criarCenarioDemo(cat, usuario, config);
      toast.success("Cenário criado: veja a TV da oficina");
    } catch (e) {
      toast.error(mensagemDeErro(e));
    } finally {
      setOcupado(null);
    }
  }

  async function limpar() {
    setOcupado("limpar");
    try {
      const n = await limparDemo();
      toast.success(`${n} chamado(s) de demonstração removido(s)`);
    } catch (e) {
      toast.error(mensagemDeErro(e));
    } finally {
      setOcupado(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cenário de demonstração</CardTitle>
        <CardDescription>
          Cria três chamados disputando a manutenção: Máquina D parada há 5 min, Máquina A com problema
          de qualidade e reincidência há 2 min, e Máquina B com problema há 25 min.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button onClick={criar} disabled={ocupado !== null}>
          {ocupado === "criar" ? "Criando…" : "Carregar cenário"}
        </Button>
        <Button variant="outline" onClick={limpar} disabled={ocupado !== null}>
          {ocupado === "limpar" ? "Limpando…" : "Limpar demonstração"}
        </Button>
      </CardContent>
    </Card>
  );
}
