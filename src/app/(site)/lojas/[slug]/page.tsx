import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  MapPin, Phone, Clock, MessageCircle, Navigation, Building2,
  CalendarDays, Star, Info,
} from "lucide-react";
import { Container } from "@/components/layout/Container";
import { ShareButtons } from "@/components/ui/ShareButtons";
import { Trilha } from "@/components/ui/Trilha";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { FaqLista } from "@/components/ui/FaqLista";
import { MapaDaLoja } from "@/components/lojas/MapaDaLoja";
import { GaleriaLoja } from "@/components/lojas/GaleriaLoja";
import { JsonLd } from "@/components/schema/JsonLd";
import { breadcrumbSchema, faqPageSchema, jewelryStoreSchema } from "@/lib/schema/builders";
import { lojaMetadata } from "@/lib/seo/metadata";
import { absoluteUrl, SITE, isProduction } from "@/lib/seo/site";
import { getLocationBySlug, getPublishedLocations, comFotos } from "@/lib/data/locations";
import { linkDoMaps, linkDoWaze, linkDoWhatsapp, linkDeTelefone, telefoneLegivel } from "@/lib/data/rotas";
import { dataLonga } from "@/lib/content/leitura";
import { INSTITUCIONAL, PROVAS_DA_MARCA, anosDeMercado, FONTE_SOBRE } from "@/lib/content/institucional";
import type { Location } from "@/lib/content/types";

export const revalidate = 3600;
export const dynamicParams = true;

const DIAS: Record<string, string> = {
  Monday: "Segunda",
  Tuesday: "Terça",
  Wednesday: "Quarta",
  Thursday: "Quinta",
  Friday: "Sexta",
  Saturday: "Sábado",
  Sunday: "Domingo",
};

const ORDEM_DOS_DIAS = [
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
];

/**
 * Horário por dia, sempre com os sete dias na tela.
 *
 * Mostrar só os dias abertos obriga a pessoa a deduzir o resto, e a dedução
 * errada custa uma viagem perdida. Dia sem horário aparece como "Fechado".
 */
function horarioPorDia(loja: Location) {
  const mapa = new Map<string, string>();
  for (const faixa of loja.openingHours ?? []) {
    for (const dia of faixa.dayOfWeek) {
      mapa.set(dia, `${faixa.opens} às ${faixa.closes}`);
    }
  }
  return ORDEM_DOS_DIAS.map((dia) => ({
    dia,
    rotulo: DIAS[dia] ?? dia,
    horario: mapa.get(dia) ?? null,
  }));
}

/** FAQ da unidade: o que a redação escreveu, mais o que dá para responder com dado real. */
function faqsDaLoja(loja: Location) {
  const cadastradas = loja.faqs ?? [];
  const automaticas: { question: string; answer: string }[] = [];

  const cidade = loja.addressLocality ?? "São Paulo";

  if (loja.openingHours?.length) {
    const linhas = horarioPorDia(loja)
      .map((d) => `${d.rotulo}: ${d.horario ?? "fechado"}`)
      .join("; ");
    automaticas.push({
      question: `Qual o horário da JK Alianças ${loja.name}?`,
      answer: `${linhas}. O horário segue o do ${loja.mallName ?? "shopping"} e pode mudar em feriado, então vale conferir no Google antes de sair de casa.`,
    });
  }

  automaticas.push({
    question: `Onde fica a JK Alianças ${loja.name}?`,
    answer: `A unidade fica em ${loja.address}${loja.addressLocality ? `, ${loja.addressLocality}` : ""}${loja.addressRegion ? `, ${loja.addressRegion}` : ""}${loja.postalCode ? `, CEP ${loja.postalCode}` : ""}. A página tem botão de rota pelo Google Maps e pelo Waze.`,
  });

  automaticas.push({
    question: `Dá para provar o aro na loja ${loja.name}?`,
    answer: `Sim. A unidade tem aro de prova para você medir o dedo no atendimento presencial. Se preferir chegar já com uma ideia do número, aqui no site tem um medidor de aliança que funciona pela tela.`,
  });

  return [...cadastradas, ...automaticas];
}

export async function generateStaticParams() {
  const lojas = await getPublishedLocations();
  return lojas.map((l) => ({ slug: l.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const loja = await getLocationBySlug((await params).slug);
  if (!loja) {
    return {
      title: "Página não encontrada",
      // `follow: true` de propósito. Numa 404 o Google deve continuar seguindo
      // os links da página (cabeçalho, rodapé, saídas). `nofollow` cortava a
      // descoberta do resto do site a partir de um endereço quebrado.
      robots: { index: false, follow: true },
    };
  }
  return lojaMetadata(loja);
}

export default async function LojaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const bruta = await getLocationBySlug((await params).slug);
  if (!bruta) notFound();

  const [loja] = await comFotos([bruta]);
  const fotos = loja.fotos ?? [];
  const faqs = faqsDaLoja(loja);
  const horarios = horarioPorDia(loja);
  const temHorario = Boolean(loja.openingHours?.length);

  const outras = (await getPublishedLocations())
    .filter((l) => l.slug !== loja.slug)
    .sort((a, a2) => {
      // Mesma cidade primeiro: é a loja alternativa que interessa a quem
      // abriu esta página e achou longe.
      const mesma = (l: Location) => (l.addressLocality === loja.addressLocality ? 0 : 1);
      return mesma(a) - mesma(a2);
    })
    .slice(0, 3);

  const maps = linkDoMaps(loja);
  const waze = linkDoWaze(loja);
  const whats = linkDoWhatsapp(loja);
  const tel = linkDeTelefone(loja);
  const telTexto = telefoneLegivel(loja.phone ?? loja.whatsapp);
  const abertura = dataLonga(loja.openedAt);

  return (
    <main>
      <JsonLd data={jewelryStoreSchema(loja)} />
      <JsonLd
        data={breadcrumbSchema([
          { name: "Início", url: absoluteUrl("/") },
          { name: "Lojas", url: absoluteUrl("/lojas") },
          { name: loja.name, url: absoluteUrl(`/lojas/${loja.slug}`) },
        ])}
      />
      {faqs.length ? <JsonLd data={faqPageSchema(faqs)} /> : null}

      <Container size="wide" className="py-12 sm:py-16">
        {/* ------------------------------------------------------ cabeçalho */}
        <header className="max-w-3xl">
          <Trilha
            passos={[
              { nome: "Início", href: "/" },
              { nome: "Lojas", href: "/lojas" },
              { nome: loja.name },
            ]}
            className="mb-7"
          />

          <div className="mb-5 flex flex-wrap gap-2">
            <Pill icone={<Building2 size={12} aria-hidden />}>
              {loja.mallName ?? "Loja física"}
            </Pill>
            {loja.addressLocality ? (
              <Pill tom="neutro">
                {loja.addressLocality}
                {loja.addressRegion ? `, ${loja.addressRegion}` : ""}
              </Pill>
            ) : null}
          </div>

          <h1 className="font-display max-w-[18ch] text-titulo-artigo text-ink">
            JK Alianças {loja.name}
          </h1>

          <p className="linha-apoio mt-6 max-w-[52ch] text-lede">
            {loja.address}
            {loja.addressLocality ? `, ${loja.addressLocality}` : ""}
            {loja.addressRegion ? `, ${loja.addressRegion}` : ""}.
            {loja.unitLabel ? ` ${loja.unitLabel}.` : ""}
          </p>

          <div aria-hidden className="filete-dourado mt-7" />

          {/* Ações principais. Só aparece o que existe de verdade no cadastro. */}
          <div className="mt-7 flex flex-wrap gap-3">
            <Button
              href={maps}
              externo
              icone={<MapPin size={16} />}
              data-evento="clique_rota"
              data-destino={loja.slug}
            >
              Como chegar
            </Button>
            <Button
              href={waze}
              externo
              variant="outline"
              icone={<Navigation size={16} />}
              data-evento="clique_waze"
              data-destino={loja.slug}
            >
              Abrir no Waze
            </Button>
            {whats ? (
              <Button
                href={whats}
                externo
                variant="outline"
                icone={<MessageCircle size={16} />}
                data-evento="clique_whatsapp"
                data-destino={loja.slug}
              >
                Falar no WhatsApp
              </Button>
            ) : null}
          </div>
        </header>

        {/* -------------------------------------------------------- galeria */}
        <section aria-label={`Fotos da loja ${loja.name}`} className="mt-12">
          <GaleriaLoja
            fotos={fotos}
            nomeDaLoja={loja.name}
            mostrarVazio={!isProduction()}
          />
        </section>

        {/* ------------------------------------------ dados, horário, mapa */}
        <div className="mt-12 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0 space-y-12">
            {/* Horário */}
            <section aria-labelledby="horario">
              <h2 id="horario" className="font-display text-titulo-secao text-ink">
                Horário de funcionamento
              </h2>

              {temHorario ? (
                <>
                  <dl className="mt-6 max-w-md divide-y divide-border rounded-lg border border-border bg-white/50">
                    {horarios.map((d) => (
                      <div
                        key={d.dia}
                        className="flex items-baseline justify-between gap-4 px-5 py-3"
                      >
                        <dt className="text-apoio text-muted">{d.rotulo}</dt>
                        <dd
                          className={`numeros text-apoio ${
                            d.horario ? "font-semibold text-ink" : "text-muted"
                          }`}
                        >
                          {d.horario ?? "Fechado"}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  {loja.hoursSource ? (
                    <p className="mt-3 max-w-md text-nota leading-relaxed text-muted">
                      Fonte: {loja.hoursSource}. Feriado pode ter horário
                      diferente, então vale confirmar no Google antes de sair.
                    </p>
                  ) : null}
                </>
              ) : (
                <div className="mt-6 flex max-w-md items-start gap-3 rounded-lg border border-brand/25 bg-brand/6 px-5 py-4">
                  <Info size={16} aria-hidden className="mt-0.5 shrink-0 text-brand-nav" />
                  <p className="text-apoio leading-relaxed text-muted">
                    O horário desta unidade ainda não foi confirmado com a loja.
                    Em vez de publicar um palpite, deixamos o caminho certo:{" "}
                    <a
                      href={maps}
                      target="_blank"
                      rel="noopener"
                      className="font-semibold text-brand-nav hover:underline"
                    >
                      confira o horário atualizado no Google
                    </a>
                    .
                  </p>
                </div>
              )}

              {loja.hoursNote ? (
                <p className="mt-3 max-w-md text-nota leading-relaxed text-muted">
                  {loja.hoursNote}
                </p>
              ) : null}
            </section>

            {/* História da unidade, quando a redação escreveu */}
            {loja.about || abertura ? (
              <section aria-labelledby="sobre-a-loja">
                <h2 id="sobre-a-loja" className="font-display text-titulo-secao text-ink">
                  Sobre esta loja
                </h2>
                {abertura ? (
                  <p className="mt-4 flex items-center gap-2 text-apoio text-muted">
                    <CalendarDays size={14} aria-hidden className="text-brand-nav" />
                    Inaugurada em{" "}
                    <time dateTime={loja.openedAt ?? undefined} className="font-semibold text-ink">
                      {abertura}
                    </time>
                  </p>
                ) : null}
                {loja.about ? (
                  <div className="conteudo-rico mt-5 max-w-leitura">
                    {loja.about.split("\n\n").map((p, i) => (
                      <p key={i}>{p}</p>
                    ))}
                  </div>
                ) : null}
              </section>
            ) : null}

            {/* Serviços e diferenciais */}
            {loja.services?.length || loja.highlights?.length ? (
              <section aria-labelledby="servicos">
                <h2 id="servicos" className="font-display text-titulo-secao text-ink">
                  O que você encontra aqui
                </h2>
                {loja.services?.length ? (
                  <ul className="mt-6 flex flex-wrap gap-2.5">
                    {loja.services.map((s) => (
                      <li key={s}>
                        <Pill tom="neutro">{s}</Pill>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {loja.highlights?.length ? (
                  <ul className="mt-6 space-y-3">
                    {loja.highlights.map((h) => (
                      <li key={h} className="flex gap-3 text-apoio leading-relaxed text-muted">
                        <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                        {h}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ) : null}

            {/* A marca por trás da unidade. Fatos da própria JK, com a fonte. */}
            <section aria-labelledby="a-marca">
              <h2 id="a-marca" className="font-display text-titulo-secao text-ink">
                A JK Alianças por trás desta loja
              </h2>
              <p className="mt-4 max-w-leitura leading-relaxed text-muted">
                A JK Alianças começou em {INSTITUCIONAL.fundadaEmTexto}, o que dá{" "}
                {anosDeMercado()} anos de mercado, e hoje mantém{" "}
                {INSTITUCIONAL.lojasFisicas} unidades físicas em São Paulo e na
                Grande São Paulo, com fábrica própria por trás de cada peça.
              </p>
              <ul className="mt-7 grid gap-5 sm:grid-cols-3">
                {PROVAS_DA_MARCA.map((p) => (
                  <li key={p.titulo} className="glass-sutil rounded-lg p-5">
                    <p className="font-display text-titulo-bloco text-brand-strong">
                      {p.titulo}
                    </p>
                    <p className="mt-2 text-apoio leading-relaxed text-muted">
                      {p.texto}
                    </p>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-nota text-muted">
                Informações declaradas pela própria marca em{" "}
                <a
                  href={FONTE_SOBRE}
                  target="_blank"
                  rel="noopener"
                  className="text-brand-nav hover:underline"
                >
                  jkaliancas.com.br/sobre-nos
                </a>
                .
              </p>
            </section>

            <FaqLista faqs={faqs} titulo="Perguntas sobre esta loja" className="max-w-leitura-larga" />
          </div>

          {/* ------------------------------------------------------ lateral */}
          <aside className="min-w-0 space-y-6 lg:sticky lg:top-24 lg:h-fit">
            <MapaDaLoja loja={loja} />

            <div className="glass-sutil rounded-lg p-5">
              <p className="eyebrow flex items-center gap-1.5">
                <MapPin size={12} aria-hidden /> Endereço
              </p>
              <address className="mt-3 not-italic leading-relaxed text-ink">
                {loja.address}
                <br />
                {[loja.addressLocality, loja.addressRegion].filter(Boolean).join(", ")}
                {loja.postalCode ? (
                  <>
                    <br />
                    CEP {loja.postalCode}
                  </>
                ) : null}
              </address>
              {loja.unitLabel ? (
                <p className="mt-2 text-apoio text-muted">{loja.unitLabel}</p>
              ) : null}

              <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
                {tel && telTexto ? (
                  <a
                    href={tel}
                    data-evento="clique_telefone"
                    data-destino={loja.slug}
                    className="inline-flex items-center gap-2 text-apoio font-semibold text-brand-nav hover:underline"
                  >
                    <Phone size={14} aria-hidden /> {telTexto}
                  </a>
                ) : null}
                {whats ? (
                  <a
                    href={whats}
                    target="_blank"
                    rel="noopener"
                    data-evento="clique_whatsapp"
                    data-destino={loja.slug}
                    className="inline-flex items-center gap-2 text-apoio font-semibold text-brand-nav hover:underline"
                  >
                    <MessageCircle size={14} aria-hidden />
                    {telefoneLegivel(loja.whatsapp) ?? "WhatsApp da loja"}
                  </a>
                ) : null}
              </div>

              <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
                <a
                  href={maps}
                  target="_blank"
                  rel="noopener"
                  data-evento="clique_rota"
                  data-destino={loja.slug}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-ink/20 px-4 text-nota font-semibold text-ink transition-colors hover:border-brand hover:text-brand-nav"
                >
                  <MapPin size={13} aria-hidden /> Google Maps
                </a>
                <a
                  href={waze}
                  target="_blank"
                  rel="noopener"
                  data-evento="clique_waze"
                  data-destino={loja.slug}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-ink/20 px-4 text-nota font-semibold text-ink transition-colors hover:border-brand hover:text-brand-nav"
                >
                  <Navigation size={13} aria-hidden /> Waze
                </a>
              </div>
            </div>

            {/* Avaliações: o bloco só existe com nota real e origem registrada. */}
            {loja.avaliacoes ? (
              <div className="glass-sutil rounded-lg p-5">
                <p className="eyebrow flex items-center gap-1.5">
                  <Star size={12} aria-hidden /> Avaliações
                </p>
                <p className="numeros font-display mt-3 flex items-baseline gap-2 text-display leading-none text-ink">
                  {loja.avaliacoes.nota.toFixed(1).replace(".", ",")}
                  <span className="text-apoio font-sans font-normal text-muted">de 5</span>
                </p>
                <p className="numeros mt-2 text-apoio text-muted">
                  {loja.avaliacoes.quantidade.toLocaleString("pt-BR")} avaliações
                </p>
                <p className="mt-3 text-nota leading-relaxed text-muted">
                  Fonte: {loja.avaliacoes.fonte}
                  {loja.avaliacoes.conferidoEm
                    ? `, conferido em ${dataLonga(loja.avaliacoes.conferidoEm)}`
                    : ""}
                  .
                </p>
              </div>
            ) : null}

            <div className="rounded-lg bg-charcoal p-5 text-white">
              <p className="font-display text-titulo-bloco">Já sabe seu aro?</p>
              <p className="mt-2 text-apoio leading-relaxed text-white/70">
                Chegue na loja com a medida na mão. O medidor funciona pela tela,
                em dois minutos.
              </p>
              <Link
                href="/medidor-de-aliancas"
                className="mt-4 inline-flex min-h-10 items-center gap-1.5 rounded-full bg-brand px-4 text-nota font-semibold text-ink transition-colors hover:bg-brand-light"
              >
                Medir meu aro
              </Link>
            </div>
          </aside>
        </div>

        {/* --------------------------------------------------- outras lojas */}
        {outras.length > 0 ? (
          <section aria-labelledby="outras-lojas" className="mt-16">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-3">
              <h2 id="outras-lojas" className="font-display min-w-0 break-words text-titulo-secao text-ink">
                Outras lojas JK
              </h2>
              <div className="flex min-w-32 flex-1 items-baseline gap-4">
                <span aria-hidden className="hairline flex-1" />
                <Link
                  href="/lojas"
                  className="alvo-44 shrink-0 text-apoio font-semibold text-brand-nav hover:underline"
                >
                  Ver todas
                </Link>
              </div>
            </div>
            <ul className="mt-7 grid gap-5 sm:grid-cols-3">
              {outras.map((l) => (
                <li key={l.id}>
                  <Link
                    href={`/lojas/${l.slug}`}
                    className="glass-card group flex h-full flex-col rounded-lg p-5"
                  >
                    <p className="eyebrow text-[0.66rem]">
                      {l.addressLocality}
                      {l.addressRegion ? `, ${l.addressRegion}` : ""}
                    </p>
                    <p className="font-display mt-2 text-titulo-bloco text-ink">
                      {l.name}
                    </p>
                    <p className="mt-2 text-nota leading-relaxed text-muted">
                      {l.address}
                    </p>
                    <span className="mt-auto pt-4 text-apoio font-semibold text-brand-nav">
                      Ver a loja{" "}
                      <span aria-hidden className="inline-block transition-transform duration-300 group-hover:translate-x-1">
                        &rarr;
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="mt-14 border-t border-border pt-7">
          <div className="flex flex-wrap items-center justify-between gap-5">
            <p className="max-w-md text-apoio leading-relaxed text-muted">
              Preço, estoque e compra ficam na{" "}
              <a
                href={`${SITE.lojaUrl}?utm_source=portal&utm_medium=loja&utm_content=${loja.slug}`}
                target="_blank"
                rel="noopener"
                data-evento="clique_produto"
                data-destino={loja.slug}
                className="font-semibold text-brand-nav hover:underline"
              >
                loja oficial da JK
              </a>
              . Aqui é conteúdo.
            </p>
            <ShareButtons title={`JK Alianças ${loja.name}`} />
          </div>
        </div>
      </Container>
    </main>
  );
}
