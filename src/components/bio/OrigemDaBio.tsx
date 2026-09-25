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
 *   1. Link que JÁ tem `utm_source` (anúncio, e-mail): vale a etiqueta dele, e a
 *      bio entra em `utm_term=bio` quando o termo está vazio. É a marca de que
 *      o anúncio terminou passando pela bio, sem mexer em campanha nem em
 *      conteúdo, que precisam bater com os nomes do gerenciador de anúncios.
 *   2. `?o=canal` curto, para onde o app não se identifica (WhatsApp, e-mail,
 *      QR code na loja): `/bio?o=whatsapp`.
 *   3. O navegador de dentro do app: Instagram, Threads, TikTok e Facebook se
 *      identificam no user agent.
 *   4. A página de onde veio: Pinterest, YouTube e os mesmos acima quando
 *      abertos no navegador comum.
 *   Nada disso: fica como o GA4 decidir (acesso direto ou referência).
 *
 * Anúncio e perfil chegam IGUAIS do Instagram (mesmo app, mesmo `fbclid`), então
 * o anúncio continua precisando dos parâmetros do gerenciador. É a única
 * etiqueta que sobra, e ela mora no anúncio, não na bio.
 *
 * Roda como script comum no HTML, antes de qualquer coisa do React, para o
 * resultado já existir quando o GA4 carregar. Guarda em `window.jkOrigemDaBio`,
 * que a captura do grupo usa para gravar a origem junto do contato.
 */
const SCRIPT = `(function(){try{
var q=new URLSearchParams(location.search),ua=navigator.userAgent||"",h="";
try{h=document.referrer?new URL(document.referrer).hostname:""}catch(e){}
var u={};["utm_source","utm_medium","utm_campaign","utm_content","utm_term"].forEach(function(k){var v=q.get(k);if(v)u[k]=v.slice(0,120)});
var r="";
if(/Instagram/i.test(ua)||/(^|\\.)instagram\\.com$/.test(h))r="instagram";
else if(/Barcelona/.test(ua)||/(^|\\.)threads\\.(net|com)$/.test(h))r="threads";
else if(/musical_ly|BytedanceWebview|TikTok|trill_/i.test(ua)||/(^|\\.)tiktok\\.com$/.test(h))r="tiktok";
else if(/FBAN|FBAV|FB_IAB|FB4A|FBIOS/.test(ua)||/(^|\\.)(facebook\\.com|fb\\.com|fb\\.me)$/.test(h))r="facebook";
else if(/Pinterest/i.test(ua)||/(^|\\.)pinterest\\./.test(h)||h==="pin.it")r="pinterest";
else if(/(^|\\.)(youtube\\.com|youtu\\.be)$/.test(h))r="youtube";
var o=(q.get("o")||"").toLowerCase().replace(/[^a-z0-9_-]/g,"").slice(0,30);
var mudou=false;
if(u.utm_source){if(!u.utm_term){u.utm_term="bio";mudou=true}}
else if(o||r){u.utm_source=o||r;u.utm_medium="social";u.utm_campaign="link_na_bio";mudou=true}
var m=u.utm_medium||"";
window.jkOrigemDaBio={rede:o||r,utm:u,pago:!!q.get("gclid")||/(cpc|ppc|paid|ads)/i.test(m)};
if(mudou){var l=new URL(location.href);l.searchParams.delete("o");Object.keys(u).forEach(function(k){l.searchParams.set(k,u[k])});window.jkPaginaComOrigem=l.toString()}
}catch(e){}})();`;

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
