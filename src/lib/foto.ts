import { BUCKET_FOTOS, supabase } from "./supabase";

const LADO_MAX = 1280;
const QUALIDADE = 0.7;
const VALIDADE_URL_S = 3600;

async function carregarImagem(arquivo: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(arquivo);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Redimensiona no navegador (lado máximo 1280 px) e exporta em JPEG 0,7: tipicamente 100–250 KB. */
export async function comprimirFoto(arquivo: File): Promise<Blob> {
  const img = await carregarImagem(arquivo);
  const escala = Math.min(1, LADO_MAX / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.naturalWidth * escala);
  canvas.height = Math.round(img.naturalHeight * escala);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível processar a foto neste aparelho");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", QUALIDADE));
  if (!blob) throw new Error("Falha ao comprimir a foto");
  return blob;
}

/** Envia ao bucket "fotos" e devolve o caminho que vai no chamado. */
export async function enviarFoto(blob: Blob): Promise<string> {
  const path = `chamados/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from(BUCKET_FOTOS).upload(path, blob, { contentType: "image/jpeg" });
  if (error) throw new Error(`Falha ao enviar a foto: ${error.message}`);
  return path;
}

/** URL assinada (bucket privado), válida por 1 hora. */
export async function urlDaFoto(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(BUCKET_FOTOS).createSignedUrl(path, VALIDADE_URL_S);
  return error ? null : data.signedUrl;
}
