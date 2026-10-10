"use client";

import { DownloadIcon } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import type { Maquina } from "@/lib/tipos";
import { logoNoQr, NIVEL_QR, urlDaMaquina } from "./EtiquetaQR";

const LADO_QR = 600;
const MARGEM = 80; // borda branca ("zona de silêncio") que os leitores de QR exigem
const ALTURA_TEXTO = 230;
const INSTRUCAO = "Escaneie para chamar a manutenção";

/** Reduz a fonte até o texto caber na largura. */
function ajustarFonte(ctx: CanvasRenderingContext2D, texto: string, peso: string, tamanho: number, largura: number) {
  let t = tamanho;
  do {
    ctx.font = `${peso} ${t}px Arial, Helvetica, sans-serif`;
    t -= 2;
  } while (ctx.measureText(texto).width > largura && t > 12);
}

type SubdivisaoEtiqueta = { id: string; nome: string };

/** Monta o PNG: QR em cima e, embaixo, nome da máquina, TAG (e subdivisão) e instrução. */
export function montarPng(qr: HTMLCanvasElement, maquina: Maquina, subdivisao?: SubdivisaoEtiqueta): string {
  const largura = LADO_QR + 2 * MARGEM;
  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = LADO_QR + 2 * MARGEM + ALTURA_TEXTO;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível gerar a imagem");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(qr, MARGEM, MARGEM, LADO_QR, LADO_QR);

  const util = largura - 2 * MARGEM;
  const base = MARGEM + LADO_QR;
  ctx.fillStyle = "#000000";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ajustarFonte(ctx, maquina.nome, "bold", 72, util);
  ctx.fillText(maquina.nome, largura / 2, base + 20);
  const linha2 = subdivisao ? `${subdivisao.nome} · ${maquina.tag}` : maquina.tag;
  ajustarFonte(ctx, linha2, "normal", 30, util);
  ctx.fillText(linha2, largura / 2, base + 110);
  ajustarFonte(ctx, INSTRUCAO, "bold", 32, util);
  ctx.fillText(INSTRUCAO, largura / 2, base + 160);
  return canvas.toDataURL("image/png");
}

interface BaixarQRProps {
  maquina: Maquina;
  subdivisao?: SubdivisaoEtiqueta;
  rotulo?: string;
}

export function BaixarQR({ maquina, subdivisao, rotulo = "Baixar QR (PNG)" }: BaixarQRProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  function baixar() {
    if (!ref.current) return;
    const a = document.createElement("a");
    a.href = montarPng(ref.current, maquina, subdivisao);
    a.download = `qr-${maquina.id}${subdivisao ? `-${subdivisao.id}` : ""}.png`;
    a.click();
  }

  return (
    <>
      <QRCodeCanvas
        ref={ref}
        value={urlDaMaquina(maquina.id, subdivisao?.id)}
        size={LADO_QR}
        level={NIVEL_QR}
        marginSize={0}
        imageSettings={logoNoQr(LADO_QR)}
        className="hidden"
      />
      <Button variant="outline" size="sm" onClick={baixar}>
        <DownloadIcon /> {rotulo}
      </Button>
    </>
  );
}
