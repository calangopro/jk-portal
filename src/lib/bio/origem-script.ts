/**
 * O texto do script que descobre de onde veio quem abriu a bio. A explicação
 * do que ele faz está em `components/bio/OrigemDaBio.tsx`, que é quem o põe na
 * página.
 *
 * Mora aqui, em arquivo puro, para o teste conseguir RODAR o script (com
 * `node:vm`, num navegador de mentira) em cada caso: é ele que decide o que o
 * GA4 recebe, e erro nele não aparece em build nenhum. As três constantes vêm
 * de fora (`lib/origem/chegada.ts`) pelo motivo de sempre: arquivo puro não
 * importa valor do vizinho.
 *
 * `cookie` só pode ter letra, número e sublinhado, porque entra cru numa
 * expressão regular.
 */
export function scriptDaOrigemDaBio(c: { cookie: string; marca: string; midiaPaga: string }): string {
  if (!/^[a-z0-9_]+$/i.test(c.cookie)) throw new Error("nome de cookie inesperado");
  return `(function(){try{
var q=new URLSearchParams(location.search),ua=navigator.userAgent||"",h="";
try{h=document.referrer?new URL(document.referrer).hostname:""}catch(e){}
var K=["utm_source","utm_medium","utm_campaign","utm_content","utm_term"];
var u={};K.forEach(function(k){var v=q.get(k);if(v)u[k]=v.slice(0,120)});
var r="";
if(/Instagram/i.test(ua)||/(^|\\.)instagram\\.com$/.test(h))r="instagram";
else if(/Barcelona/.test(ua)||/(^|\\.)threads\\.(net|com)$/.test(h))r="threads";
else if(/musical_ly|BytedanceWebview|TikTok|trill_/i.test(ua)||/(^|\\.)tiktok\\.com$/.test(h))r="tiktok";
else if(/FBAN|FBAV|FB_IAB|FB4A|FBIOS/.test(ua)||/(^|\\.)(facebook\\.com|fb\\.com|fb\\.me)$/.test(h))r="facebook";
else if(/Pinterest/i.test(ua)||/(^|\\.)pinterest\\./.test(h)||h==="pin.it")r="pinterest";
else if(/(^|\\.)(youtube\\.com|youtu\\.be)$/.test(h))r="youtube";
var o=(q.get("o")||"").toLowerCase().replace(/[^a-z0-9_-]/g,"").slice(0,30);
var g=/^\\/(guias\\/)?grupo(\\/|$)/.test(location.pathname);
var m=u.utm_medium||"",B=${JSON.stringify(c.marca)};
var naBio=m.slice(-B.length).toLowerCase()===B;
var pago=!!(q.get("gclid")||q.get("gbraid")||q.get("wbraid"))||new RegExp(${JSON.stringify(c.midiaPaga)},"i").test(m);
var ad=null;
try{var c=document.cookie.match(/(?:^|; )${c.cookie}=([^;]*)/);if(c){var a=new URLSearchParams(decodeURIComponent(c[1]));if(a.get("m"))ad=a}}catch(e){}
var id="",mudou=false;
if(pago&&!g){if(m&&!naBio){u.utm_medium=(m+B).slice(0,120);mudou=true}}
else if(ad&&!g&&!pago){var n={utm_source:ad.get("s")||u.utm_source||o||r,utm_medium:ad.get("m")+B,utm_campaign:ad.get("c"),utm_content:ad.get("n"),utm_term:ad.get("t")};u={};K.forEach(function(k){if(n[k])u[k]=String(n[k]).slice(0,120)});id=ad.get("i")||"";pago=true;mudou=true}
else if(u.utm_source){if(!u.utm_term&&!g){u.utm_term="bio";mudou=true}}
else if(o||r){u.utm_source=o||r;u.utm_medium="social";u.utm_campaign=g?"grupo_de_ofertas":"link_na_bio";mudou=true}
window.jkOrigemDaBio={rede:o||r,utm:u,pago:pago};
if(mudou){var l=new URL(location.href);l.searchParams.delete("o");K.forEach(function(k){if(u[k])l.searchParams.set(k,u[k]);else l.searchParams.delete(k)});if(id)l.searchParams.set("utm_id",id);window.jkPaginaComOrigem=l.toString()}
}catch(e){}})();`;
}
