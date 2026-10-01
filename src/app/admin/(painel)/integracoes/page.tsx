import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { lerChaves, PIXEL_DA_JK } from "@/lib/leads/chaves";
import { funisDaKommo } from "@/lib/leads/kommo-funis";
import { DESTINOS, type Destino } from "@/lib/leads/tipos";
import { Cartao } from "./Cartao";
import { CartaoDeChave } from "./CartaoDeChave";

export const metadata = { title: "Integrações" };

type Linha = { provider: string; status: string; config: Record<string, string> };

export default async function IntegracoesPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase.from("integrations").select("provider, status, config");

  const linhas = (data ?? []) as Linha[];
  const achar = (p: string) => linhas.find((l) => l.provider === p);

  // Chaves e contagens com a service_role: `integration_tokens` não tem policy,
  // e a página já exige administrador.
  const admin = createAdminClient();
  const chaves = await lerChaves(admin);
  const [guardados, funis] = await Promise.all([
    Promise.all(
      DESTINOS.map(async (d) => {
        const { count } = await admin
          .from("leads")
          .select("id", { count: "exact", head: true })
          .in(`envios->${d}->>status`, ["sem_chave", "erro"]);
        return [d, count ?? 0] as const;
      }),
    ).then((pares) => Object.fromEntries(pares) as Record<Destino, number>),
    chaves.kommo ? funisDaKommo(chaves.kommo) : Promise.resolve(null),
  ]);
  const funilAtual = chaves.kommo?.meta.funil_id
    ? `${chaves.kommo.meta.funil_id}:${chaves.kommo.meta.etapa_id ?? ""}`
    : "";

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
          descricao="É o mesmo contêiner da loja. Hoje carrega Google Ads e Pinterest, e recebe os eventos de clique para quem quiser montar conversão de anúncio."
          status={achar("gtm")?.status ?? "disconnected"}
          config={achar("gtm")?.config ?? {}}
          campos={[{ nome: "container_id", rotulo: "ID do contêiner", exemplo: "GTM-XXXXXXX" }]}
          aviso="Não crie tag de GA4 neste contêiner para as páginas /guias: o GA4 do site já é carregado direto, como a Tray faz na loja, e uma tag a mais contaria cada visita duas vezes."
        />

        <Cartao
          provider="ga4"
          nome="Google Analytics 4"
          descricao="Precisa ser a MESMA propriedade da loja (G-9V89YVR635). É isso que liga quem leu um guia à venda feita na Tray, numa sessão só."
          status={achar("ga4")?.status ?? "disconnected"}
          config={achar("ga4")?.config ?? {}}
          campos={[{ nome: "measurement_id", rotulo: "ID de métrica", exemplo: "G-XXXXXXXXXX" }]}
          aviso="Eventos enviados pelo site: clique_produto, clique_loja, clique_whatsapp, clique_telefone, clique_rota, clique_waze e clique_guia, com os parâmetros destino, posicao e link_url."
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
          aviso="A leitura automática usa uma conta de serviço do Google (variável GSC_SERVICE_ACCOUNT_JSON na Vercel) e roda toda segunda. A situação e o botão Importar agora ficam na tela de Métricas."
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

      <section className="mt-12">
        <p className="eyebrow">Grupo de ofertas</p>
        <h2 className="font-display mt-2 text-2xl text-ink">Para onde vão os contatos</h2>
        <p className="mt-2 max-w-3xl text-sm text-muted">
          Todo contato deixado na página /grupo ou no link da bio fica gravado no portal primeiro, e depois segue para
          cada destino ligado aqui. Destino sem chave não perde ninguém: o contato fica guardado e sai pelo botão de
          enviar os guardados. A lista está em{" "}
          <Link href="/admin/grupo" className="font-semibold text-brand-nav hover:underline">
            Grupo de ofertas
          </Link>
          .
        </p>

        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <CartaoDeChave
            provider="kommo"
            destino="kommo"
            nome="Kommo"
            descricao="Cria o contato (ou acha o que já existe pelo WhatsApp), põe as etiquetas grupo-whatsapp, origem e campanha, marca Receber ofertas = Sim e anota de onde a pessoa veio."
            rotulo="Chave de longa duração"
            exemplo="eyJ0eXAiOiJKV1Qi..."
            ajuda="Na Kommo: Configurações, Integrações, Criar integração (privada), aba Chaves e escopos, Gerar chave de longa duração."
            configurada={Boolean(chaves.kommo)}
            atualizadaEm={chaves.kommo?.atualizadaEm ?? null}
            guardados={guardados.kommo}
          >
            {chaves.kommo ? (
              <label className="block">
                <span className="text-xs font-semibold text-ink">Criar negócio em um funil?</span>
                <select
                  name="funil"
                  defaultValue={funilAtual}
                  className="mt-1 w-full rounded-[10px] border border-border bg-white/80 px-3 py-2 text-sm text-ink outline-none focus:border-brand"
                >
                  <option value="">Não, só o contato com etiquetas</option>
                  {(funis ?? []).map((f) => (
                    <optgroup key={f.id} label={f.nome}>
                      {f.etapas.map((e) => (
                        <option key={e.id} value={`${f.id}:${e.id}`}>
                          {f.nome}: {e.nome}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <span className="mt-1 block text-[0.68rem] leading-snug text-muted">
                  {funis === null
                    ? "Não deu para ler os funis da Kommo agora."
                    : "Negócio novo dispara as automações da etapa (Salesbot, mensagem no WhatsApp). Escolha com quem cuida da Kommo."}
                </span>
              </label>
            ) : null}
          </CartaoDeChave>

          <CartaoDeChave
            provider="rd_station"
            destino="rd"
            nome="RD Station"
            descricao="Conversão grupo-ofertas-whatsapp, a mesma do pop-up da loja, com as mesmas etiquetas e o consentimento. O RD exige e-mail: quem deixou só o WhatsApp vai para a Kommo e não para cá."
            rotulo="Token público"
            ajuda="No RD: Conta, Integrações, Tokens. É o token público, o mesmo que o pop-up da loja usa."
            configurada={Boolean(chaves.rd_station)}
            atualizadaEm={chaves.rd_station?.atualizadaEm ?? null}
            guardados={guardados.rd}
          />

          <CartaoDeChave
            provider="meta_capi"
            destino="meta"
            nome="Meta, API de Conversões"
            descricao="Manda o Lead pelo servidor, com o mesmo id do evento do navegador. O Meta conta uma vez só, e o Lead chega mesmo com bloqueador e no iPhone. É o que deixa a campanha otimizar por cadastro."
            rotulo="Token de acesso"
            ajuda="No Gerenciador de Eventos: o pixel da JK, Configurações, API de Conversões, Gerar token de acesso."
            configurada={Boolean(chaves.meta_capi)}
            atualizadaEm={chaves.meta_capi?.atualizadaEm ?? null}
            guardados={guardados.meta}
          >
            <label className="block">
              <span className="text-xs font-semibold text-ink">Pixel</span>
              <input
                name="pixel_id"
                defaultValue={chaves.meta_capi?.meta.pixel_id || PIXEL_DA_JK}
                inputMode="numeric"
                className="mt-1 w-full rounded-[10px] border border-border bg-white/80 px-3 py-2 text-sm text-ink outline-none focus:border-brand"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-ink">Código de teste (opcional)</span>
              <input
                name="codigo_de_teste"
                defaultValue={chaves.meta_capi?.meta.codigo_de_teste ?? ""}
                placeholder="TEST12345"
                className="mt-1 w-full rounded-[10px] border border-border bg-white/80 px-3 py-2 text-sm text-ink outline-none focus:border-brand"
              />
              <span className="mt-1 block text-[0.68rem] leading-snug text-muted">
                Só para conferir em Eventos de teste. Apague depois: com o código, o Meta não usa o evento na campanha.
              </span>
            </label>
          </CartaoDeChave>

          <CartaoDeChave
            provider="grupo_webhook"
            destino="webhook"
            nome="Webhook do grupo (DevZapp, Make, n8n)"
            descricao="Recebe cada contato em JSON: nome, whatsapp (55...), e-mail, momento, origem, campanha, UTMs, etiquetas e o aceite. Os mesmos campos do pop-up da loja."
            rotulo="Endereço do webhook"
            exemplo="https://..."
            tipo="url"
            configurada={Boolean(chaves.grupo_webhook)}
            atualizadaEm={chaves.grupo_webhook?.atualizadaEm ?? null}
            guardados={guardados.webhook}
          />
        </div>
      </section>
    </>
  );
}
