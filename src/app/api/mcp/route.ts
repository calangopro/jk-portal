import { atender } from "@/lib/conector/mcp";

/**
 * O conector do Claude, modo código (três ferramentas: buscar, consultar e
 * executar). Endereço público: https://www.jkaliancas.com.br/guias/api/mcp.
 * Tudo mora em `lib/conector/`; a tela é /admin/conector.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const POST = (req: Request) => atender(req, "codigo");
export const GET = (req: Request) => atender(req, "codigo");
export const OPTIONS = (req: Request) => atender(req, "codigo");
