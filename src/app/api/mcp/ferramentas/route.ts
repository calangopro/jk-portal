import { atender } from "@/lib/conector/mcp";

/** O mesmo conector, com uma ferramenta por operação (para cliente que prefere assim). */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const POST = (req: Request) => atender(req, "ferramentas");
export const GET = (req: Request) => atender(req, "ferramentas");
export const OPTIONS = (req: Request) => atender(req, "ferramentas");
