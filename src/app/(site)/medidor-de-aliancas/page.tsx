import type { Metadata } from "next";
import Link from "next/link";
import { Coins, Hand, Ruler, Eye, Smartphone } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { JsonLd } from "@/components/schema/JsonLd";
import { ShareButtons } from "@/components/ui/ShareButtons";
import { Trilha } from "@/components/ui/Trilha";
import { Pill } from "@/components/ui/Pill";
import { FaqLista } from "@/components/ui/FaqLista";
import { Medidor } from "@/components/medidor/Medidor";
import { breadcrumbSchema, faqPageSchema, howToSchema } from "@/lib/schema/builders";
import { buildMetadata } from "@/lib/seo/metadata";
import { absoluteUrl } from "@/lib/seo/site";

export const metadata: Metadata = buildMetadata({
  title: "Medidor de aliança online: descubra seu tamanho | JK Alianças",
  description:
    "Descubra o tamanho da sua aliança pela tela do celular ou do computador. Calibre com uma moeda de R$ 1 ou um cartão, apoie a aliança e veja o número na hora.",
  path: "/medidor-de-aliancas",
  type: "website",
});

export const revalidate = 86400;

const FAQS = [
  {
    question: "O medidor online é confiável?",
    answer:
      "Sim, desde que a calibração seja feita com cuidado. A tela de cada aparelho mostra o mesmo desenho num tamanho diferente, então o site usa um objeto de medida conhecida, a moeda de R$ 1 ou um cartão, para descobrir a escala real. Feita a calibração, a medida sai em milímetros de verdade.",
  },
  {
    question: "Por que preciso calibrar a tela antes de medir?",
    answer:
      "Porque nenhuma informação que o navegador entrega corresponde ao tamanho físico da tela. Resolução, densidade de pixels e zoom mudam de aparelho para aparelho. A calibração é a única referência confiável.",
  },
  {
    question: "Minha medida ficou entre dois aros. Qual escolher?",
    answer:
      "Escolha o maior. A aliança precisa passar pela junta do dedo, que é mais larga que a base. Ficar apertado incomoda e dificulta tirar.",
  },
  {
    question: "Qual a melhor hora do dia para medir o dedo?",
    answer:
      "No fim do dia, quando o dedo está mais dilatado por causa do calor e da atividade. Medir de manhã, com o corpo frio, costuma dar um aro menor que o ideal.",
  },
  {
    question: "Como converter o aro para milímetros?",
    answer:
      "No padrão brasileiro, a circunferência interna em milímetros é o número do aro mais 40. O aro 18, por exemplo, tem 58 mm de circunferência e 18,46 mm de diâmetro interno.",
  },
];

const PASSOS = [
  {
    nome: "Calibre a tela",
    texto:
      "Escolha a moeda de R$ 1, que tem 27 mm, ou um cartão de banco, que tem 85,60 mm de largura. Ajuste o desenho na tela até ficar do tamanho exato do objeto real, encostado no vidro.",
    icone: Coins,
  },
  {
    nome: "Deite a aliança em cima da tela",
    texto:
      "A aliança fica deitada sobre a tela, com o círculo dourado por dentro dela. Olhe de frente, sem inclinar a cabeça, para não distorcer a leitura.",
    icone: Ruler,
  },
  {
    nome: "Aumente o dourado até ele tocar a aliança",
    texto:
      "Arraste o círculo dourado, ou pince com dois dedos, até ele encostar na aliança por todos os lados. O número do aro aparece na hora, junto do diâmetro e da circunferência em milímetros.",
    icone: Hand,
  },
];

const CUIDADOS = [
  {
    icone: Ruler,
    texto:
      "Apoie a aliança direto na tela, deitada sobre o desenho, sem capinha nem película grossa.",
  },
  {
    icone: Eye,
    texto: "Olhe de frente, sem inclinar a cabeça, porque de lado o círculo engana.",
  },
  {
    icone: Smartphone,
    texto: "Trocou de aparelho ou mexeu no zoom do navegador? Calibre de novo.",
  },
];

export default function MedidorPage() {
  return (
    <main>
      <JsonLd
        data={howToSchema({
          nome: "Como descobrir o tamanho da aliança pela tela",
          descricao:
            "Passo a passo para medir o tamanho da aliança usando a tela do celular ou do computador, com calibração por moeda ou cartão.",
          tempoTotal: "PT2M",
          materiais: [
            "Uma aliança ou anel que sirva no dedo",
            "Moeda de R$ 1 ou cartão de banco",
          ],
          passos: PASSOS.map((p) => ({ nome: p.nome, texto: p.texto })),
        })}
      />
      <JsonLd data={faqPageSchema(FAQS)} />
      <JsonLd
        data={breadcrumbSchema([
          { name: "Início", url: absoluteUrl("/") },
          { name: "Medidor de aliança", url: absoluteUrl("/medidor-de-aliancas") },
        ])}
      />

      {/* Uma coluna só, centrada, para a página inteira. O Container é de
          72 rem e todo o conteúdo cabe em 56 rem, mas sem `mx-auto` esses
          56 rem encostavam na esquerda e sobravam 16 rem mortos na direita,
          o que lê como desalinhamento mesmo sem ninguém saber nomear. */}
      <Container size="wide" className="py-12 sm:py-16">
        <div className="mx-auto max-w-4xl">
          <Trilha
            passos={[
              { nome: "Início", href: "/" },
              { nome: "Medidor de aliança" },
            ]}
            className="mb-7"
          />

          <div className="mb-5">
            <Pill>Ferramenta</Pill>
          </div>

          <h1 className="font-display max-w-[17ch] text-titulo-artigo text-ink">
            Descubra o tamanho da sua aliança pela tela
          </h1>

          {/* Resposta direta, primeiro texto da página, como manda a regra de
              GEO. Aqui ela é a linha de apoio do artigo, não uma caixa
              plantada em cima do conteúdo. */}
          <p className="linha-apoio mt-6 max-w-[48ch] text-lede">
            Para descobrir o tamanho pela tela, calibre com uma moeda de R$ 1,
            que mede 27 mm, ou um cartão de banco, que mede 85,60 mm. Depois
            deite a aliança em cima da tela, com o círculo dourado por dentro
            dela, e aumente o dourado até ele tocar a aliança. O número do aro
            aparece na hora, junto do diâmetro em milímetros.
          </p>

          <div aria-hidden className="filete-dourado mt-7" />
        </div>

        {/* A ferramenta em si. Ela também renderiza a tabela de aros, para o
            resultado medido aparecer destacado lá. */}
        <div className="mx-auto mt-10 max-w-4xl space-y-16">
          <Medidor>
            <section aria-labelledby="como-funciona">
              <h2
                id="como-funciona"
                className="font-display text-titulo-secao text-ink"
              >
                Como funciona
              </h2>
              <ol className="mt-7 grid gap-6 sm:grid-cols-3">
                {PASSOS.map((p, i) => (
                  <li key={p.nome} className="glass-sutil rounded-lg p-5">
                    <span className="flex h-10 w-10 items-center justify-center rounded-sm border border-brand/30 bg-brand/10 text-brand-nav">
                      <p.icone size={18} aria-hidden />
                    </span>
                    <p className="mt-4 flex items-baseline gap-2 font-semibold text-ink">
                      <span className="numeros text-nota text-brand-nav">
                        {i + 1}
                      </span>
                      {p.nome}
                    </p>
                    <p className="mt-2 text-apoio leading-relaxed text-muted">
                      {p.texto}
                    </p>
                  </li>
                ))}
              </ol>
            </section>
          </Medidor>

          <section>
            <h2 className="font-display text-titulo-secao text-ink">
              Para a medida sair certa
            </h2>
            <ul className="mt-6 space-y-4">
              {CUIDADOS.map((c) => (
                <li key={c.texto} className="flex gap-3 text-apoio leading-relaxed text-muted">
                  <c.icone size={16} aria-hidden className="mt-1 shrink-0 text-brand-nav" />
                  {c.texto}
                </li>
              ))}
            </ul>
          </section>

          {/* Link de saída para a ferramenta irmã. Quem acabou de descobrir o
              aro costuma ter a pergunta seguinte na mão: quanto isso dá lá
              fora, quando o anel veio de viagem ou de uma loja gringa. */}
          <section className="border-t border-border pt-8">
            <h2 className="font-display text-titulo-secao text-ink">
              Já tem o número em outra escala?
            </h2>
            <p className="mt-3 max-w-2xl text-muted">
              Se você sabe o tamanho americano, o europeu, a circunferência ou o
              diâmetro, não precisa medir de novo.{" "}
              <Link
                href="/ferramentas/conversor-de-aros"
                className="font-semibold text-brand-nav hover:underline"
              >
                O conversor traduz para o aro brasileiro
              </Link>
              , com a tabela completa do aro 7 ao 35.
            </p>
          </section>

          <FaqLista faqs={FAQS} />

          <section className="border-t border-border pt-8">
            <div className="flex flex-wrap items-center justify-between gap-5">
              <p className="max-w-md text-apoio leading-relaxed text-muted">
                Prefere medir na loja? A JK Alianças tem{" "}
                <Link href="/lojas" className="font-semibold text-brand-nav hover:underline">
                  lojas físicas
                </Link>{" "}
                com aro de prova, e você sai com a medida certa.
              </p>
              <ShareButtons title="Medidor de aliança da JK Alianças" />
            </div>
          </section>
        </div>
      </Container>
    </main>
  );
}
