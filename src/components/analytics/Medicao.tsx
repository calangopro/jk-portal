import Script from "next/script";
import { isProduction } from "@/lib/seo/site";
import { obterConfigPublica } from "@/lib/data/integracoes";

/**
 * Carrega GTM e GA4 apenas em produção e apenas quando a integração está
 * marcada como conectada no painel. Em desenvolvimento nada é carregado, para
 * não sujar os dados com acesso de quem está construindo o site.
 *
 * Os dois carregam JUNTOS, cada um com a sua fila, que é exatamente como a
 * Tray monta a loja no mesmo domínio:
 *
 *   - GTM (GTM-WWT3T789) com a fila padrão `dataLayer`. O contêiner é
 *     compartilhado com a loja e NÃO tem tag de GA4 (conferido em 24/09/2026
 *     nas requisições da página): tem Google Ads e Pinterest.
 *   - GA4 (G-9V89YVR635) pelo gtag, com a fila própria `dataLayerGa4` e o
 *     mesmo `cookie_flags`, igual à integração nativa da Tray. Divergir no
 *     `cookie_flags` faria portal e loja regravarem o `_ga` um por cima do
 *     outro com atributos diferentes a cada troca de página.
 *
 * A regra antiga era "com GTM ligado, GA4 não carrega, para não medir em
 * dobro". Ela partia do princípio de que o GTM tinha o GA4 dentro, e não tem:
 * na prática o portal não mandava NADA para o GA4, e nenhuma venda da loja
 * podia ser ligada a quem leu um guia. Se um dia alguém puser uma tag de GA4
 * no GTM, ela precisa ficar FORA das páginas /guias, senão aí sim mede em dobro.
 *
 * Mesma propriedade, mesmo domínio e mesmo cookie `_ga`: quem chega do Google
 * num guia e compra na loja fica numa sessão só, com origem orgânica.
 *
 * A estratégia afterInteractive mantém o carregamento fora do caminho crítico,
 * preservando os Core Web Vitals.
 */
export async function Medicao() {
  if (!isProduction()) return null;

  const { gtmContainerId, ga4MeasurementId } = await obterConfigPublica();
  if (!gtmContainerId && !ga4MeasurementId) return null;

  return (
    <>
      {gtmContainerId ? (
        <Script id="gtm" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${gtmContainerId}');`}
        </Script>
      ) : null}

      {ga4MeasurementId ? (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${ga4MeasurementId}&l=dataLayerGa4`}
            strategy="afterInteractive"
          />
          <Script id="ga4" strategy="afterInteractive">
            {`window.dataLayerGa4=window.dataLayerGa4||[];function gtag(){dataLayerGa4.push(arguments);}
window.gtag=gtag;gtag('js', new Date());gtag('config','${ga4MeasurementId}',{cookie_flags:'secure;samesite=none'});`}
          </Script>
        </>
      ) : null}
    </>
  );
}
