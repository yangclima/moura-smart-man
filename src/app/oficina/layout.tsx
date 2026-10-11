import type { Metadata } from "next";
import { Protegido } from "@/components/Protegido";

export const metadata: Metadata = { title: "Oficina" };

/** TV da oficina: qualquer perfil de equipe pode abrir; o perfil "oficina" só lê. */
export default function LayoutOficina({ children }: LayoutProps<"/oficina">) {
  return <Protegido papeis={["oficina", "engenharia", "lider", "mantenedor"]}>{children}</Protegido>;
}
