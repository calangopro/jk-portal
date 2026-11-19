import { TelaDosConteudos } from "@/app/admin/(painel)/conteudos/Tela";
import type { ContentRow } from "@/lib/data/admin-contents";
import { ehAdmin } from "@/lib/auth/acessos";
import type { Demo } from "../tipos";

const base: Omit<ContentRow, "id" | "title" | "slug" | "status" | "cluster" | "scheduled_at" | "updated_at"> = {
  type: "guide", excerpt: null, answer: null, body_html: null, meta_title: null, meta_description: null, target_query: null,
  search_intent: null, pillar_id: null, author_name: "Autor Exemplo Um", reviewer_name: null, author_id: null, reviewer_id: null,
  faqs: null, published_at: null, scheduled_error: null, created_at: "2026-10-01T12:00:00Z",
};

const itens: ContentRow[] = [
  { ...base, id: "c1", title: "Post de exemplo sobre o primeiro assunto", slug: "post-de-exemplo-um", status: "published", cluster: "assunto exemplo", scheduled_at: null, updated_at: "2026-11-12T12:00:00Z" },
  { ...base, id: "c2", title: "Post de exemplo em revisão", slug: "post-de-exemplo-dois", status: "in_review", cluster: "assunto exemplo", scheduled_at: null, updated_at: "2026-11-16T12:00:00Z" },
  { ...base, id: "c3", title: "Rascunho de exemplo", slug: "rascunho-de-exemplo", status: "draft", cluster: "outro assunto", scheduled_at: null, updated_at: "2026-11-18T12:00:00Z" },
  { ...base, id: "c4", title: "Post de exemplo agendado", slug: "post-agendado-de-exemplo", status: "draft", cluster: "outro assunto", scheduled_at: "2026-11-24T15:00:00Z", updated_at: "2026-11-17T12:00:00Z" },
];

const demo: Demo = {
  caminho: "/admin/conteudos",
  desenho: (nivel) => <TelaDosConteudos itens={itens} orfas={[{ id: "c1", title: "Post de exemplo sobre o primeiro assunto" }]} souAdmin={ehAdmin(nivel)} />,
};
export default demo;
