"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PassoNome({
  inicial,
  aoConfirmar,
}: {
  inicial: string;
  aoConfirmar: (nome: string) => void;
}) {
  const [nome, setNome] = useState(inicial);

  function enviar(e: FormEvent) {
    e.preventDefault();
    if (nome.trim()) aoConfirmar(nome);
  }

  return (
    <form onSubmit={enviar} className="grid gap-3">
      <Label htmlFor="nome-operador" className="text-base">
        Seu nome ou identificação
      </Label>
      <Input
        id="nome-operador"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        className="h-12 text-lg"
        // Aparelho compartilhado: o navegador não deve sugerir o nome de outro operador.
        autoComplete="off"
        autoFocus
        required
      />
      <Button type="submit" className="h-12 text-base">
        Continuar
      </Button>
    </form>
  );
}
