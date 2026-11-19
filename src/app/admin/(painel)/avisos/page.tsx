import { requireArea } from "@/lib/auth/session";
import { ehAdmin } from "@/lib/auth/acessos";
import type { Categoria } from "@/lib/avisos/push";
import { AvisosNoAparelho } from "./AvisosNoAparelho";

export const metadata = { title: "Avisos no celular" };

/**
 * Avisos no celular e no computador (cartão 59): ligar o push neste
 * aparelho, escolher o que avisa, mandar um teste e desligar aparelhos
 * esquecidos. Toda pessoa ativa (área `time`).
 *
 * O suporte e a Kommo só aparecem para quem recebe esses avisos: são as
 * mesmas áreas das funções do banco (`suporte_para_avisar` e a régua da
 * Kommo em `push_pendentes`, 0190).
 */
export default async function AvisosPage() {
  const perfil = await requireArea("time");
  const a = perfil.areas;
  const categorias: Categoria[] = ["chat"];
  if (a.includes("lancar_venda") || a.includes("suporte")) categorias.push("suporte");
  if (a.includes("lancar_venda") || a.includes("vendas") || ehAdmin(perfil.role)) categorias.push("kommo");

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header>
        <p className="eyebrow">Time</p>
        <h1 className="font-display mt-2 text-3xl text-ink sm:text-4xl">Avisos no celular</h1>
        <p className="mt-2 text-sm text-muted sm:text-base">
          Ligue em cada aparelho que você usa: o celular e o computador avisam de mensagem do time{categorias.length > 1 ? ", de caso de suporte e de cliente esperando na Kommo" : ""} mesmo com o painel fechado.
        </p>
      </header>
      <section className="glass rounded-[18px] p-4">
        <AvisosNoAparelho categorias={categorias} />
      </section>
      <section className="glass rounded-[18px] p-4 text-sm leading-relaxed text-muted">
        <h2 className="text-sm font-bold text-ink">Como funciona</h2>
        <ul className="mt-2 list-disc space-y-1.5 pl-5">
          <li>O aviso chega quando o painel está fechado, em outra aba ou com o celular bloqueado. Com o painel à vista, a tela mostra e toca o som curto.</li>
          <li>Vale para cada aparelho: ligue no celular e no computador que você usa.</li>
          <li>A tela bloqueada é lida por quem estiver perto, então o aviso mostra só quem escreveu e o começo do texto. Nada de telefone, valor ou nome de cliente.</li>
          <li>Conversa animada vira um aviso só: no máximo quatro por minuto.</li>
        </ul>
      </section>
    </div>
  );
}
