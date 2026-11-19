import Link from "next/link";
import { Megaphone, MousePointerClick, Receipt, Target } from "lucide-react";
import { coberturaDaLista, pagosPelaBio, type ChegadasPelaBio, type PedidoComOrigem } from "@/lib/origem/pedidos";
import { diaCurto, type ChaveDePeriodo } from "@/lib/vendas/periodo";
import { Cartao, Dinheiro } from "../../Pecas";
import { SeletorDePeriodo } from "../../SeletorDePeriodo";
import { ListaDeOrigem } from "./Lista";
import { ConversasDaKommo } from "./ConversasDaKommo";
import type { NegociosPorOrigem } from "@/lib/kommo/origem";

/**
 * Origem dos pedidos: de qual anúncio veio cada venda, com as UTMs à vista.
 *
 * A ORDEM É A DA PERGUNTA. Em cima, quanto do que foi pago o painel consegue
 * ligar a um anúncio. Embaixo, a lista, que se vira em cinco: por anúncio, por
 * conjunto, por campanha, pela UTM como ela chegou e pedido a pedido. Clicar
 * num pedido abre a gaveta dele, com todas as chegadas do visitante.
 *
 * O número de cima NÃO é a venda que a plataforma diz ter feito: é o pedido
 * pago da loja cuja última chegada (que não seja acesso direto, até trinta
 * dias antes) foi por aquele anúncio.
 */

const COMECO_DO_COLETOR = "2026-11-13";
const inteiro = (n: number) => n.toLocaleString("pt-BR");

/**
 * O link da bio em dois: quem veio de anúncio e quem não veio.
 *
 * São chegadas, não pedidos, porque a pergunta é sobre o link ("a bio traz
 * gente de anúncio?") e pedido pela bio é pouco para responder. O Instagram
 * etiqueta todo clique no link do perfil igual, então a separação é feita pelo
 * site: é de anúncio a chegada de quem clicou num anúncio até sete dias antes.
 */
function LinkDaBio({ bio, pedidos }: { bio: ChegadasPelaBio; pedidos: PedidoComOrigem[] }) {
  const parte = (n: number) => (bio.chegadas > 0 ? `${Math.round((n / bio.chegadas) * 100)}% das chegadas` : "sem chegada no período");
  const pagos = pagosPelaBio(pedidos);
  const numeros: { rotulo: string; valor: number; apoio: string }[] = [
    { rotulo: "Chegadas pelo link", valor: bio.chegadas, apoio: `${inteiro(bio.visitantes)} ${bio.visitantes === 1 ? "visitante" : "visitantes"}` },
    {
      rotulo: "De quem veio de anúncio",
      valor: bio.deAnuncio,
      apoio: `${parte(bio.deAnuncio)}, ${inteiro(bio.visitantesDeAnuncio)} ${bio.visitantesDeAnuncio === 1 ? "visitante" : "visitantes"}`,
    },
    { rotulo: "Sem anúncio antes", valor: bio.semAnuncio, apoio: parte(bio.semAnuncio) },
  ];
  const comNome = bio.porCampanha.filter((c) => c.campanha);
  return (
    <section aria-label="Link da bio" className="glass mt-3 rounded-[18px] p-4 sm:p-5">
      <p className="eyebrow">Link da bio</p>
      <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-3">
        {numeros.map((n) => (
          <div key={n.rotulo} className="min-w-0">
            <dt className="text-xs font-semibold text-muted">{n.rotulo}</dt>
            <dd className="numeros mt-1 text-2xl font-semibold text-ink">{inteiro(n.valor)}</dd>
            <dd className="mt-0.5 text-xs text-muted">{n.apoio}</dd>
          </div>
        ))}
      </dl>
      {comNome.length > 0 ? (
        <div className="mt-4 border-t border-ink/[0.06] pt-3">
          <p className="text-xs font-semibold text-ink">De quais anúncios essas pessoas vieram</p>
          <ul className="mt-1.5 space-y-1 text-xs leading-snug text-muted">
            {comNome.map((c) => (
              <li key={c.campanha} className="flex gap-2">
                <span className="min-w-0 flex-1 text-ink [overflow-wrap:anywhere]">{c.campanha}</span>
                <span className="numeros shrink-0">
                  {inteiro(c.chegadas)} {c.chegadas === 1 ? "chegada" : "chegadas"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="mt-4 max-w-3xl text-xs leading-relaxed text-muted">
        Pedidos pagos pelo link da bio no período: {inteiro(pagos.deAnuncio)} de quem veio de anúncio e {inteiro(pagos.semAnuncio)} sem
        anúncio antes. O Instagram manda todo clique no link do perfil com a mesma etiqueta, então quem separa é o site: conta como
        de anúncio a chegada de quem clicou num anúncio até sete dias antes, e ela fica com as UTMs do anúncio e <code>_bio</code> no
        fim da mídia. Anúncio que leva a pessoa para o perfil do Instagram, e não para o site, não deixa esse rastro: ela aparece
        como sem anúncio.
      </p>
    </section>
  );
}

export function TelaDeOrigem({
  pedidos, bio = null, kommo = null, de, ate, chave, busca = "", aba = "anuncio", soPagos = true,
}: {
  /** Os negócios da Kommo por origem. `null` quando a leitura falhou: o bloco avisa e o resto continua. */
  kommo?: NegociosPorOrigem | null;
  pedidos: PedidoComOrigem[] | null;
  /** `null` quando a leitura falhou: o bloco some e o resto da tela continua. */
  bio?: ChegadasPelaBio | null;
  de: string;
  ate: string;
  chave: ChaveDePeriodo;
  busca?: string;
  aba?: "anuncio" | "conjunto" | "campanha" | "utm" | "pedido";
  soPagos?: boolean;
}) {
  const lista = pedidos ?? [];
  const c = coberturaDaLista(lista);
  const antesDoColetor = de < COMECO_DO_COLETOR;
  const fatia = (n: number) => (c.pagos > 0 ? `${Math.round((n / c.pagos) * 100)}% dos pagos` : "nenhum pedido pago no período");

  return (
    <div data-painel-largo>
      <header>
        <p className="eyebrow">Tráfego</p>
        <h1 className="font-display mt-2 text-3xl text-ink sm:text-4xl">Origem dos pedidos</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted sm:text-base">
          De qual campanha, conjunto e anúncio veio cada pedido da loja, com as UTMs como chegaram. A ligação é feita pelo
          número da campanha e pelo nome do conjunto e do anúncio que os anúncios mandam na UTM.
        </p>
      </header>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted">
          De {diaCurto(de)} a {diaCurto(ate)}.{" "}
          <Link href="/admin/trafego/campanhas" className="font-semibold text-brand-nav hover:underline">
            Ver gasto e veredito de cada anúncio
          </Link>
        </p>
        <SeletorDePeriodo atual={chave} />
      </div>

      {pedidos === null ? (
        <p role="alert" className="mt-5 rounded-[12px] border border-wine/30 bg-wine/5 px-4 py-3 text-sm text-ink">
          Não deu para ler a origem dos pedidos agora. Recarregue a página; se continuar, avise quem cuida do painel.
        </p>
      ) : null}

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Cartao Icone={Receipt} rotulo="Pedidos pagos" apoio={`${inteiro(c.pedidos)} criados no período`}>
          {inteiro(c.pagos)}
        </Cartao>
        <Cartao Icone={MousePointerClick} rotulo="Com a chegada anotada" apoio={fatia(c.pagosComChegada)}>
          {inteiro(c.pagosComChegada)}
        </Cartao>
        <Cartao Icone={Megaphone} rotulo="Vieram de anúncio" apoio={c.pagosDeAnuncio > 0 ? <Dinheiro valor={c.valorDeAnuncio} /> : fatia(0)}>
          {inteiro(c.pagosDeAnuncio)}
        </Cartao>
        <Cartao
          Icone={Target}
          rotulo="Ligados ao anúncio exato"
          apoio={c.pagosDeAnuncio > 0 ? `${inteiro(c.pagosComAnuncioExato)} de ${inteiro(c.pagosDeAnuncio)} que vieram de anúncio` : "sem pedido de anúncio no período"}
        >
          {inteiro(c.pagosComAnuncioExato)}
        </Cartao>
      </div>

      {antesDoColetor ? (
        <p className="mt-3 max-w-3xl text-xs leading-relaxed text-muted">
          A loja anota a chegada desde {diaCurto(COMECO_DO_COLETOR)}. Pedido de antes disso aparece na lista sem chegada, e por isso os
          números de cima só dizem alguma coisa sobre os pedidos de lá para cá.
        </p>
      ) : null}

      {bio && bio.chegadas > 0 ? <LinkDaBio bio={bio} pedidos={lista} /> : null}

      <ListaDeOrigem pedidos={lista} buscaInicial={busca} abaInicial={aba} soPagosInicial={soPagos} />

      <ConversasDaKommo dados={kommo} />

      <section className="glass mt-6 rounded-[18px] p-5">
        <p className="eyebrow">Como ler</p>
        <ul className="mt-3 max-w-3xl space-y-2 text-sm leading-relaxed text-muted">
          <li>
            <strong className="font-semibold text-ink">O que conta como origem.</strong> Se o visitante clicou num anúncio nos sete dias
            antes do pedido, a venda é do anúncio, mesmo que ele tenha voltado depois pelo Google ou pelo link da bio. Sem clique em
            anúncio, vale a última chegada que não seja acesso direto, até trinta dias antes. Cada pedido entra em um anúncio só.
          </li>
          <li>
            <strong className="font-semibold text-ink">Instagram nem sempre é anúncio.</strong> O link da bio também chega como
            Instagram. Só conta como anúncio a chegada que bate com uma campanha ou que vem com mídia paga na UTM. Quem clicou num
            anúncio e voltou pelo link da bio em até sete dias aparece como &ldquo;Anúncio, pelo link da bio&rdquo;, com a mídia
            terminada em <code>_bio</code>.
          </li>
          <li>
            <strong className="font-semibold text-ink">Por que um anúncio fica sem identificar.</strong> O anúncio é achado pelo nome que
            vem em <code>utm_content</code>, e o conjunto pelo de <code>utm_term</code>. Campanha com texto fixo nesses campos, em vez
            do nome do anúncio, só liga até a campanha. No Google, o endereço só traz a campanha.
          </li>
          <li>
            <strong className="font-semibold text-ink">Não é o número da plataforma.</strong> O Meta e o Google contam venda por
            critério próprio. Aqui é pedido pago da loja, um por um.
          </li>
        </ul>
      </section>
    </div>
  );
}
