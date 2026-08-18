import Link from "next/link";
import { Ruler, MapPin, ArrowRight } from "lucide-react";

/**
 * Blocos de apoio no celular: medidor e lojas.
 *
 * No desktop isso vive na coluna lateral. No celular entra aqui, logo depois do
 * artigo e ANTES dos comentários, porque todo o aparato de conversão ficava
 * escondido no fim da página, que é justamente onde está a maior parte do
 * tráfego.
 *
 * A lista de leitura saiu daqui: ela virou o "Leia também" do fim do artigo, que
 * aparece em qualquer largura. Mantida nos dois lugares, o celular mostrava os
 * mesmos quatro links duas vezes seguidas.
 */
export function ApoioMobile() {
  return (
    <div className="mt-14 space-y-8 lg:hidden">
      <div className="relative overflow-hidden rounded-lg bg-charcoal p-6 text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-brand/25 blur-2xl"
        />
        <div className="relative">
          <span className="flex h-10 w-10 items-center justify-center rounded-sm border border-brand/40 bg-brand/15 text-brand-light">
            <Ruler size={18} aria-hidden />
          </span>
          <p className="font-display mt-4 text-titulo-secao">Não sabe seu aro?</p>
          <p className="mt-2 max-w-sm text-apoio leading-relaxed text-white/70">
            Descubra pela tela em menos de dois minutos, usando uma moeda de R$ 1.
          </p>
          <Link
            href="/medidor-de-aliancas"
            className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-full bg-brand px-6 text-apoio font-semibold text-ink transition-colors hover:bg-brand-light"
          >
            Medir agora <ArrowRight size={15} aria-hidden />
          </Link>
        </div>
      </div>

      <div className="border-t border-border pt-6">
        <p className="eyebrow flex items-center gap-1.5">
          <MapPin size={12} aria-hidden /> Experimente na loja
        </p>
        <p className="mt-3 text-apoio leading-relaxed text-muted">
          A JK tem lojas físicas com aro de prova e atendimento presencial.
        </p>
        <Link
          href="/lojas"
          className="alvo-44 mt-3 inline-flex items-center gap-1.5 text-apoio font-semibold text-brand-nav hover:underline"
        >
          Ver as lojas <ArrowRight size={13} aria-hidden />
        </Link>
      </div>
    </div>
  );
}
