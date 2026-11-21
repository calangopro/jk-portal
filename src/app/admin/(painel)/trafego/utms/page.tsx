import { requireArea } from "@/lib/auth/session";
import { TelaDeUtms } from "./Tela";

export const metadata = { title: "Links e UTMs" };

/**
 * O padrão de UTM para copiar, sem caçar em documento: os parâmetros do Meta,
 * o sufixo do Google Ads e um montador para link sem anúncio. Tudo sai de
 * `src/lib/trafego/utms.ts`, que o teste confere contra a regra de origem.
 */
export default async function UtmsPage() {
  await requireArea("trafego");
  return <TelaDeUtms />;
}
