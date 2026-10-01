"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ExternalLink } from "lucide-react";
import { NOMES_DOS_TEMAS } from "@/lib/bio/tipos";
import { LINK_DO_GRUPO, PAGINA_DO_GRUPO, TEMAS_DO_GRUPO, type ConfigDoGrupo } from "@/lib/grupo/tipos";
import { BotaoCopiar } from "../bio/LinksParaDivulgar";
import { salvarGrupo, type EstadoDoGrupo } from "./actions";

const campo =
  "w-full rounded-[10px] border border-border bg-white/80 px-3 py-2 text-sm text-ink outline-none transition-colors hover:border-brand/40 focus:border-brand";

/** Parâmetros do gerenciador do Meta, os mesmos da bio, com a campanha e o anúncio pelo nome. */
const PARAMETROS_DO_ANUNCIO =
  "utm_source=instagram&utm_medium=paid_social&utm_campaign={{campaign.name}}&utm_content={{ad.name}}";

const curto = (url: string) => url.replace(/^https:\/\/www\./, "");

function Salvar() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-brand px-4 py-2 text-xs font-semibold text-ink transition-colors hover:bg-brand-light disabled:opacity-60"
    >
      {pending ? "Salvando…" : "Salvar"}
    </button>
  );
}

function LinkParaCopiar({ titulo, valor, texto }: { titulo: string; valor: string; texto: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-ink">{titulo}</p>
      <div className="mt-1.5 flex items-center gap-3 rounded-[12px] border border-border bg-white/70 p-3">
        <code className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{curto(valor)}</code>
        <BotaoCopiar valor={valor} />
      </div>
      <p className="mt-1.5 text-[0.7rem] leading-snug text-muted">{texto}</p>
    </div>
  );
}

export function ConfigDoGrupo({ inicial, temaDeHoje }: { inicial: ConfigDoGrupo; temaDeHoje: string }) {
  const [estado, acao] = useActionState<EstadoDoGrupo, FormData>(salvarGrupo, {});

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <form action={acao} className="glass rounded-[18px] p-5">
        <h2 className="font-medium text-ink">Para onde o grupo leva</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          O convite do grupo, ou o link do DevZapp que distribui entre vários grupos. Quando o grupo encher, troque
          aqui: o anúncio, a bio, o QR das lojas e o ManyChat continuam com o mesmo link.
        </p>

        <label className="mt-4 block">
          <span className="text-xs font-semibold text-ink">Link do grupo</span>
          <input
            name="destino"
            type="url"
            defaultValue={inicial.destino}
            placeholder="https://chat.whatsapp.com/..."
            className={`${campo} mt-1`}
          />
        </label>
        {inicial.destino ? (
          <a
            href={inicial.destino}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1.5 inline-flex items-center gap-1 text-[0.7rem] font-semibold text-brand-nav hover:underline"
          >
            Abrir o link salvo
            <ExternalLink size={11} aria-hidden />
          </a>
        ) : (
          <p className="mt-1.5 text-[0.7rem] text-wine">Sem link salvo, quem toca no botão do grupo cai na bio.</p>
        )}

        <label className="mt-4 block">
          <span className="text-xs font-semibold text-ink">Visual da página</span>
          <select name="tema" defaultValue={inicial.tema} className={`${campo} mt-1`}>
            {TEMAS_DO_GRUPO.map((t) => (
              <option key={t} value={t}>
                {t === "campanha" ? `Acompanhar a campanha do dia (hoje: ${temaDeHoje})` : NOMES_DOS_TEMAS[t]}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-[0.68rem] leading-snug text-muted">
            Acompanhando a campanha, a página vira Black sozinha em 01/11, com o texto da Black. Os textos do formulário
            são os do bloco &quot;Grupo de ofertas no WhatsApp&quot; de cada campanha, no Link da bio.
          </span>
        </label>

        {estado.erro ? <p className="mt-3 text-xs text-wine">{estado.erro}</p> : null}
        {estado.ok ? <p className="mt-3 text-xs text-brand-strong">{estado.ok}</p> : null}

        <div className="mt-4">
          <Salvar />
        </div>
      </form>

      <section className="glass rounded-[18px] p-5">
        <h2 className="font-medium text-ink">Links para divulgar</h2>
        <div className="mt-4 space-y-4">
          <LinkParaCopiar
            titulo="Página do anúncio, com cadastro"
            valor={PAGINA_DO_GRUPO}
            texto="Vai no anúncio. Pede nome e WhatsApp, grava o contato e leva ao grupo."
          />
          <LinkParaCopiar
            titulo="Direto para o grupo, sem cadastro"
            valor={LINK_DO_GRUPO}
            texto="Para o QR das lojas, o ManyChat e o fim do atendimento. Leva ao link salvo ao lado."
          />
          <div>
            <div className="flex items-start gap-2">
              <p className="min-w-0 flex-1 text-xs font-semibold text-ink">Parâmetros de URL do anúncio no Meta</p>
              <BotaoCopiar valor={PARAMETROS_DO_ANUNCIO} />
            </div>
            <code className="mt-2 block break-all rounded-[8px] bg-ink/5 px-2 py-1.5 text-[0.66rem] leading-relaxed text-ink">
              {PARAMETROS_DO_ANUNCIO}
            </code>
            <p className="mt-1.5 text-[0.7rem] leading-snug text-muted">
              No anúncio, o site é a página do anúncio acima e isto vai em Parâmetros de URL. Anúncio só no Facebook: troque
              instagram por facebook.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
