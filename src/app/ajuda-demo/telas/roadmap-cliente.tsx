"use client";

import { QuadroDoRoadmap } from "@/app/admin/(painel)/roadmap/Quadro";
import type { Acoes } from "@/app/admin/(painel)/roadmap/tipos";
import type { Cartao, Quadro } from "@/lib/roadmap/roadmap";

/**
 * O quadro do Roadmap com cartões de exemplo (ids pequenos, nomes de exemplo, ramos inventados).
 * O cartão 1 e o 2 mexem no mesmo lugar, para o aviso de cruzamento aparecer.
 */
const base: Omit<Cartao, "id" | "titulo" | "coluna"> = {
  descricao: "Texto de exemplo do cartão.", tipo: "melhoria", prioridade: "media",
  responsavel: null, responsavelId: null, viaClaude: false, sessao: null, ramo: null, prUrl: null, caminhos: [],
  prNumero: null, prEstado: null, arquivos: [], atrasDoMain: null, avisoMain: null, githubLogin: null, githubEm: null,
  sugestaoId: null, origem: "manual", referencia: null, ultimaNota: null,
  criadoEm: "2026-11-10T12:00:00Z", criadoPor: "Ana Exemplo", mudouEm: "2026-11-17T12:00:00Z", mudouPor: "Ana Exemplo",
  pegouEm: null, concluidoEm: null, conflitos: [],
};

const cruzam = [{ meu: "src/app/admin/(painel)/exemplo", dele: "src/app/admin/(painel)/exemplo/Tela.tsx", comum: false }];

const cartoes: Cartao[] = [
  { ...base, id: 1, titulo: "Cartão de exemplo: ajustar a tela de pedidos", coluna: "fazendo", tipo: "melhoria", prioridade: "alta", responsavel: "Ana Exemplo", responsavelId: "a", viaClaude: true, sessao: "sessao-exemplo", ramo: "exemplo/1-ajustar-pedidos", caminhos: ["src/app/admin/(painel)/exemplo"], pegouEm: "2026-11-16T12:00:00Z", conflitos: [{ id: 2, titulo: "Cartão de exemplo: trocar um texto da mesma tela", coluna: "fazendo", responsavel: "Beto Exemplo", responsavelId: "b", viaClaude: false, sessao: null, ramo: "exemplo/2-trocar-texto", prUrl: null, cruzam, soComum: false }] },
  { ...base, id: 2, titulo: "Cartão de exemplo: trocar um texto da mesma tela", coluna: "fazendo", tipo: "correcao", responsavel: "Beto Exemplo", responsavelId: "b", ramo: "exemplo/2-trocar-texto", caminhos: ["src/app/admin/(painel)/exemplo/Tela.tsx"], pegouEm: "2026-11-17T12:00:00Z", conflitos: [{ id: 1, titulo: "Cartão de exemplo: ajustar a tela de pedidos", coluna: "fazendo", responsavel: "Ana Exemplo", responsavelId: "a", viaClaude: true, sessao: "sessao-exemplo", ramo: "exemplo/1-ajustar-pedidos", prUrl: null, cruzam, soComum: false }] },
  { ...base, id: 3, titulo: "Cartão de exemplo: revisar o aviso de erro", coluna: "em_revisao", tipo: "correcao", responsavel: "Ana Exemplo", responsavelId: "a", ramo: "exemplo/3-aviso", caminhos: ["src/lib/exemplo"], prNumero: 100, prEstado: "aberto", prUrl: "https://github.com/exemplo/projeto/pull/100" },
  { ...base, id: 4, titulo: "Cartão de exemplo: nova tela de relatório", coluna: "a_fazer", tipo: "melhoria", prioridade: "media" },
  { ...base, id: 5, titulo: "Cartão de exemplo: trocar a regra de acesso", coluna: "a_fazer", tipo: "seguranca", prioridade: "urgente" },
  { ...base, id: 6, titulo: "Cartão de exemplo: ideia para depois", coluna: "ideias", tipo: "atualizacao", prioridade: "baixa" },
  { ...base, id: 7, titulo: "Cartão de exemplo: texto novo na tela inicial", coluna: "no_ar", tipo: "melhoria", responsavel: "Beto Exemplo", responsavelId: "b", concluidoEm: "2026-11-15T12:00:00Z" },
];

const quadro: Quadro = {
  eu: "a",
  cartoes,
  pessoas: [{ id: "a", nome: "Ana Exemplo" }, { id: "b", nome: "Beto Exemplo" }],
  sugestoes: [],
  ramos: [],
  githubEm: "2026-11-19T11:00:00Z",
};

const acoes: Acoes = {
  ver: async (id) => ({ ok: true as const, inteiro: { cartao: cartoes.find((c) => c.id === id) ?? cartoes[0], historico: [], sugestao: null } }),
  conferir: async () => ({ ok: true as const, conflitos: [] }),
  criar: async () => ({ ok: true as const, id: 8 }),
  pegar: async (id) => ({ ok: true as const, cartao: cartoes.find((c) => c.id === id) ?? cartoes[0], conflitos: [] }),
  mover: async (id) => ({ ok: true as const, cartao: cartoes.find((c) => c.id === id) ?? cartoes[0] }),
  ligarPr: async (id) => ({ ok: true as const, cartao: cartoes.find((c) => c.id === id) ?? cartoes[0] }),
  editar: async (id) => ({ ok: true as const, cartao: cartoes.find((c) => c.id === id) ?? cartoes[0] }),
  levar: async () => ({ ok: true as const, id: 8 }),
};

export function QuadroDeExemplo() {
  return <QuadroDoRoadmap quadro={quadro} eu={{ id: "a", nome: "Ana Exemplo" }} abrir={null} acoes={acoes} />;
}
