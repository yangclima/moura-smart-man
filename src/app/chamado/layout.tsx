import { TopoOperador } from "@/components/operador/TopoOperador";

export default function Layout({ children }: LayoutProps<"/chamado">) {
  return (
    <>
      <TopoOperador />
      {children}
    </>
  );
}
