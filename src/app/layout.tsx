import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Geist, Geist_Mono } from "next/font/google";
import { AvisoConfiguracao } from "@/components/AvisoConfiguracao";
import { Toaster } from "@/components/ui/sonner";
import { ProvedorUsuario } from "@/hooks/useUsuario";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

// Títulos e números grandes: condensada e industrial, legível de longe na TV.
const barlow = Barlow_Condensed({
  variable: "--font-titulo",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Acionamento da Manutenção",
  description: "Chamados de manutenção por QR Code, com rastreabilidade e priorização",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f2185",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${geistSans.variable} ${barlow.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <ProvedorUsuario>
          <AvisoConfiguracao />
          {children}
        </ProvedorUsuario>
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
