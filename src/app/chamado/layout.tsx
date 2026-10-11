import type { Metadata } from "next";
import { TopoOperador } from "@/components/operador/TopoOperador";

export const metadata: Metadata = { title: "Chamados" };

export default function Layout({ children }: LayoutProps<"/chamado">) {
  return (
    <>
      <TopoOperador />
      {children}
    </>
  );
}
