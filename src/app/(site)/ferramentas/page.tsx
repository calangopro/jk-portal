import Link from "next/link";
import { ArrowRight, Smartphone, Ruler, ShieldCheck } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { Trilha } from "@/components/ui/Trilha";
import { JsonLd } from "@/components/schema/JsonLd";
import { SimboloDaFerramenta } from "@/components/ferramentas/Simbolo";
import { itensDeFerramenta } from "@/lib/ferramentas/registro";
import { buildMetadata } from "@/lib/seo/metadata";
import { absoluteUrl } from "@/lib/seo/site";
import { breadcrumbSchema, itemListSchema, webPageSchema } from "@/lib/schema/builders";

export const revalidate = 86400;

export const metadata = buildMetadata({
  title: "Ferramentas para escolher a aliança | JK Alianças",
  description:
    "Medidor de aliança pela tela, conversor entre o tamanho brasileiro, americano e europeu, simulador de largura e comparador de materiais. Feito pela JK Alianças.",
  path: "/ferramentas",
});

const SELOS = [
  { icone: Smartphone, texto: "Feito para o celular" },
  { icone: Ruler, texto: "Medidas reais em milímetros" },
  { icone: ShieldCheck, texto: "Sem cadastro e sem envio de dados" },
];

/**
 * Home das ferramentas.
 *
 * Não é índice de blog com quatro cartões iguais: é a porta de entrada do que
 * mais rende no portal. A abertura é um painel escuro, o mesmo carvão do modo
 * de medição, porque é ali que o dourado da marca finalmente tem contra o que
 * brilhar. Da faixa para baixo a página volta a ser clara e indexável, com a
 * resposta primeiro e `ItemList` para a busca entender a lista.
 *
 * A lista sai de `itensDeFerramenta()`, a mesma que alimenta o menu e o rodapé.
 * O medidor de aliança continua no endereço próprio, `/medidor-de-aliancas`,
 * porque ele já tem histórico de busca e mexer em URL com tráfego é a coisa que
 * o projeto mais evita. Aqui ele entra como a ferramenta principal.
 */
export default function FerramentasPage() {
  const url = absoluteUrl("/ferramentas");
  const itens = itensDeFerramenta();
  const [principal, ...demais] = itens;

  return (
    <main>
      <JsonLd
        data={webPageSchema({
          url,
          name: "Ferramentas para escolher a aliança",
          description:
            "Medidor de aliança pela tela, conversor de tamanhos, simulador de largura e comparador de materiais, feitos pela JK Alianças.",
        })}
      />
      <JsonLd
        data={breadcrumbSchema([
          { name: "Início", url: absoluteUrl("/") },
          { name: "Ferramentas", url },
        ])}
      />
      <JsonLd
        data={itemListSchema(
          itens.map((i) => ({ name: i.nome, url: absoluteUrl(i.href) })),
          "Ferramentas da JK Alianças",
        )}
      />

      <Container size="wide" className="py-8 sm:py-12">
        <Trilha passos={[{ nome: "Início", href: "/" }, { nome: "Ferramentas" }]} />

        {/* Abertura em painel escuro: cara de aplicativo, não de post. */}
        <section className="palco-noite relative mt-5 overflow-hidden rounded-xl px-6 py-8 sm:mt-6 sm:px-12 sm:py-14">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand/25 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-light/70 to-transparent"
          />

          <div className="relative max-w-3xl">
            <p className="eyebrow text-brand-light">Ferramentas JK Alianças</p>
            <h1 className="font-display mt-4 text-titulo-artigo text-[#f6efe4]">
              Descubra o tamanho e a largura da sua aliança
            </h1>
            {/* Resposta primeiro: é o primeiro texto da página e o trecho que
                a IA cita quando alguém pergunta a ela em vez de buscar. */}
            {/* Sem `.linha-apoio` aqui: aquela classe crava a cor de tinta
                sobre marfim, e neste painel o fundo é carvão. */}
            {/* No celular a resposta vem em corpo, não em lede: em serifada
                grande ela virava nove linhas e empurrava as ferramentas para
                fora da primeira tela. O texto é o mesmo, o GEO não muda. */}
            <p className="font-display mt-4 max-w-[52ch] text-corpo font-medium leading-relaxed text-pretty text-[#f3ece1]/85 sm:mt-5 sm:text-lede">
              São quatro ferramentas gratuitas para escolher aliança sem chutar:
              descobrir o número do aro pela tela, converter entre o tamanho
              brasileiro, o americano e o europeu, ver cada largura em tamanho
              real no dedo e comparar os materiais por teor e preço. Todas
              funcionam no celular, na hora, sem cadastro.
            </p>

            <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2.5 sm:mt-8 sm:gap-y-3">
              {SELOS.map((s) => (
                <li
                  key={s.texto}
                  className="flex items-center gap-2 text-nota text-[#f3ece1]/70"
                >
                  <s.icone size={14} aria-hidden className="text-brand-light" />
                  {s.texto}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Painel de ferramentas. A primeira ocupa a linha inteira porque é a
            que a maior parte das pessoas veio buscar. */}
        <div className="mt-6 grid gap-4 sm:mt-8 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
          <CartaoDeFerramenta
            href={principal.href}
            nome={principal.nome}
            chamada={principal.chamada}
            chave={principal.chave}
            destaque
            className="sm:col-span-2 lg:col-span-3"
          />

          {demais.map((f, i) => (
            <CartaoDeFerramenta
              key={f.href}
              href={f.href}
              nome={f.nome}
              chamada={f.chamada}
              chave={f.chave}
              // Sobra ímpar em duas colunas: a última abre a linha toda em vez
              // de deixar um buraco do lado.
              className={
                i === demais.length - 1 && demais.length % 2 === 1
                  ? "sm:col-span-2 lg:col-span-1"
                  : ""
              }
            />
          ))}
        </div>

        {/* Saída para gente de verdade. Ferramenta resolve o número; quem
            quiser experimentar tem loja perto. */}
        <section className="glass-sutil mt-10 rounded-lg px-6 py-7 sm:mt-14 sm:px-9 sm:py-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-xl">
              <h2 className="font-display text-titulo-bloco text-ink">
                Prefere medir na loja?
              </h2>
              <p className="mt-2 text-apoio leading-relaxed text-muted">
                As lojas da JK Alianças têm aro de prova, e você sai com a
                medida certa anotada. As ferramentas continuam aqui para
                conferir depois.
              </p>
            </div>
            <Link
              href="/lojas"
              className="inline-flex min-h-13 shrink-0 items-center justify-center gap-2 rounded-full border border-ink/20 px-6 text-apoio font-semibold text-ink transition-colors hover:border-brand hover:text-brand-nav"
            >
              Ver as lojas
              <ArrowRight size={15} aria-hidden />
            </Link>
          </div>
        </section>
      </Container>
    </main>
  );
}

/**
 * Cartão de ferramenta.
 *
 * O emblema aparece duas vezes de propósito: pequeno e nítido no topo, e
 * gigante e quase invisível no canto, como marca d'água. É o que dá a cada
 * cartão uma silhueta própria sem precisar de foto, que aqui seria enfeite.
 */
function CartaoDeFerramenta({
  href,
  nome,
  chamada,
  chave,
  destaque = false,
  className = "",
}: {
  href: string;
  nome: string;
  chamada: string;
  chave: string;
  destaque?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`glass-card group relative flex min-h-40 flex-col overflow-hidden rounded-lg p-6 sm:p-7 ${className}`}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-10 -right-8 text-brand/12 transition-transform duration-[700ms] ease-[cubic-bezier(0.2,0.75,0.25,1)] group-hover:-translate-y-1 group-hover:rotate-6"
      >
        <SimboloDaFerramenta
          chave={chave}
          strokeWidth={1}
          className={destaque ? "h-56 w-56" : "h-40 w-40"}
        />
      </span>

      <span className="relative flex h-12 w-12 items-center justify-center rounded-sm border border-brand/30 bg-brand/12 text-brand-nav transition-colors duration-300 group-hover:border-brand/60 group-hover:bg-brand/20">
        <SimboloDaFerramenta chave={chave} className="h-6 w-6" />
      </span>

      <h2
        className={`font-display relative mt-5 text-ink ${
          destaque ? "text-titulo-secao" : "text-titulo-bloco"
        }`}
      >
        {nome}
      </h2>
      <p
        className={`relative mt-2 leading-relaxed text-muted ${
          destaque ? "max-w-lg text-corpo" : "text-apoio"
        }`}
      >
        {chamada}
      </p>

      <span className="relative mt-auto pt-6">
        <span className="inline-flex items-center gap-1.5 text-apoio font-semibold text-brand-nav">
          Abrir ferramenta
          <ArrowRight
            size={15}
            aria-hidden
            className="transition-transform duration-300 group-hover:translate-x-1"
          />
        </span>
      </span>
    </Link>
  );
}
