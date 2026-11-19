import { Calendario } from "@/app/admin/(painel)/redes/calendario/Calendario";
import { diasDaGrade, type ItemDoCalendario } from "@/lib/redes/calendario";
import type { HorariosDaRede } from "@/lib/redes/horarios";
import { foto } from "../redes-exemplo";
import type { Demo } from "../tipos";

const item = (chave: string, situacao: ItemDoCalendario["situacao"], quando: string, redes: ItemDoCalendario["redes"], formato: string, legenda: string, n: number): ItemDoCalendario => ({
  chave, situacao, quando: `${quando}-03:00`, redes, formato, legenda, miniatura: situacao === "ideia" ? null : foto(n), href: situacao === "publicado" ? "/admin/redes/conteudos/p1" : "/admin/redes/publicar/f1", sequencia: null,
});

const itens: ItemDoCalendario[] = [
  item("a", "publicado", "2026-11-03T18:00:00", ["instagram"], "post", "Exemplo de post que já saiu", 0),
  item("b", "publicado", "2026-11-06T12:00:00", ["instagram", "facebook"], "carrossel", "Exemplo de carrossel publicado", 1),
  item("c", "publicado", "2026-11-10T19:00:00", ["youtube"], "video_curto", "Exemplo de Shorts publicado", 2),
  item("d", "publicado", "2026-11-13T18:00:00", ["instagram"], "video_curto", "Exemplo de Reels publicado", 3),
  item("e", "erro", "2026-11-17T09:00:00", ["facebook"], "post", "Exemplo de post que deu erro", 4),
  item("f", "publicado", "2026-11-18T18:00:00", ["instagram"], "story", "Exemplo de story", 5),
  item("g", "agendado", "2026-11-19T19:00:00", ["instagram", "facebook"], "post", "Exemplo de post agendado para hoje à noite", 0),
  item("h", "agendado", "2026-11-19T21:00:00", ["instagram"], "story", "Exemplo de story agendado", 1),
  item("i", "agendado", "2026-11-20T09:00:00", ["instagram", "youtube"], "video_curto", "Exemplo de vídeo curto de amanhã", 2),
  item("j", "agendado", "2026-11-24T12:00:00", ["instagram"], "carrossel", "Exemplo de carrossel da semana que vem", 3),
  item("k", "ideia", "2026-11-26T19:00:00", ["instagram"], "post", "Exemplo de ideia para esta data", 4),
  item("l", "agendado", "2026-11-28T18:00:00", ["facebook"], "post", "Exemplo de post de fim de mês", 5),
];

const horarios: HorariosDaRede[] = [
  { rede: "instagram", faixas: [{ inicio: 18, posts: 14, mediana: 1.6 }], melhor: { inicio: 18, posts: 14, mediana: 1.6 }, amostra: 40 },
  { rede: "facebook", faixas: [{ inicio: 12, posts: 8, mediana: 1.3 }], melhor: { inicio: 12, posts: 8, mediana: 1.3 }, amostra: 25 },
];

const demo: Demo = {
  caminho: "/admin/redes/calendario",
  desenho: () => (
    <div data-painel-largo>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow">Social Media</p>
          <h1 className="font-display mt-2 text-3xl text-ink sm:text-4xl">Calendário</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted sm:text-base">O que saiu em cada rede e o que está marcado para sair. Toque num dia para ver o que tem nele e criar um post ou story já com a data.</p>
        </div>
        <span className="painel-toque inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-white">+ Novo post</span>
      </header>
      <Calendario mes="2026-11" anterior="2026-10" seguinte="2026-12" dias={diasDaGrade("2026-11", "2026-11-19")} itens={itens} hojeData="2026-11-19" agora={Date.parse("2026-11-19T15:00:00-03:00")} horarios={horarios} />
    </div>
  ),
};
export default demo;
