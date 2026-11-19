import { TelaDasRedes } from "@/app/admin/(painel)/redes/Tela";
import type { ContaNoResumo, Medida, PublicacaoNoResumo, Resumo } from "@/lib/redes/resumo";
import { AGORA, CONTAS, CONTEUDOS, POSTS_DA_FILA } from "../redes-exemplo";
import type { Demo } from "../tipos";

const m = (valor: number | null, variacao: number | null = null): Medida => ({ valor, variacao });

const conta = (i: number, seguidores: number, ganho: number, vis: number, alc: number | null, inter: number, pubs: number, serie: number[]): ContaNoResumo => ({
  id: CONTAS[i].id, rede: CONTAS[i].rede, nome: CONTAS[i].nome, usuario: CONTAS[i].usuario, fotoUrl: null, link: null, status: "ativa", ultimoErro: null,
  lidaEm: "2026-11-19T17:30:00Z", seguidores: m(seguidores, 0.03), ganho,
  alcance: alc === null ? m(null) : m(alc, 0.08), visualizacoes: m(vis, 0.12), interacoes: m(inter, 0.05),
  visitasAoPerfil: m(null), cliquesNoLink: m(null), publicacoes: m(pubs, 0),
  engajamento: 4.2, baseDoEngajamento: alc === null ? "visualizações" : "pessoas", serieDeSeguidores: serie, serieDeAlcance: [],
});

const post = (c: (typeof CONTEUDOS)[number]): PublicacaoNoResumo => ({ ...c, interacoes: c.interacoes ?? 0, taxa: c.taxa, conta: c.rede });

const resumo: Resumo = {
  dias: 28,
  contas: [
    conta(0, 20000, 600, 90000, 40000, 6000, 12, [19400, 19550, 19700, 19850, 20000]),
    conta(1, 8000, 120, 30000, 18000, 1500, 8, [7880, 7920, 7950, 7980, 8000]),
    conta(2, 5000, 90, 22000, null, 1100, 4, [4910, 4940, 4960, 4985, 5000]),
  ],
  total: { seguidores: m(33000, 0.03), ganho: 810, visualizacoes: m(142000, 0.1), alcance: m(58000, 0.07), interacoes: m(8600, 0.04), publicacoes: m(24, 0.1) },
  melhores: [CONTEUDOS[0], CONTEUDOS[1], CONTEUDOS[2]].map(post),
  recentes: [CONTEUDOS[7], CONTEUDOS[0], CONTEUDOS[1]].map(post),
  semLeitura: false,
};

const demo: Demo = {
  caminho: "/admin/redes",
  desenho: () => (
    <TelaDasRedes
      resumo={resumo}
      hoje={{ proximos: POSTS_DA_FILA.slice(0, 2), comentarios: { total: 14, porRede: { instagram: 9, facebook: 3, youtube: 2 } }, emAlta: CONTEUDOS.filter((c) => c.acima) }}
      dias={28}
      periodos={[7, 28, 90]}
      agora={AGORA}
      podeLigar
    />
  ),
};
export default demo;
