import { supabaseConfigurado } from "@/lib/supabase";

export function AvisoConfiguracao() {
  if (supabaseConfigurado) return null;
  return (
    <div className="nao-imprimir bg-destructive px-4 py-2 text-center text-sm text-white">
      Supabase não configurado: crie o arquivo <code>.env.local</code> a partir de{" "}
      <code>.env.example</code> e reinicie o servidor.
    </div>
  );
}
