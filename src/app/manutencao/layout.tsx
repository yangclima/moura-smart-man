import { Cabecalho } from "@/components/Cabecalho";
import { Protegido } from "@/components/Protegido";

const LINKS = [
  { href: "/manutencao", rotulo: "Fila" },
  { href: "/oficina", rotulo: "TV" },
  { href: "/oficina/indicadores", rotulo: "Indicadores" },
  { href: "/manutencao/equipe", rotulo: "Acessos" },
];

export default function LayoutManutencao({ children }: LayoutProps<"/manutencao">) {
  return (
    <Protegido papeis={["mantenedor", "lider"]}>
      <Cabecalho titulo="Manutenção" links={LINKS} />
      <main className="mx-auto w-full max-w-2xl flex-1 p-4">{children}</main>
    </Protegido>
  );
}
