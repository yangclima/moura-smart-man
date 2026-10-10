import { entrarComPin, ErroLogin } from "@/lib/servidor/credenciais";

function ipDe(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
}

/** POST { pin } → { access_token, refresh_token } */
export async function POST(request: Request) {
  try {
    const corpo = (await request.json().catch(() => ({}))) as { pin?: unknown };
    const sessao = await entrarComPin(corpo.pin, ipDe(request));
    return Response.json(sessao);
  } catch (e) {
    if (e instanceof ErroLogin) return Response.json({ erro: e.message }, { status: e.status });
    console.error("[api/entrar]", e);
    return Response.json({ erro: "Erro no servidor ao entrar" }, { status: 500 });
  }
}
