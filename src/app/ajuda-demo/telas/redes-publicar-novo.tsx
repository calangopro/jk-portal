import { Compositor } from "@/app/admin/(painel)/redes/publicar/Compositor";
import type { HorariosDaRede } from "@/lib/redes/horarios";
import type { PostNaTela } from "@/lib/redes/posts";
import { foto } from "../redes-exemplo";
import type { Demo } from "../tipos";

const rascunho = async () => {
  "use server";
  return { ok: true as const, id: "novo" };
};
const liberar = async () => {
  "use server";
  return { ok: false as const, erro: "Só uma demonstração." };
};
const subida = async () => {
  "use server";
  return { ok: false as const, erro: "Só uma demonstração." };
};

const horarios: HorariosDaRede[] = [
  { rede: "instagram", faixas: [{ inicio: 18, posts: 14, mediana: 1.6 }], melhor: { inicio: 18, posts: 14, mediana: 1.6 }, amostra: 40 },
];

/** Um rascunho com uma foto e uma legenda, para o print mostrar o compositor com a peça já montada. */
const rascunhoDeExemplo: PostNaTela = {
  id: "rascunho-exemplo", titulo: null, legenda: "Exemplo de legenda para o post de hoje. Quem quer saber mais?", formato: "post",
  midias: [{ tipo: "imagem", url: foto(0), alt: "Imagem de exemplo com um círculo claro", largura: 1080, altura: 1350, mime: "image/jpeg" }],
  opcoes: {}, status: "rascunho", agendadoPara: null, publicadoEm: null, origem: "painel", criadoPor: null, liberadoPor: null, criadoEm: "2026-11-19T12:00:00Z", envios: [], sequencia: null,
};

/** O compositor de um post novo, em branco, com três contas de exemplo. É o que abre em "Novo post". */
const demo: Demo = {
  caminho: "/admin/redes/publicar",
  desenho: () => (
    <div data-painel-largo>
      <p className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--setor)]">Posts e stories</p>
      <h1 className="font-display mt-2 text-3xl text-ink sm:text-4xl">Novo post</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">Monte uma vez e mande para as redes que quiser. Nada sai sem a confirmação do fim da página.</p>
      <div className="mt-5">
        <Compositor
          post={rascunhoDeExemplo}
          horarios={horarios}
          contas={[
            { id: "c-ig", rede: "instagram", nome: "@exemplo", ativa: true, podePublicar: true },
            { id: "c-fb", rede: "facebook", nome: "Página Exemplo", ativa: true, podePublicar: true },
            { id: "c-yt", rede: "youtube", nome: "Canal Exemplo", ativa: true, podePublicar: true },
          ]}
          limite={52_428_800}
          acoes={{ prepararSubida: subida as never, confirmarSubida: subida as never, salvarRascunho: rascunho as never, salvarELiberar: liberar as never }}
        />
      </div>
    </div>
  ),
};
export default demo;
