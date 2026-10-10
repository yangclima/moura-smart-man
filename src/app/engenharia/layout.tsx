import { Cabecalho } from "@/components/Cabecalho";
import { Protegido } from "@/components/Protegido";

const LINKS = [
  { href: "/engenharia", rotulo: "Máquinas" },
  { href: "/engenharia/qrcodes", rotulo: "QR Codes" },
  { href: "/engenharia/revisao", rotulo: "Revisão" },
  { href: "/engenharia/equipe", rotulo: "Acessos" },
  { href: "/oficina", rotulo: "TV" },
  { href: "/oficina/indicadores", rotulo: "Indicadores" },
];

export default function LayoutEngenharia({ children }: LayoutProps<"/engenharia">) {
  return (
    <Protegido papeis={["engenharia"]}>
      <Cabecalho titulo="Engenharia" links={LINKS} />
      <main className="mx-auto w-full max-w-6xl flex-1 p-4">{children}</main>
    </Protegido>
  );
}
