import { TelaDosComentarios, type Linha, type Resposta } from "@/app/admin/(painel)/comentarios/Tela";
import { ehAdmin } from "@/lib/auth/acessos";
import type { Demo } from "../tipos";

const itens: Linha[] = [
  { id: "m1", author_name: "Leitor Exemplo Um", author_email: "leitor1@exemplo.com", body: "Comentário de exemplo: esta aliança serve para uso diário?", status: "pending", created_at: "2026-11-18T14:20:00Z", ip: null, contents: { title: "Post de exemplo um", slug: "post-de-exemplo-um" } },
  { id: "m2", author_name: "Leitor Exemplo Dois", author_email: null, body: "Comentário de exemplo: gostei do guia, ajudou bastante.", status: "pending", created_at: "2026-11-18T09:05:00Z", ip: null, contents: { title: "Post de exemplo dois", slug: "post-de-exemplo-dois" } },
  { id: "m3", author_name: "Leitor Exemplo Três", author_email: null, body: "Comentário de exemplo com propaganda de outro site.", status: "pending", created_at: "2026-11-17T21:40:00Z", ip: null, contents: { title: "Post de exemplo um", slug: "post-de-exemplo-um" } },
];
const respostasPor = new Map<string, Resposta[]>();

/** Só a diretoria responde e apaga; os outros níveis só moderam. */
const demo: Demo = {
  caminho: "/admin/comentarios",
  desenho: (nivel) => (
    <TelaDosComentarios itens={itens} respostasPor={respostasPor} pendentes={3} filtro="pending" souAdmin={ehAdmin(nivel)} />
  ),
};
export default demo;
