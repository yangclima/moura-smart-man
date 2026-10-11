import type { Metadata } from "next";
import { TopoOperador } from "@/components/operador/TopoOperador";

export const metadata: Metadata = { title: "Abrir chamado" };

export default function Layout({ children }: LayoutProps<"/c">) {
  return (
    <>
      <TopoOperador />
      {children}
    </>
  );
}
