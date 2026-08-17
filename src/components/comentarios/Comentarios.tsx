"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { BadgeCheck, MessageCircle, Send } from "lucide-react";
import { enviarComentario, type ComentarState } from "@/app/(site)/[slug]/comentar";
import {
  contarComentarios,
  type Comentario,
  type ComentarioComRespostas,
} from "@/lib/data/comentarios";
import { SITE } from "@/lib/seo/site";
import { Button } from "@/components/ui/Button";

function quando(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "long", year: "numeric",
  });
}

function iniciais(nome: string) {
  return nome.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

function Enviar() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" carregando={pending} icone={<Send size={14} />}>
      {pending ? "Enviando…" : "Enviar comentário"}
    </Button>
  );
}

/**
 * Um balão de comentário.
 *
 * O mesmo desenho serve a pergunta e a resposta, com `daEquipe` mudando só a
 * assinatura e a cor. Duas marcações diferentes para a mesma coisa fariam a
 * resposta ficar para trás na próxima mexida no visual.
 */
function Balao({ c }: { c: Comentario }) {
  return (
    <>
      <div className="flex items-center gap-3">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
            c.daEquipe ? "bg-brand text-ink" : "bg-brand/15 text-brand-strong"
          }`}
        >
          {c.daEquipe ? "JK" : iniciais(c.authorName)}
        </span>
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-ink">
            {c.authorName}
            {c.daEquipe ? (
              // Selo, e não só a cor do balão: quem chega pela busca precisa
              // saber em uma olhada que ali é a loja falando, e não outro
              // cliente com a mesma dúvida.
              <span className="inline-flex items-center gap-1 rounded-full bg-brand/15 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-brand-strong">
                <BadgeCheck size={11} aria-hidden />
                Resposta da loja
              </span>
            ) : null}
          </p>
          <p className="text-xs text-muted">
            <time dateTime={c.createdAt}>{quando(c.createdAt)}</time>
          </p>
        </div>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-foreground">
        {c.body}
      </p>
    </>
  );
}

export function Comentarios({
  contentId, slug, iniciais: lista,
}: {
  contentId: string;
  slug: string;
  iniciais: ComentarioComRespostas[];
}) {
  const [estado, acao] = useActionState<ComentarState, FormData>(enviarComentario, {});
  const [abertoEm, setAbertoEm] = useState(0);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => setAbertoEm(Date.now()), []);
  useEffect(() => { if (estado.ok) form.current?.reset(); }, [estado.ok]);

  const campo =
    "w-full rounded-[12px] border border-border bg-white/70 px-4 py-3 text-ink outline-none transition-colors placeholder:text-muted/50 hover:border-brand/40 focus:border-brand";

  return (
    <section className="mt-16 max-w-2xl" id="comentarios">
      <h2 className="font-display flex items-center gap-2.5 text-2xl text-ink">
        <MessageCircle size={20} className="text-brand-nav" />
        Comentários
        {lista.length > 0 ? (
          <span className="text-lg text-muted">({contarComentarios(lista)})</span>
        ) : null}
      </h2>

      {lista.length > 0 ? (
        <ul className="mt-7 space-y-5">
          {lista.map((c) => (
            <li key={c.id} className="glass rounded-[16px] p-5">
              <Balao c={c} />

              {c.respostas.length > 0 ? (
                /* A resposta mora DENTRO do balão da pergunta, encostada numa
                   linha dourada: fio de conversa se lê pela indentação, e uma
                   resposta solta na lista vira outro comentário aos olhos de
                   quem passa. */
                <ul className="mt-5 space-y-4 border-l-2 border-brand/30 pl-4 sm:pl-5">
                  {c.respostas.map((r) => (
                    <li key={r.id}>
                      <Balao c={r} />
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-5 text-muted">
          Nenhum comentário ainda. Ficou com alguma dúvida sobre o assunto?
        </p>
      )}

      <form ref={form} action={acao} className="glass mt-8 rounded-[18px] p-6">
        <p className="text-sm font-semibold text-ink">Deixe sua dúvida ou experiência</p>
        <p className="mt-1 text-xs text-muted">
          Todo comentário passa por revisão antes de aparecer. Seu e-mail não é
          publicado, e quem responde por aqui é a equipe da {SITE.name}.
        </p>

        <input type="hidden" name="content_id" value={contentId} />
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="aberto_em" value={abertoEm} />

        {/* Campo isca: invisível para gente, atrativo para robô. */}
        <div aria-hidden className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
          <label>
            Não preencha este campo
            <input type="text" name="site" tabIndex={-1} autoComplete="off" />
          </label>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-semibold text-ink">Nome</span>
            <input name="nome" required maxLength={120} className={`${campo} mt-1.5`} placeholder="Como podemos te chamar" />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-ink">E-mail (opcional)</span>
            <input name="email" type="email" maxLength={200} className={`${campo} mt-1.5`} placeholder="Só para responder você" />
          </label>
        </div>

        <label className="mt-4 block">
          <span className="text-xs font-semibold text-ink">Comentário</span>
          <textarea name="corpo" required rows={4} maxLength={2000} className={`${campo} mt-1.5 resize-y`} placeholder="Escreva aqui" />
        </label>

        {estado.erro ? (
          <p role="alert" className="mt-4 rounded-[12px] border border-wine/25 bg-wine/5 px-4 py-3 text-sm text-wine">{estado.erro}</p>
        ) : null}
        {estado.ok ? (
          <p role="status" className="mt-4 rounded-[12px] border border-brand/30 bg-brand/8 px-4 py-3 text-sm text-brand-strong">{estado.ok}</p>
        ) : null}

        <div className="mt-5">
          <Enviar />
        </div>
      </form>
    </section>
  );
}
