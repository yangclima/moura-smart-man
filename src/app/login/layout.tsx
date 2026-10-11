import type { Metadata } from "next";

export const metadata: Metadata = { title: "Entrar" };

export default function LayoutLogin({ children }: LayoutProps<"/login">) {
  return children;
}
