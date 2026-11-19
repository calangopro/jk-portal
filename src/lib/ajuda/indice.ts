import type { Tutorial } from "./tipos.ts";
import { hoje } from "./tutoriais/hoje.ts";
import { pedidosDoSite } from "./tutoriais/pedidos-do-site.ts";
import { vendasDaKommo } from "./tutoriais/vendas-da-kommo.ts";
import { clientes } from "./tutoriais/clientes.ts";
import { oportunidades } from "./tutoriais/oportunidades.ts";
import { consulta } from "./tutoriais/consulta.ts";
import { suporte } from "./tutoriais/suporte.ts";
import { tutor } from "./tutoriais/tutor.ts";
import { biblioteca } from "./tutoriais/biblioteca.ts";
import { chat } from "./tutoriais/chat.ts";
import { registrarVenda } from "./tutoriais/registrar-venda.ts";
// cartão 57
import { fabrica } from "./tutoriais/fabrica.ts";
import { alteracoesNaLoja } from "./tutoriais/alteracoes-na-loja.ts";
import { avaliacoes } from "./tutoriais/avaliacoes.ts";
import { campanhas } from "./tutoriais/campanhas.ts";
import { funilDaKommo } from "./tutoriais/funil-da-kommo.ts";
import { lojas } from "./tutoriais/lojas.ts";
import { pedidosDaLoja } from "./tutoriais/pedidos-da-loja.ts";
import { produtos } from "./tutoriais/produtos.ts";
import { recuperacao } from "./tutoriais/recuperacao.ts";
import { redesAutomacoes } from "./tutoriais/redes-automacoes.ts";
import { redesCalendario } from "./tutoriais/redes-calendario.ts";
import { redesComentarios } from "./tutoriais/redes-comentarios.ts";
import { redesContas } from "./tutoriais/redes-contas.ts";
import { redesConteudos } from "./tutoriais/redes-conteudos.ts";
import { redesHoje } from "./tutoriais/redes-hoje.ts";
import { redesIdeias } from "./tutoriais/redes-ideias.ts";
import { redesPublicar } from "./tutoriais/redes-publicar.ts";
import { sugestoes } from "./tutoriais/sugestoes.ts";
import { vendedores } from "./tutoriais/vendedores.ts";
// Cartão 58
import { anuncios } from "./tutoriais/anuncios.ts";
import { aparencia } from "./tutoriais/aparencia.ts";
import { autores } from "./tutoriais/autores.ts";
import { bio } from "./tutoriais/bio.ts";
import { calendario } from "./tutoriais/calendario.ts";
import { comentarios } from "./tutoriais/comentarios.ts";
import { conector } from "./tutoriais/conector.ts";
import { conteudos } from "./tutoriais/conteudos.ts";
import { custos } from "./tutoriais/custos.ts";
import { fatos } from "./tutoriais/fatos.ts";
import { gargalos } from "./tutoriais/gargalos.ts";
import { grupo } from "./tutoriais/grupo.ts";
import { home } from "./tutoriais/home.ts";
import { integracoes } from "./tutoriais/integracoes.ts";
import { kommoAutomacoes } from "./tutoriais/kommo-automacoes.ts";
import { kommoFases } from "./tutoriais/kommo-fases.ts";
import { kommo } from "./tutoriais/kommo.ts";
import { margem } from "./tutoriais/margem.ts";
import { metricas } from "./tutoriais/metricas.ts";
import { midia } from "./tutoriais/midia.ts";
import { pautas } from "./tutoriais/pautas.ts";
import { qrcode } from "./tutoriais/qrcode.ts";
import { redirects } from "./tutoriais/redirects.ts";
import { roadmap } from "./tutoriais/roadmap.ts";
import { saude } from "./tutoriais/saude.ts";
import { trafegoCampanhas } from "./tutoriais/trafego-campanhas.ts";
import { trafegoOrigem } from "./tutoriais/trafego-origem.ts";
import { trafego } from "./tutoriais/trafego.ts";
import { usuarios } from "./tutoriais/usuarios.ts";
import { visaoGeral } from "./tutoriais/visao-geral.ts";

/**
 * Todos os tutoriais do painel. Tutorial novo: um arquivo em `tutoriais/` e uma
 * linha aqui (veja `docs/como-usar.md`).
 */
export const TUTORIAIS: Tutorial[] = [hoje, registrarVenda, pedidosDoSite, vendasDaKommo, clientes, oportunidades, consulta, suporte, tutor, biblioteca, chat,
  // cartão 57
  fabrica,
  alteracoesNaLoja,
  avaliacoes,
  campanhas,
  funilDaKommo,
  lojas,
  pedidosDaLoja,
  produtos,
  recuperacao,
  redesAutomacoes,
  redesCalendario,
  redesComentarios,
  redesContas,
  redesConteudos,
  redesHoje,
  redesIdeias,
  redesPublicar,
  sugestoes,
  vendedores,

  // cartão 58
  anuncios, aparencia, autores, bio, calendario, comentarios, conector, conteudos, custos, fatos, gargalos, grupo, home, integracoes, kommoAutomacoes, kommoFases, kommo, margem, metricas, midia, pautas, qrcode, redirects, roadmap, saude, trafegoCampanhas, trafegoOrigem, trafego, usuarios, visaoGeral,
];

export function tutorialDaTela(href: string): Tutorial | null {
  return TUTORIAIS.find((t) => t.href === href) ?? null;
}
