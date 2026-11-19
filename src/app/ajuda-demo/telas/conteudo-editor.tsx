import { Editor } from "@/app/admin/(painel)/conteudos/[id]/Editor";
import type { ContentRow } from "@/lib/data/admin-contents";
import type { Fato } from "@/lib/content/fatos";
import type { Demo } from "../tipos";

/**
 * O editor de verdade, aberto num rascunho de exemplo. Os prints só olham, não digitam:
 * o salvamento automático só dispara depois de uma alteração.
 */
const inicial: ContentRow = {
  id: "00000000-0000-0000-0000-000000000001",
  type: "guide",
  title: "Guia de exemplo",
  slug: "guia-de-exemplo",
  status: "draft",
  excerpt: "Resumo de exemplo do guia.",
  answer: "Resposta direta de exemplo: em uma ou duas frases, o que a pessoa quer saber logo de cara.",
  body_html:
    "<h2>Primeira pergunta de exemplo?</h2><p>Parágrafo de exemplo que explica o assunto com calma. Este texto é inventado só para mostrar o editor.</p><ul><li>Primeiro item de exemplo</li><li>Segundo item de exemplo</li></ul><h2>Segunda pergunta de exemplo?</h2><p>Outro parágrafo de exemplo, curto e direto.</p>",
  meta_title: "Título de exemplo para busca",
  meta_description: "Descrição de exemplo que aparece embaixo do título nos resultados do Google.",
  target_query: "consulta de exemplo",
  search_intent: "informacional",
  cluster: "assunto exemplo",
  pillar_id: null,
  author_name: "Autor Exemplo Um",
  reviewer_name: null,
  author_id: null,
  reviewer_id: null,
  faqs: null,
  published_at: null,
  scheduled_at: null,
  scheduled_error: null,
  created_at: "2026-11-10T12:00:00Z",
  updated_at: "2026-11-18T12:00:00Z",
};

const fato: Fato = {
  id: "f1", claim: "Fato de exemplo: a loja de exemplo tem garantia de um ano.", detail: null, module: "garantias",
  sourceUrl: "https://exemplo.com.br/garantia", fileUrl: null, capturedAt: "2026-11-02", responsible: "Pessoa Exemplo",
  status: "aprovado", subject: null, attribute: null,
};

const demo: Demo = {
  caminho: "/admin/conteudos",
  desenho: () => (
    <Editor
      inicial={inicial}
      comparaveis={[{ id: "c9", title: "Outro guia de exemplo", slug: "outro-guia", targetQuery: "outra consulta", status: "published" }]}
      fontesIniciais={[{ id: "s1", source_url: "https://exemplo.com.br/garantia", evidence: "Fonte de exemplo", captured_at: "2026-11-02", responsible: "Pessoa Exemplo", fact_id: "f1" }]}
      fatosAprovados={[fato]}
      clusters={["assunto exemplo", "outro assunto"]}
      capaInicial={null}
      autores={[{ id: "a1", name: "Autor Exemplo Um", slug: "autor-exemplo-um" }]}
      temLinkDeEntrada
    />
  ),
};
export default demo;
