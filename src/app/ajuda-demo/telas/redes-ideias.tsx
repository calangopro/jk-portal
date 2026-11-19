import { TelaDeIdeias } from "@/app/admin/(painel)/redes/ideias/Tela";
import type { FontesDeIdeia, IdeiaNaTela } from "@/lib/redes/ideias";
import { AGORA, CONTEUDOS } from "../redes-exemplo";
import type { Demo } from "../tipos";

const ideia = (id: string, titulo: string, estado: IdeiaNaTela["estado"], extra: Partial<IdeiaNaTela> = {}): IdeiaNaTela => ({
  id, titulo, notas: "", formato: null, redes: [], quando: null, estado, origem: "manual", publicacaoId: null, postId: null, criadaPor: "Social Media Exemplo", criadaEm: "2026-11-15T12:00:00Z", ...extra,
});

const ideias: IdeiaNaTela[] = [
  ideia("i1", "Reels mostrando o antes e o depois de um processo", "ideia", { formato: "video_curto", notas: "Gancho: a surpresa no final. Gravar na quinta." }),
  ideia("i2", "Carrossel com cinco perguntas que todo cliente faz", "ideia", { formato: "carrossel", quando: "2026-11-27", origem: "comentario" }),
  ideia("i3", "Story de bastidores da semana", "produzindo", { formato: "story", redes: ["instagram"] }),
  ideia("i4", "Post de agradecimento pelos seguidores", "agendada", { formato: "post", redes: ["instagram", "facebook"], postId: "f1" }),
  ideia("i5", "Vídeo curto com uma dica rápida", "publicada", { formato: "video_curto", redes: ["youtube"], postId: "f2" }),
];

const fontes: FontesDeIdeia = {
  emAlta: [CONTEUDOS[0], CONTEUDOS[2]],
  perguntas: [
    { id: "q1", texto: "Dá para escolher outra cor?", rede: "instagram", publicacaoId: "p1", quando: "2026-11-17T12:00:00Z" },
    { id: "q2", texto: "Quanto tempo leva para ficar pronto?", rede: "facebook", publicacaoId: "p4", quando: "2026-11-16T12:00:00Z" },
  ],
  datas: [
    { data: "2026-11-27", fim: null, nome: "Black Friday", tipo: "comercio", faltam: 8 },
    { data: "2026-12-24", fim: null, nome: "Véspera de Natal", tipo: "comercio", faltam: 35 },
    { data: "2026-11-19", fim: "2026-11-30", nome: "Campanha de exemplo", tipo: "campanha", faltam: 0 },
  ],
};

const ok = async () => {
  "use server";
  return { ok: true as const };
};

const demo: Demo = {
  caminho: "/admin/redes/ideias",
  desenho: () => <TelaDeIdeias ideias={ideias} fontes={fontes} agora={AGORA} acoes={{ criar: ok, editar: ok, mover: ok }} />,
};
export default demo;
