import type { RoadmapNaTela } from "@/lib/sugestoes/dados";
import { BotaoDeSugerirNaTela, ListaDeSugestoes } from "./Lista";

/** O desenho do roadmap. Sem `mudar`, a pessoa só lê (não é da diretoria). */
export function TelaDeSugestoes({
  roadmap, mudar,
}: {
  roadmap: RoadmapNaTela | null;
  mudar?: (id: number, estado: string, resposta: string) => Promise<{ ok: true } | { ok: false; erro: string }>;
}) {
  const diretoria = Boolean(roadmap?.diretoria && mudar);
  return (
    <div data-painel-largo>
      <header>
        <p className="eyebrow">Time</p>
        <h1 className="font-display mt-2 text-3xl text-ink sm:text-4xl">{diretoria ? "Sugestões de melhoria" : "Suas sugestões"}</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted sm:text-base">
          {diretoria
            ? "O roadmap do painel, escrito pelo time. Mude o estado e responda: quem sugeriu vê a resposta aqui."
            : "O que você pediu para o painel e em que pé está. Quem cuida do painel lê todas e responde aqui."}
        </p>
        <div className="mt-4">
          <BotaoDeSugerirNaTela />
        </div>
      </header>

      {roadmap === null ? (
        <p role="alert" className="mt-5 rounded-[12px] border border-wine/30 bg-wine/5 px-4 py-3 text-sm text-ink">
          Não deu para ler as sugestões agora. Recarregue a página em alguns segundos.
        </p>
      ) : (
        <ListaDeSugestoes itens={roadmap.itens} diretoria={diretoria} mudar={mudar} />
      )}
    </div>
  );
}
