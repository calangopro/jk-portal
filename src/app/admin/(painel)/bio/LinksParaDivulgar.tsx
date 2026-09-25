"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { SITE } from "@/lib/seo/site";

/**
 * O link da bio, curto, e o que ainda precisa de etiqueta.
 *
 * A primeira versão deste cartão tinha um link comprido com UTM para cada
 * canal, e a JK achou feio e ruim de usar. Agora a própria bio descobre a
 * origem (ver `components/bio/OrigemDaBio.tsx`), e o link é um só. Sobram dois
 * casos: o canal que não se identifica ganha um `?o=` curto, e o anúncio
 * continua com os parâmetros do gerenciador, porque clique de anúncio e clique
 * no perfil chegam iguais do Instagram.
 *
 * O endereço é o da loja, e não `SITE.origin`, porque em desenvolvimento a
 * origem é localhost e o link copiado iria quebrado para o Instagram.
 */
const BIO = `${SITE.lojaUrl}/bio`;
const BIO_CURTO = BIO.replace(/^https:\/\/www\./, "");

const PARAMETROS_DO_ANUNCIO =
  "utm_source=instagram&utm_medium=paid_social&utm_campaign={{campaign.name}}&utm_content={{ad.name}}";

function BotaoCopiar({ valor }: { valor: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(valor);
          setCopiado(true);
          window.setTimeout(() => setCopiado(false), 2000);
        } catch {
          // Sem permissão de área de transferência: o texto está na tela.
        }
      }}
      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-ink/15 px-2.5 py-1 text-[0.68rem] font-semibold text-ink hover:border-brand/50 hover:text-brand-nav"
    >
      {copiado ? <Check size={12} /> : <Copy size={12} />}
      {copiado ? "Copiado" : "Copiar"}
    </button>
  );
}

export function LinksParaDivulgar() {
  return (
    <section className="glass rounded-[18px] p-5">
      <h2 className="font-medium text-ink">Link para divulgar</h2>

      <div className="mt-4 flex items-center gap-3 rounded-[12px] border border-border bg-white/70 p-3">
        <code className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{BIO_CURTO}</code>
        <BotaoCopiar valor={BIO} />
      </div>

      <p className="mt-3 text-xs leading-relaxed text-muted">
        É o mesmo link em todo lugar. A bio reconhece sozinha quem chega do <strong className="text-ink">Instagram</strong>,
        do <strong className="text-ink">TikTok</strong>, do <strong className="text-ink">Facebook</strong>, do{" "}
        <strong className="text-ink">Threads</strong>, do <strong className="text-ink">Pinterest</strong> e do{" "}
        <strong className="text-ink">YouTube</strong>, e o GA4 guarda essa origem até a compra na loja.
      </p>

      <div className="mt-4 space-y-3 border-t border-border/70 pt-4">
        <div>
          <p className="text-xs font-semibold text-ink">WhatsApp, e-mail e QR code</p>
          <p className="mt-0.5 text-[0.7rem] leading-snug text-muted">
            Esses não se identificam. Acrescente <code className="rounded bg-ink/5 px-1">?o=</code> e o nome do canal,
            como {BIO_CURTO}?o=whatsapp. Sem isso, a visita conta como acesso direto.
          </p>
        </div>

        <div>
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-ink">Anúncio no Meta</p>
              <p className="mt-0.5 text-[0.7rem] leading-snug text-muted">
                No anúncio, o site é o link acima e isto vai em Parâmetros de URL. É a única etiqueta que sobra: clique de
                anúncio e clique no perfil chegam iguais do Instagram. A bio marca sozinha que o anúncio passou por ela
                (utm_term=bio). Anúncio só no Facebook: troque instagram por facebook.
              </p>
            </div>
            <BotaoCopiar valor={PARAMETROS_DO_ANUNCIO} />
          </div>
          <code className="mt-2 block break-all rounded-[8px] bg-ink/5 px-2 py-1.5 text-[0.66rem] leading-relaxed text-ink">
            {PARAMETROS_DO_ANUNCIO}
          </code>
        </div>
      </div>
    </section>
  );
}
