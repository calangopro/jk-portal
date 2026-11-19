import { requireArea } from "@/lib/auth/session";
import { enderecosQuebrados, listarRedirects } from "./actions";
import { TelaDeRedirects } from "./Tela";

export const metadata = { title: "Redirects" };

/**
 * Redirects e endereços quebrados.
 *
 * A tabela `redirects` existe desde a primeira migration e o middleware a serve
 * em toda requisição pública, só que nunca houve tela para cadastrar. O mapa de
 * redirect que o card P0 do Trello exige antes de qualquer mexida em URL não
 * podia ser feito pelo painel.
 *
 * A fila de cima é o outro lado da mesma moeda: sem saber QUAIS endereços as
 * pessoas pedem e não existem, cadastrar redirect seria adivinhação. O Search
 * Console mostra isso com semanas de atraso e só para o que o Google rastreou,
 * então link antigo em impresso e link colado no WhatsApp nunca apareciam.
 */
export default async function RedirectsPage() {
  await requireArea("site");
  const [quebrados, redirects] = await Promise.all([enderecosQuebrados(), listarRedirects()]);

  return <TelaDeRedirects quebrados={quebrados} redirects={redirects} />;
}
