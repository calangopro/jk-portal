import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Cartao } from "./Cartao";

export const metadata = { title: "Integrações" };

type Linha = { provider: string; status: string; config: Record<string, string> };

export default async function IntegracoesPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase.from("integrations").select("provider, status, config");

  const linhas = (data ?? []) as Linha[];
  const achar = (p: string) => linhas.find((l) => l.provider === p);

  return (
    <>
      <header>
        <p className="eyebrow">Ferramentas</p>
        <h1 className="font-display mt-2 text-4xl text-ink">Integrações</h1>
        <p className="mt-3 max-w-2xl text-muted">
          Tudo que mede o resultado do portal fica centralizado aqui. As tags só
          carregam em produção e apenas quando a integração está conectada,
          então o acesso de quem está construindo o site não suja os dados.
        </p>
      </header>

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <Cartao
          provider="gtm"
          nome="Google Tag Manager"
          descricao="Carrega as tags e envia os eventos de clique para o GA4. Quando o GTM está ligado, o GA4 não é carregado em separado, para não medir em dobro."
          status={achar("gtm")?.status ?? "disconnected"}
          config={achar("gtm")?.config ?? {}}
          campos={[{ nome: "container_id", rotulo: "ID do contêiner", exemplo: "GTM-XXXXXXX" }]}
          aviso="Eventos já disparados pelo site: clique_produto, clique_whatsapp, clique_telefone, clique_rota e clique_loja."
        />

        <Cartao
          provider="ga4"
          nome="Google Analytics 4"
          descricao="Comportamento de quem visita: páginas, origem do tráfego e conversão."
          status={achar("ga4")?.status ?? "disconnected"}
          config={achar("ga4")?.config ?? {}}
          campos={[{ nome: "measurement_id", rotulo: "ID de métrica", exemplo: "G-XXXXXXXXXX" }]}
        />

        <Cartao
          provider="gsc"
          nome="Google Search Console"
          descricao="Impressões, cliques, posição e páginas indexadas. É a fonte que diz se o conteúdo está ganhando terreno."
          status={achar("gsc")?.status ?? "disconnected"}
          config={achar("gsc")?.config ?? {}}
          campos={[
            {
              nome: "site_url",
              rotulo: "Propriedade",
              exemplo: "sc-domain:jkaliancas.com.br",
              ajuda: "Use sc-domain: para propriedade de domínio, ou o endereço completo com https.",
            },
          ]}
          aviso="A leitura automática pela API depende de autorização no Google. Enquanto isso, dá para importar a planilha exportada do Search Console na tela de Métricas."
        />

        <Cartao
          provider="gmb"
          nome="Google Meu Negócio"
          descricao="Avaliações, rotas e ligações das 10 unidades. Base do SEO local."
          status={achar("gmb")?.status ?? "disconnected"}
          config={achar("gmb")?.config ?? {}}
          campos={[{ nome: "account", rotulo: "Conta ou grupo de locais", exemplo: "JK Alianças" }]}
          aviso="Requer autorização no Google e verificação das unidades. Os dados de NAP das lojas continuam sendo editados na tela de Lojas."
        />
      </div>
    </>
  );
}
