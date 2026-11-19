import { TelaDeComentarios } from "@/app/admin/(painel)/redes/comentarios/Tela";
import type { ComentarioNaTela } from "@/lib/redes/comentarios";
import { AGORA, foto } from "../redes-exemplo";
import type { Demo } from "../tipos";

const publicacao = (legenda: string, n: number) => ({ legenda, link: null, miniaturaUrl: foto(n), formato: "post" });

const comentario = (id: string, rede: ComentarioNaTela["rede"], autor: string, texto: string, horas: number, post: ComentarioNaTela["publicacao"], pid: string): ComentarioNaTela => ({
  id, rede, conta: "@exemplo", autor, texto, quando: new Date(AGORA - horas * 3_600_000).toISOString(), estado: "novo", ehResposta: false, acima: null, respostas: [], respondidoPor: null,
  publicacaoId: pid, publicacao: post, podeResponder: true, podeOcultar: true,
});

const p1 = publicacao("Exemplo de vídeo curto mostrando o passo a passo de uma peça", 0);
const p2 = publicacao("Exemplo de carrossel com cinco dicas para escolher", 2);

const comentarios: ComentarioNaTela[] = [
  comentario("k1", "instagram", "Pessoa Exemplo Um", "Que lindo! Vocês entregam para todo o Brasil?", 2, p1, "p1"),
  comentario("k2", "instagram", "Pessoa Exemplo Dois", "Quanto custa a versão da segunda foto?", 5, p2, "p3"),
  comentario("k3", "facebook", "Pessoa Exemplo Três", "Adorei o resultado, parabéns pelo trabalho.", 9, p2, "p3"),
];

const ok = async () => {
  "use server";
  return { ok: true as const, aviso: "Resposta publicada." };
};

const demo: Demo = {
  caminho: "/admin/redes/comentarios",
  desenho: () => (
    <TelaDeComentarios aba="novos" rede={null} ver="lista" comentarios={comentarios} contagem={{ total: 14, porRede: { instagram: 9, facebook: 3, youtube: 2 } }} agora={AGORA} acoes={{ responder: ok, marcar: ok, ocultar: ok }} />
  ),
};
export default demo;
