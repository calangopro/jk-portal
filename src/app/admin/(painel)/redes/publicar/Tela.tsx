import Link from "next/link";
import { CircleCheck, Plus } from "lucide-react";
import { LinkRapido } from "@/components/ui/LinkRapido";
import type { FiltroDePosts, PostNaTela } from "@/lib/redes/posts";
import { CartaoDoPost, type AcoesDoPost } from "./CartaoDoPost";

/**
 * "Posts e stories", só o desenho: as quatro abas e os posts de cada uma.
 * A leitura fica em `page.tsx`.
 *
 * A aba que abre é a fila, porque é a pergunta do dia a dia: o que vai sair e
 * quando. Erro tem aba própria e número em vermelho, para não passar batido.
 */

const ABAS: { id: FiltroDePosts; nome: string; vazio: string }[] = [
  { id: "fila", nome: "Na fila", vazio: "Nada marcado para sair. Um post agendado aparece aqui, com a hora e as redes." },
  { id: "rascunhos", nome: "Rascunhos", vazio: "Nenhum rascunho guardado." },
  { id: "publicados", nome: "Publicados", vazio: "Nada foi publicado pelo painel ainda." },
  { id: "erros", nome: "Com erro", vazio: "Nenhum post com erro." },
];

export function TelaDePublicar({
  aba, posts, contagem, agora, saiu, acoes,
}: {
  aba: FiltroDePosts;
  posts: PostNaTela[];
  contagem: { fila: number; rascunhos: number; erros: number };
  agora: number;
  saiu: "agora" | "agendado" | null;
  acoes: AcoesDoPost;
}) {
  const atual = ABAS.find((a) => a.id === aba) ?? ABAS[0];
  const numero = (id: FiltroDePosts) => (id === "publicados" ? null : contagem[id]);

  return (
    <div data-painel-largo>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow">Social Media</p>
          <h1 className="font-display mt-2 text-3xl text-ink sm:text-4xl">Posts e stories</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted sm:text-base">
            Monte o post uma vez e mande para as redes que quiser, agora ou na hora marcada. O painel publica sozinho o que foi agendado.
          </p>
        </div>
        <LinkRapido href="/admin/redes/publicar/novo" className="painel-toque inline-flex items-center gap-1.5 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white">
          <Plus size={16} aria-hidden="true" /> Novo post
        </LinkRapido>
      </header>

      {saiu ? (
        <p role="status" className="mt-5 flex items-start gap-2 rounded-[14px] px-3.5 py-3 text-sm leading-relaxed" style={{ color: "#046c4e", background: "#e3f4ec" }}>
          <CircleCheck size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          {saiu === "agora"
            ? "Mandado sair. A publicação leva de alguns segundos (foto) a alguns minutos (vídeo): o estado de cada rede aparece abaixo, recarregando a página."
            : "Agendado. O painel publica sozinho na hora marcada, e dá para mudar ou tirar da fila até lá."}
        </p>
      ) : null}

      <nav aria-label="Situação dos posts" className="mt-5 flex max-w-full gap-1 overflow-x-auto rounded-full border border-border bg-surface/60 p-1">
        {ABAS.map((a) => {
          const n = numero(a.id);
          return (
            <Link
              key={a.id}
              href={`?aba=${a.id}`}
              scroll={false}
              aria-current={a.id === aba ? "page" : undefined}
              className={"flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold " + (a.id === aba ? "painel-aba-ativa" : "text-muted hover:text-ink")}
            >
              {a.nome}
              {n ? (
                <span
                  className="grid h-[1.15rem] min-w-[1.15rem] place-items-center rounded-full px-1 text-[0.62rem] font-bold"
                  style={a.id === "erros" ? { color: "#fff", background: "#b01919" } : a.id === aba ? { color: "var(--setor)", background: "#fff" } : { color: "var(--color-ink)", background: "rgb(23 21 18 / 0.08)" }}
                >
                  {n}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      {posts.length === 0 ? (
        <div className="glass mt-5 rounded-[20px] px-5 py-10 text-center sm:py-14">
          <p className="font-display text-xl text-ink">{atual.vazio}</p>
          {aba === "fila" || aba === "rascunhos" ? (
            <LinkRapido href="/admin/redes/publicar/novo" className="painel-toque mt-5 inline-flex items-center gap-1.5 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white">
              <Plus size={16} aria-hidden="true" /> Montar um post
            </LinkRapido>
          ) : null}
        </div>
      ) : (
        <ul className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-2">
          {posts.map((p) => (
            <li key={p.id} className="min-w-0">
              <CartaoDoPost post={p} agora={agora} acoes={acoes} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
