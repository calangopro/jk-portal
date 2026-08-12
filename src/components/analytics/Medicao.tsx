import Script from "next/script";
import { isProduction } from "@/lib/seo/site";
import { obterConfigPublica } from "@/lib/data/integracoes";

/**
 * Carrega GTM e GA4 apenas em produção e apenas quando a integração está
 * marcada como conectada no painel. Em desenvolvimento nada é carregado, para
 * não sujar os dados com acesso de quem está construindo o site.
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

      {/* GA4 direto só quando NÃO houver GTM, para não medir em dobro. */}
      {!gtmContainerId && ga4MeasurementId ? (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${ga4MeasurementId}`}
            strategy="afterInteractive"
          />
          <Script id="ga4" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());gtag('config','${ga4MeasurementId}');`}
          </Script>
        </>
      ) : null}
    </>
  );
}
