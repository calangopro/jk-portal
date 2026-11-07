import "server-only";
import type { Operacao } from "../tipos";
import { OPERACOES_PAINEL } from "./painel";
import { OPERACOES_CONTEUDOS } from "./conteudos";
import { OPERACOES_MIDIA } from "./midia";
import { OPERACOES_EDITORIAL } from "./editorial";
import { OPERACOES_LOJA } from "./loja";
import { OPERACOES_SITE } from "./site";

/**
 * O catálogo inteiro do conector. Operação nova entra no arquivo da área e
 * aparece sozinha nos dois modos (código e ferramentas) e na tela
 * /admin/conector. A área nova também precisa de uma linha em AREAS.
 */

export const AREAS: { nome: string; descricao: string }[] = [
  { nome: "painel", descricao: "visão geral, quem está conectado e o que o conector fez" },
  { nome: "conteudos", descricao: "posts: criar, editar, analisar, fontes, capa, produtos, versões, publicar, agendar" },
  { nome: "blocos", descricao: "HTML pronto dos blocos do editor (vitrine de produtos, figura, ferramentas)" },
  { nome: "midia", descricao: "biblioteca de imagens: listar, enviar por link (vira WebP), alt e legenda" },
  { nome: "fatos", descricao: "base de fatos: o que dá para afirmar sobre a JK" },
  { nome: "pautas", descricao: "fila de pautas e oportunidades do Search Console" },
  { nome: "comentarios", descricao: "moderação e resposta da JK" },
  { nome: "autores", descricao: "quem assina e revisa" },
  { nome: "produtos", descricao: "catálogo espelhado da Tray (só leitura) e sincronização" },
  { nome: "lojas", descricao: "lojas físicas: endereço, horário, fotos, publicação" },
  { nome: "metricas", descricao: "Search Console (buscas, páginas, números de um post, importação) e visitas do GA4" },
  { nome: "home", descricao: "layout da página inicial" },
  { nome: "bio", descricao: "link da bio do Instagram, com campanhas por data" },
  { nome: "grupo", descricao: "grupo de ofertas do WhatsApp" },
  { nome: "leads", descricao: "contatos do grupo (bio, /grupo, pop-up da loja)" },
  { nome: "qrcodes", descricao: "QR codes impressos e leituras" },
  { nome: "aparencia", descricao: "cores e cantos do site" },
  { nome: "redirects", descricao: "redirects e fila de 404" },
  { nome: "site", descricao: "auditar página no ar, busca do site, revalidar" },
  { nome: "usuarios", descricao: "equipe do painel e convites" },
  { nome: "integracoes", descricao: "situação das integrações (sem chaves)" },
];

export const OPERACOES: Operacao[] = [
  ...OPERACOES_PAINEL,
  ...OPERACOES_CONTEUDOS,
  ...OPERACOES_MIDIA,
  ...OPERACOES_EDITORIAL,
  ...OPERACOES_LOJA,
  ...OPERACOES_SITE,
] as unknown as Operacao[];

// Nome repetido ou área sem linha em AREAS quebraria o `jk` do modo código em silêncio.
const nomes = new Set<string>();
for (const op of OPERACOES) {
  if (nomes.has(op.nome)) throw new Error(`[conector] operação repetida: ${op.nome}`);
  nomes.add(op.nome);
  if (!AREAS.some((a) => op.nome.startsWith(`${a.nome}.`))) throw new Error(`[conector] área sem descrição: ${op.nome}`);
}
