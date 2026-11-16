import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Flame } from "lucide-react";
import { SeloDaRede } from "@/components/redes/Selo";
import { LinkRapido } from "@/components/ui/LinkRapido";
import { requireArea } from "@/lib/auth/session";
import { listarComentarios } from "@/lib/redes/comentarios";
import { FATOR_ACIMA, NOME_DO_GRUPO, fatorEmPalavra, type Conteudo } from "@/lib/redes/conteudos";
import { lerConteudo } from "@/lib/redes/conteudos-dados";
import { nomeDaRede } from "@/lib/redes/redes";
import { compacto, haQuanto } from "@/lib/redes/resumo";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { marcar, ocultar, responder } from "../../comentarios/actions";
import { CartaoDeComentario } from "../../comentarios/Tela";
import { Capa } from "../Capa";
import { formatoNaRede } from "../Tela";

export const metadata = { title: "Publicação" };

// Responder um comentário fala com a rede na hora.
export const maxDuration = 30;

/**
 * Uma publicação: os números dela, comparados com o normal da conta, e os
 * comentários DELA, com responder ali mesmo. Só lê o banco.
 */

const NAO_INFORMA = "a rede não informa";

function Numero({ rotulo, valor, apoio }: { rotulo: string; valor: number | null; apoio?: string }) {
  return (
    <div className="min-w-0 rounded-[12px] bg-ink/[0.035] px-3 py-2.5">
      <p className="text-[0.62rem] font-semibold uppercase tracking-wide text-muted">{rotulo}</p>
      {valor === null ? <p className="mt-1 text-[0.72rem] leading-snug text-muted">{NAO_INFORMA}</p> : <p className="font-display numeros mt-0.5 text-xl leading-tight text-ink">{compacto(valor)}</p>}
      {apoio ? <p className="mt-0.5 text-[0.68rem] leading-snug text-muted">{apoio}</p> : null}
    </div>
  );
}

function Comparacao({ c }: { c: Conteudo }) {
  const medida = c.regua === "visualizacoes" ? "visualizações" : c.regua === "alcance" ? "pessoas alcançadas" : "interações";
  const valor = c.regua === "visualizacoes" ? c.visualizacoes : c.regua === "alcance" ? c.alcance : c.interacoes;
  if (c.fator === null || valor === null) {
    return (
      <p className="text-sm leading-relaxed text-muted">
        Ainda não há um normal para comparar: a conta precisa de pelo menos cinco publicações de {NOME_DO_GRUPO[c.grupo].toLowerCase()} medidas pelo mesmo número nos últimos 90 dias. Os números de cada post chegam aos poucos, um lote a cada leitura.
      </p>
    );
  }
  const normal = valor / c.fator;
  return (
    <p className="text-sm leading-relaxed text-ink">
      {c.acima ? <Flame size={15} className="mr-1 inline-block align-[-2px]" style={{ color: "#046c4e" }} aria-hidden="true" /> : null}
      Rendeu <span className="font-semibold">{fatorEmPalavra(c.fator)}</span> o normal desta conta em {NOME_DO_GRUPO[c.grupo].toLowerCase()}: {compacto(valor)} {medida}, contra {compacto(Math.round(normal))} da mediana dos últimos 90 dias.
      {c.acima ? ` Passou de ${FATOR_ACIMA} vezes o normal: vale entender o que funcionou e fazer de novo.` : ""}
    </p>
  );
}

export default async function PublicacaoPage({ params }: { params: Promise<{ id: string }> }) {
  await requireArea("redes");
  const { id } = await params;
  const lido = await lerConteudo(await createClient(), id);
  if (!lido) notFound();
  const { conteudo: c, conta } = lido;
  const comentarios = await listarComentarios(createAdminClient(), "novos", { publicacao: c.id, limite: 200 });
  const agora = Date.now();
  const legenda = (c.legenda ?? "").trim();
  const emPe = c.formato === "story" || c.formato === "video_curto";
  const esperando = comentarios.filter((x) => x.estado === "novo").length;
  const quando = c.publicado_em
    ? new Date(c.publicado_em).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" }).replace(":", "h")
    : null;

  return (
    <div data-painel-largo>
      <LinkRapido href="/admin/redes/conteudos" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft size={15} aria-hidden="true" /> Em alta
      </LinkRapido>

      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] lg:items-start">
        <div className="mx-auto w-full max-w-[18rem] lg:sticky lg:top-[calc(var(--painel-topo,4rem)+1rem)]">
          <div className={"relative overflow-hidden rounded-[16px] bg-ink/[0.06] " + (emPe ? "aspect-[9/16]" : "aspect-[4/5]")}>
            <Capa src={c.miniatura_url} rede={c.rede} alt={legenda ? `Capa do post: ${legenda.slice(0, 90)}` : "Capa do post"} />
          </div>
          {c.link ? (
            <a href={c.link} target="_blank" rel="noreferrer" className="painel-toque mt-3 flex items-center justify-center gap-1.5 rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-white">
              Abrir no {nomeDaRede(c.rede)} <ArrowUpRight size={15} aria-hidden="true" />
            </a>
          ) : null}
        </div>

        <div className="min-w-0">
          <header className="flex items-center gap-2.5">
            <SeloDaRede id={c.rede} tamanho={34} />
            <div className="min-w-0">
              <p className="eyebrow">Social Media</p>
              <h1 className="font-display mt-0.5 text-2xl leading-tight text-ink sm:text-3xl">{formatoNaRede(c.formato, c.rede)}</h1>
            </div>
          </header>
          <p className="mt-2 text-sm text-muted">
            {nomeDaRede(c.rede)}
            {conta ? ` · ${conta.nome}` : ""}
            {quando ? ` · ${quando}` : ""}
          </p>

          {legenda ? <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-ink [overflow-wrap:anywhere]">{legenda}</p> : <p className="mt-4 text-sm text-muted">Publicação sem legenda.</p>}

          <section className="glass mt-5 rounded-[18px] p-4 sm:p-5" aria-labelledby="t-numeros">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="t-numeros" className="text-sm font-semibold text-ink">
                Os números
              </h2>
              <p className="text-[0.7rem] text-muted">{c.metricas_em ? `Lidos ${haQuanto(c.metricas_em, agora)}` : "Ainda sem a leitura dos números deste post"}</p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
              <Numero rotulo="Visualizações" valor={c.visualizacoes} />
              <Numero rotulo="Pessoas alcançadas" valor={c.alcance} />
              <Numero rotulo="Curtidas" valor={c.curtidas} />
              <Numero rotulo="Comentários" valor={c.comentarios} />
              <Numero rotulo="Salvos" valor={c.salvos} />
              <Numero rotulo="Compartilhamentos" valor={c.compartilhamentos} />
              <Numero rotulo="Engajamento" valor={c.taxa === null ? null : Math.round(c.taxa * 10) / 10} apoio={c.taxa === null ? undefined : "interações a cada 100 que viram"} />
            </div>
            <div className="mt-4 border-t border-ink/[0.07] pt-3">
              <Comparacao c={c} />
            </div>
          </section>

          <section className="mt-7" aria-labelledby="t-comentarios">
            <h2 id="t-comentarios" className="text-sm font-semibold text-ink">
              Comentários deste post
              {comentarios.length ? <span className="font-normal text-muted"> · {comentarios.length} lidos{esperando ? `, ${esperando} esperando resposta` : ""}</span> : null}
            </h2>
            {comentarios.length === 0 ? (
              <p className="glass mt-3 rounded-[16px] p-4 text-sm leading-relaxed text-muted">
                {c.comentarios ? "O painel ainda não leu os comentários deste post. Ele busca os comentários dos posts dos últimos 30 dias, de meia em meia hora." : "Nenhum comentário neste post."}
              </p>
            ) : (
              <ul className="mt-3 grid grid-cols-1 gap-3">
                {comentarios.map((x) => (
                  <CartaoDeComentario key={x.id} c={x} agora={agora} acoes={{ responder, marcar, ocultar }} semPost />
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
