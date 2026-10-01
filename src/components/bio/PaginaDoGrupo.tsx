import { fimDoDiaEmSaoPaulo } from "@/lib/bio/agenda";
import { variaveisDoTema } from "@/lib/bio/temas";
import type { Bio } from "@/lib/bio/tipos";
import type { PaginaDoGrupoNoDia } from "@/lib/grupo/montar";
import { SITE } from "@/lib/seo/site";
import { Cabecalho } from "./Blocos";
import { CapturaNaPagina } from "./CapturaNaPagina";
import { Contador } from "./Contador";
import { Enfeites } from "./Enfeites";

/**
 * A página do anúncio do grupo: jkaliancas.com.br/grupo.
 *
 * Uma coisa só para fazer, e por isso uma saída só: o formulário. Não tem
 * vitrine, links nem lojas como a bio, porque cada link a mais numa página de
 * anúncio é gente saindo antes de deixar o contato.
 *
 * Usa as mesmas peças e o mesmo tema da bio. Em outubro sai com a cara do
 * Esquenta, em novembro com a da Black, sem ninguém mexer.
 */
export function PaginaDoGrupo({ dia, cabecalho }: { dia: PaginaDoGrupoNoDia; cabecalho: Bio["cabecalho"] }) {
  const { tema, captura, oferta, fim, codigo } = dia;
  const contaAte = oferta?.contador ? (oferta.contadorAte ?? fim) : null;
  const eyebrow = captura.eyebrow || oferta?.eyebrow || "";

  return (
    <div
      data-tema={tema}
      style={variaveisDoTema(tema)}
      className="bio-pagina relative min-h-dvh overflow-x-clip bg-[var(--bio-fundo)] text-[var(--bio-texto)]"
    >
      <Enfeites tema={tema} />
      <main className="relative z-10 mx-auto max-w-[30rem] px-4 pb-12 pt-8">
        <Cabecalho nome={cabecalho.nome} frase={cabecalho.frase} />

        <section
          aria-labelledby="titulo-do-grupo"
          data-regiao="grupo-oferta"
          className="relative mt-7 overflow-hidden rounded-[24px] border border-[var(--bio-oferta-borda)] bg-[var(--bio-oferta-fundo)] px-5 pb-6 pt-6 text-center"
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 -top-24 mx-auto h-48 w-72 rounded-full bg-[var(--bio-brilho)] blur-3xl"
          />
          <div className="relative">
            {eyebrow ? (
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-[var(--bio-acento)]">{eyebrow}</p>
            ) : null}
            <h2 id="titulo-do-grupo" className="mt-2 text-[1.55rem] font-medium leading-[1.15] tracking-[-0.02em]">
              {captura.titulo}
            </h2>
            {captura.descricao ? (
              <p className="mx-auto mt-2 max-w-[22rem] text-[0.9rem] leading-relaxed text-[var(--bio-apoio)]">
                {captura.descricao}
              </p>
            ) : null}
            {oferta ? (
              <p className="mx-auto mt-4 inline-flex rounded-full bg-[var(--bio-selo)] px-3.5 py-1.5 text-[0.8rem] font-semibold text-[var(--bio-selo-texto)]">
                {oferta.titulo}
              </p>
            ) : null}
            {contaAte && oferta ? <Contador ate={fimDoDiaEmSaoPaulo(contaAte)} rotulo={oferta.rotuloContador} /> : null}
          </div>
        </section>

        <section
          aria-label="Cadastro no grupo de ofertas"
          data-regiao="grupo-formulario"
          className="relative mt-5 rounded-[24px] border border-[var(--bio-linha)] bg-[var(--bio-superficie)] px-5 pb-6 pt-5"
        >
          <CapturaNaPagina bloco={captura} campanha={codigo} />
        </section>

        <footer data-regiao="grupo-rodape" className="mt-8 text-center text-[0.75rem] leading-relaxed text-[var(--bio-apoio)]">
          {cabecalho.nome}, loja oficial:{" "}
          <a
            href={SITE.lojaUrl}
            data-evento="clique_produto"
            data-destino="Loja oficial"
            className="font-semibold text-[var(--bio-texto)] underline-offset-4 hover:underline"
          >
            jkaliancas.com.br
          </a>
        </footer>
      </main>
    </div>
  );
}
