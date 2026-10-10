import { QRCodeSVG } from "qrcode.react";
import { LogoMoura } from "@/components/marca/Marca";
import { APP_URL } from "@/lib/supabase";
import type { Maquina } from "@/lib/tipos";

export const urlDaMaquina = (maquinaId: string, subdivisaoId?: string) =>
  `${APP_URL}/c/${encodeURIComponent(maquinaId)}${subdivisaoId ? `?sub=${encodeURIComponent(subdivisaoId)}` : ""}`;

/** Símbolo da Moura (sem o texto) no centro do QR. Nível "H" de correção compensa os módulos cobertos. */
export const NIVEL_QR = "H";
export function logoNoQr(lado: number) {
  const largura = Math.round(lado * 0.24);
  return { src: "/simbolo-moura.svg", width: largura, height: Math.round((largura * 556) / 742), excavate: true };
}

/** Etiqueta 7 × 9 cm para colar na máquina. */
export function EtiquetaQR({ maquina, subdivisao }: { maquina: Maquina; subdivisao?: { id: string; nome: string } }) {
  return (
    <div className="etiqueta flex flex-col overflow-hidden rounded-md bg-white text-center text-black">
      <div className="faixa-moura h-1.5 shrink-0" aria-hidden />
      <div className="flex flex-1 flex-col items-center justify-center gap-1.5 p-3">
      <LogoMoura className="h-5" />
      <QRCodeSVG value={urlDaMaquina(maquina.id, subdivisao?.id)} size={170} level={NIVEL_QR} marginSize={2} fgColor="#0f2185" imageSettings={logoNoQr(170)} />
      <div className="font-heading text-2xl leading-tight font-bold text-moura-azul">{maquina.nome}</div>
      {subdivisao && <div className="font-semibold">{subdivisao.nome}</div>}
      <div className="font-mono text-[10px]">{maquina.tag}</div>
      <div className="rounded-full bg-moura-amarelo px-2 py-0.5 text-xs font-semibold text-moura-azul">Escaneie para chamar a manutenção</div>
      </div>
    </div>
  );
}
