/**
 * Arquivo de verificação do IndexNow. O buscador busca este endereço para
 * confirmar que quem enviou o aviso controla o domínio.
 */
export async function GET() {
  const chave = process.env.INDEXNOW_KEY;
  if (!chave) return new Response("Not found", { status: 404 });
  return new Response(chave, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=86400" },
  });
}
