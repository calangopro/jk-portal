import { Cartao } from "@/app/admin/(painel)/integracoes/Cartao";
import { CartaoDeChave } from "@/app/admin/(painel)/integracoes/CartaoDeChave";
import type { Demo } from "../tipos";

/**
 * Integrações só com cartões de exemplo: nenhum id de conta e nenhuma chave de verdade.
 * Um cartão de tag desconectado, um conectado com um valor de exemplo e dois destinos de contato
 * (um sem chave e um ligado, com contatos guardados). Os campos de chave nascem vazios, como na tela real.
 */
const demo: Demo = {
  caminho: "/admin/integracoes",
  desenho: () => (
    <>
      <header>
        <p className="eyebrow">Sistema</p>
        <h1 className="font-display mt-2 text-4xl text-ink">Integrações</h1>
        <p className="mt-3 max-w-2xl text-muted">
          Tudo que mede o resultado do portal fica centralizado aqui. As tags só carregam em produção e apenas quando a
          integração está conectada, então o acesso de quem está construindo o site não suja os dados.
        </p>
      </header>

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <Cartao
          provider="gtm"
          nome="Gerenciador de tags (exemplo)"
          descricao="Carrega as tags de anúncio e recebe os eventos de clique. Cole o ID do contêiner e toque em Conectar."
          status="disconnected"
          config={{}}
          campos={[{ nome: "container_id", rotulo: "ID do contêiner", exemplo: "GTM-XXXXXXX" }]}
          aviso="Aviso de exemplo: confira com quem cuida do contêiner antes de criar uma tag nova."
        />
        <Cartao
          provider="gsc"
          nome="Busca do Google (exemplo)"
          descricao="Impressões, cliques e posição das páginas. É a fonte que diz se o conteúdo está ganhando terreno."
          status="connected"
          config={{ site_url: "sc-domain:exemplo.com.br" }}
          campos={[{ nome: "site_url", rotulo: "Propriedade", exemplo: "sc-domain:exemplo.com.br", ajuda: "Use sc-domain: para propriedade de domínio." }]}
        />
      </div>

      <section className="mt-12">
        <p className="eyebrow">Grupo de ofertas</p>
        <h2 className="font-display mt-2 text-2xl text-ink">Para onde vão os contatos</h2>
        <p className="mt-2 max-w-3xl text-sm text-muted">
          Todo contato deixado na página do grupo ou no link da bio fica gravado no portal primeiro, e depois segue para cada
          destino ligado aqui. Destino sem chave não perde ninguém: o contato fica guardado e sai pelo botão de enviar os
          guardados.
        </p>
        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <CartaoDeChave
            provider="exemplo_a"
            destino="exemplo_a"
            nome="Destino de exemplo A"
            descricao="Cria o contato com as etiquetas do grupo e anota de onde a pessoa veio."
            rotulo="Chave de acesso"
            exemplo="Cole a chave aqui"
            ajuda="Em Configurações do destino, gere uma chave de acesso e cole aqui."
            configurada={false}
            atualizadaEm={null}
            guardados={0}
          />
          <CartaoDeChave
            provider="exemplo_b"
            destino="exemplo_b"
            nome="Destino de exemplo B"
            descricao="Recebe cada contato em JSON, com nome, WhatsApp, origem e o aceite."
            rotulo="Chave de acesso"
            exemplo="Cole a chave aqui"
            configurada
            atualizadaEm="2026-11-10T15:00:00Z"
            guardados={5}
          />
        </div>
      </section>
    </>
  ),
};
export default demo;
