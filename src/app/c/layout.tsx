import { TopoOperador } from "@/components/operador/TopoOperador";

export default function Layout({ children }: LayoutProps<"/c">) {
  return (
    <>
      <TopoOperador />
      {children}
    </>
  );
}
