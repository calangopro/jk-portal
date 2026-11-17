import { scriptDaOrigemDaBio } from "@/lib/bio/origem-script";
import { COOKIE_DO_ANUNCIO, MARCA_DA_BIO, MIDIA_PAGA } from "@/lib/origem/chegada";

/**
 * De onde veio quem abriu a bio, sem etiqueta no link.
 *
 * O link divulgado é só `jkaliancas.com.br/bio`. Link com `?utm_source=...`
 * fica enorme e feio na bio do Instagram, e a JK pediu para não usar. O
 * problema é que, sem etiqueta, o navegador do Instagram muitas vezes chega
 * SEM referência, e o GA4 conta a visita como acesso direto: a venda perde a
 * origem.
 *
 * A saída é descobrir a origem aqui e entregar ao GA4 como se o link tivesse
 * etiqueta. O endereço na barra continua limpo: só o `page_location` que vai
 * para o GA4 ganha os parâmetros (ver `Medicao`). Como a bio e a loja são o
 * mesmo domínio e a mesma propriedade, a sessão que nasce aqui como
 * "instagram / social" continua assim até a compra.
 *
 * Como descobre, em ordem:
 *   1. ANÚNCIO QUE LEVA DIRETO PARA A BIO (mídia paga na UTM): ficam as UTMs
 *      dele e a mídia ganha `_bio` no fim (`paid` vira `paid_bio`). Campanha,
 *      conjunto e anúncio não mudam, porque precisam bater com os nomes do
 *      gerenciador de anúncios.
 *   2. QUEM CLICOU NUM ANÚNCIO ATÉ SETE DIAS ANTES e agora chega pelo link da
 *      bio: a visita fica com as UTMs DAQUELE anúncio, também com `_bio` no fim
 *      da mídia. O Instagram etiqueta todo clique no link do perfil do mesmo
 *      jeito (`ig / social / link_in_bio`), venha a pessoa de anúncio ou não,
 *      então pelo endereço não dá para saber. Quem sabe é o site: o clique no
 *      anúncio deixou o cookie `jk_ad` (ver `/api/origem`), que este script lê.
 *   3. Link que JÁ tem `utm_source` sem ser anúncio (o do Instagram, e-mail):
 *      vale a etiqueta dele, e a bio entra em `utm_term=bio` quando o termo
 *      está vazio.
 *   4. `?o=canal` curto, para onde o app não se identifica (WhatsApp, e-mail,
 *      QR code na loja): `/bio?o=whatsapp`.
 *   5. O navegador de dentro do app: Instagram, Threads, TikTok e Facebook se
 *      identificam no user agent.
 *   6. A página de onde veio: Pinterest, YouTube e os mesmos acima quando
 *      abertos no navegador comum.
 *   Nada disso: fica como o GA4 decidir (acesso direto ou referência).
 *
 * O painel grava a MESMA coisa, mas não por este script: lá quem decide é o
 * servidor, olhando as chegadas do visitante (`lib/origem/registrar.ts`).
 *
 * O LIMITE. Anúncio que manda a pessoa para o PERFIL do Instagram, e não para
 * o site, não deixa rastro nenhum: quando ela toca no link da bio, é a
 * primeira vez que o site a vê, e a visita sai como orgânica.
 *
 * Na página /grupo os casos 1 e 2 não valem: o anúncio leva direto para lá
 * (não "passou pela bio"), então as UTMs dele ficam intactas; e a visita sem
 * etiqueta vira `utm_campaign=grupo_de_ofertas`.
 *
 * Roda como script comum no HTML, antes de qualquer coisa do React, para o
 * resultado já existir quando o GA4 carregar. Guarda em `window.jkOrigemDaBio`,
 * que a captura do grupo usa para gravar a origem junto do contato.
 */
const SCRIPT = scriptDaOrigemDaBio({ cookie: COOKIE_DO_ANUNCIO, marca: MARCA_DA_BIO, midiaPaga: MIDIA_PAGA.source });

export function OrigemDaBio() {
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}

declare global {
  interface Window {
    jkOrigemDaBio?: {
      rede: string;
      utm: Partial<Record<"utm_source" | "utm_medium" | "utm_campaign" | "utm_content" | "utm_term", string>>;
      pago: boolean;
    };
    jkPaginaComOrigem?: string;
  }
}
