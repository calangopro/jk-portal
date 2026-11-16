"use client";

import { useState, useTransition } from "react";
import { ArrowUpRight, CalendarClock, Film, ImageOff, LoaderCircle, Pencil, RotateCcw, Send, Trash2, Type, XCircle } from "lucide-react";
import { SeloDaRede } from "@/components/redes/Selo";
import { LinkRapido } from "@/components/ui/LinkRapido";
import { NOME_DO_FORMATO, nomeDaRede, nomeDoFormatoNaRede } from "@/lib/redes/redes";
import type { EnvioNaTela, PostNaTela } from "@/lib/redes/posts";
import { SeloDeTom } from "../../Pecas";
import type { Tom } from "@/lib/painel/tons";
import type { Resposta } from "./actions";

/**
 * Um post na lista: a peça, quando sai, quem fez, e o estado em CADA rede.
 *
 * O mesmo post pode ter saído no Instagram, falhado no Facebook e ainda estar
 * preparando o vídeo no YouTube. Por isso o estado é por rede, uma linha cada,
 * com o motivo por extenso quando deu erro.
 *
 * Toda ação que põe ou tira coisa da rua pede um segundo toque, com a frase
 * dizendo o que vai acontecer.
 */

export type AcoesDoPost = {
  liberar: (id: string, quando: string | null) => Promise<Resposta<{ quando: string; contas: string[] }>>;
  cancelar: (id: string) => Promise<Resposta<{ cancelados: number }>>;
  apagar: (id: string) => Promise<Resposta>;
  /** Tira da fila tudo o que falta sair de uma sequência de stories. */
  cancelarSequencia?: (sequencia: string) => Promise<Resposta<{ cancelados: number }>>;
};

const ESTADO_DO_ENVIO: Record<string, { tom: Tom; nome: string }> = {
  rascunho: { tom: "neutro", nome: "Rascunho" },
  agendado: { tom: "neutro", nome: "Marcado" },
  publicando: { tom: "atencao", nome: "Saindo agora" },
  processando: { tom: "atencao", nome: "A rede prepara o vídeo" },
  publicado: { tom: "bom", nome: "No ar" },
  erro: { tom: "ruim", nome: "Não saiu" },
  cancelado: { tom: "neutro", nome: "Cancelado" },
};

const ESTADO_DO_POST: Record<string, { tom: Tom; nome: string }> = {
  rascunho: { tom: "neutro", nome: "Rascunho" },
  agendado: { tom: "neutro", nome: "Agendado" },
  publicando: { tom: "atencao", nome: "Saindo" },
  publicado: { tom: "bom", nome: "Publicado" },
  parcial: { tom: "atencao", nome: "Saiu em parte" },
  erro: { tom: "ruim", nome: "Não saiu" },
  cancelado: { tom: "neutro", nome: "Cancelado" },
};

export const diaEHora = (iso: string) => {
  const p = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(iso));
  const v = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return `${v("weekday").replace(".", "")}, ${v("day")}/${v("month")} às ${v("hour")}h${v("minute")}`;
};

/** "em 3 horas", "em 2 dias", "há 5 minutos". */
function distancia(iso: string, agora: number): string {
  const min = Math.round((Date.parse(iso) - agora) / 60_000);
  const abs = Math.abs(min);
  const quanto = abs < 60 ? `${Math.max(abs, 1)} ${abs <= 1 ? "minuto" : "minutos"}` : abs < 36 * 60 ? `${Math.round(abs / 60)} ${Math.round(abs / 60) === 1 ? "hora" : "horas"}` : `${Math.round(abs / 1440)} dias`;
  return min >= 0 ? `em ${quanto}` : `há ${quanto}`;
}

function LinhaDoEnvio({ e, formato }: { e: EnvioNaTela; formato: PostNaTela["formato"] }) {
  const estado = ESTADO_DO_ENVIO[e.status] ?? ESTADO_DO_ENVIO.rascunho;
  return (
    <li className="py-2.5">
      <div className="flex items-center gap-2.5">
        <SeloDaRede id={e.rede} tamanho={26} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{nomeDaRede(e.rede)}</p>
          <p className="truncate text-xs text-muted">
            {e.conta} · {nomeDoFormatoNaRede(formato, e.rede)}
          </p>
        </div>
        <SeloDeTom tom={estado.tom}>{estado.nome}</SeloDeTom>
      </div>
      {e.erro && (e.status === "erro" || e.status === "agendado") ? (
        <p className="mt-1.5 break-words rounded-[8px] px-2.5 py-1.5 text-xs leading-relaxed" style={e.status === "erro" ? { color: "#b01919", background: "#fde8e8" } : { color: "#9a4a07", background: "#fcefd9" }}>
          {e.status === "agendado" ? "Falhou e vai tentar de novo sozinho. " : ""}
          {e.erro}
        </p>
      ) : null}
      {e.avisos.map((a) => (
        <p key={a} className="mt-1.5 break-words rounded-[8px] px-2.5 py-1.5 text-xs leading-relaxed" style={{ color: "#9a4a07", background: "#fcefd9" }}>
          {a}
        </p>
      ))}
      {e.url ? (
        <a href={e.url} target="_blank" rel="noreferrer" className="mt-1.5 inline-flex items-center gap-0.5 text-xs font-semibold text-[var(--setor)]">
          Abrir na rede <ArrowUpRight size={12} aria-hidden="true" />
        </a>
      ) : null}
    </li>
  );
}

export function CartaoDoPost({ post, agora, acoes, semLink = false }: { post: PostNaTela; agora: number; acoes: AcoesDoPost; semLink?: boolean }) {
  const [pedindo, setPedindo] = useState<null | "publicar" | "cancelar" | "apagar" | "sequencia">(null);
  const [resposta, setResposta] = useState<{ tom: "bom" | "ruim"; texto: string } | null>(null);
  const [rodando, iniciar] = useTransition();

  const estado = ESTADO_DO_POST[post.status] ?? ESTADO_DO_POST.rascunho;
  const capa = post.midias[0];
  const nuncaSaiu = !post.envios.some((e) => ["publicado", "publicando", "processando"].includes(e.status));
  const naFila = post.envios.some((e) => ["agendado", "processando"].includes(e.status));
  const comErro = post.envios.filter((e) => e.status === "erro");
  const pendentes = post.envios.filter((e) => e.status !== "publicado");
  const editavel = ["rascunho", "agendado", "erro", "cancelado", "parcial"].includes(post.status);
  const nomes = pendentes.map((e) => `${nomeDaRede(e.rede)} ${e.conta}`.trim());
  const juntos = nomes.length <= 1 ? nomes.join("") : `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;

  const fazer = (f: () => Promise<Resposta<object>>, deuCerto: string) =>
    iniciar(async () => {
      const r = await f();
      setPedindo(null);
      setResposta(r.ok ? { tom: "bom", texto: deuCerto } : { tom: "ruim", texto: r.erro });
    });

  return (
    <article className="glass min-w-0 rounded-[18px] p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="relative grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-[11px] bg-ink/[0.06] text-muted sm:h-20 sm:w-20">
          {capa?.tipo === "imagem" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={capa.url} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : capa?.tipo === "video" ? (
            <Film size={22} aria-hidden="true" />
          ) : post.formato === "texto" ? (
            <Type size={22} aria-hidden="true" />
          ) : (
            <ImageOff size={22} aria-hidden="true" />
          )}
          {post.midias.length > 1 ? <span className="absolute bottom-0.5 right-0.5 rounded bg-ink/80 px-1 text-[0.6rem] font-semibold text-white">{post.midias.length}</span> : null}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <SeloDeTom tom={estado.tom}>{estado.nome}</SeloDeTom>
            <span className="text-xs font-semibold text-ink">
              {post.sequencia ? `Story ${post.sequencia.ordem} de ${post.sequencia.total} da sequência` : post.formato === "story" && post.midias.length > 1 ? `Sequência de ${post.midias.length} stories` : NOME_DO_FORMATO[post.formato]}
            </span>
          </div>
          {post.titulo ? <p className="mt-1 break-words text-sm font-semibold text-ink">{post.titulo}</p> : null}
          <p className="mt-1 line-clamp-3 whitespace-pre-line text-sm leading-snug text-ink [overflow-wrap:anywhere]">{post.legenda.trim() || <span className="text-muted">Sem legenda</span>}</p>
        </div>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-muted">
        {post.status === "agendado" && post.agendadoPara ? (
          <>
            <CalendarClock size={12} className="mr-1 inline-block align-[-1px]" aria-hidden="true" />
            <span className="font-semibold text-ink">Sai {diaEHora(post.agendadoPara)}</span> ({distancia(post.agendadoPara, agora)}).{" "}
          </>
        ) : post.publicadoEm ? (
          <>
            <span className="font-semibold text-ink">Saiu {diaEHora(post.publicadoEm)}.</span>{" "}
          </>
        ) : null}
        {post.criadoPor ? `Montado por ${post.criadoPor}` : "Montado"}
        {post.origem === "conector" ? ", pelo Claude" : ""}
        {post.liberadoPor && post.status !== "rascunho" ? `; mandado sair por ${post.liberadoPor}` : ""}.
      </p>

      {post.envios.length ? (
        <ul className="mt-2 divide-y divide-ink/[0.07] border-t border-ink/[0.07]">
          {post.envios.map((e) => (
            <LinhaDoEnvio key={e.id} e={e} formato={post.formato} />
          ))}
        </ul>
      ) : (
        <p className="mt-3 border-t border-ink/[0.07] pt-3 text-xs text-muted">Nenhuma rede escolhida ainda.</p>
      )}

      {resposta ? (
        <p role={resposta.tom === "ruim" ? "alert" : "status"} className="mt-3 break-words rounded-[10px] px-3 py-2 text-xs font-semibold leading-relaxed" style={resposta.tom === "ruim" ? { color: "#b01919", background: "#fde8e8" } : { color: "#046c4e", background: "#e3f4ec" }}>
          {resposta.texto}
        </p>
      ) : null}

      {pedindo ? (
        <div className="mt-3 rounded-[12px] bg-ink/[0.04] p-3">
          <p className="break-words text-xs leading-relaxed text-ink">
            {pedindo === "publicar"
              ? `Vai sair agora em ${juntos}. É público e sai no nome da JK.${comErro.length ? " Se a mensagem de erro pediu para conferir na rede, confira antes: publicar de novo pode sair em dobro." : ""}`
              : pedindo === "cancelar"
                ? "O post sai da fila e fica guardado em Rascunhos. O que já saiu em alguma rede continua lá."
                : pedindo === "sequencia"
                  ? `Os stories desta sequência que ainda não saíram saem da fila e ficam em Rascunhos. Os que já saíram continuam no ar.`
                  : "O post e as mídias dele são apagados do painel. Não dá para desfazer."}
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={rodando}
              onClick={() =>
                pedindo === "publicar"
                  ? fazer(() => acoes.liberar(post.id, null), "Mandado sair. O estado de cada rede aparece aqui em instantes, recarregando a página.")
                  : pedindo === "cancelar"
                    ? fazer(() => acoes.cancelar(post.id), "Tirado da fila.")
                    : pedindo === "sequencia" && post.sequencia && acoes.cancelarSequencia
                      ? fazer(() => acoes.cancelarSequencia!(post.sequencia!.id), "Sequência tirada da fila.")
                      : fazer(() => acoes.apagar(post.id), "Apagado.")
              }
              className="painel-toque inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
            >
              {rodando ? <LoaderCircle size={13} className="animate-spin" aria-hidden="true" /> : null}
              {pedindo === "publicar" ? "Sim, publicar agora" : pedindo === "cancelar" ? "Sim, tirar da fila" : pedindo === "sequencia" ? "Sim, tirar a sequência" : "Sim, apagar"}
            </button>
            <button type="button" disabled={rodando} onClick={() => setPedindo(null)} className="rounded-full px-3 py-2 text-xs font-semibold text-muted hover:text-ink">
              Voltar
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {editavel && !semLink ? (
            <LinkRapido href={`/admin/redes/publicar/${post.id}`} className="painel-toque inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-white px-3.5 py-2 text-xs font-semibold text-ink">
              <Pencil size={13} aria-hidden="true" /> Editar
            </LinkRapido>
          ) : null}
          {(post.status === "rascunho" || post.status === "cancelado") && pendentes.length > 0 ? (
            <button type="button" onClick={() => setPedindo("publicar")} className="painel-toque inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-white px-3.5 py-2 text-xs font-semibold text-ink">
              <Send size={13} aria-hidden="true" /> Publicar agora
            </button>
          ) : null}
          {comErro.length > 0 && !naFila ? (
            <button type="button" onClick={() => setPedindo("publicar")} className="painel-toque inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-white px-3.5 py-2 text-xs font-semibold text-ink">
              <RotateCcw size={13} aria-hidden="true" /> Tentar de novo
            </button>
          ) : null}
          {naFila ? (
            <button type="button" onClick={() => setPedindo("cancelar")} className="painel-toque inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-white px-3.5 py-2 text-xs font-semibold text-ink">
              <XCircle size={13} aria-hidden="true" /> Tirar da fila
            </button>
          ) : null}
          {naFila && post.sequencia && post.sequencia.total > 1 && acoes.cancelarSequencia ? (
            <button type="button" onClick={() => setPedindo("sequencia")} className="painel-toque inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-white px-3.5 py-2 text-xs font-semibold text-ink">
              <XCircle size={13} aria-hidden="true" /> Tirar a sequência inteira
            </button>
          ) : null}
          {nuncaSaiu && !naFila ? (
            <button type="button" onClick={() => setPedindo("apagar")} className="painel-toque inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold text-muted hover:text-wine">
              <Trash2 size={13} aria-hidden="true" /> Apagar
            </button>
          ) : null}
          {!editavel && !semLink ? (
            <LinkRapido href={`/admin/redes/publicar/${post.id}`} className="painel-toque inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-white px-3.5 py-2 text-xs font-semibold text-ink">
              Ver o post
            </LinkRapido>
          ) : null}
        </div>
      )}
    </article>
  );
}
