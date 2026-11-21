import "server-only";
import { cache } from "react";
import { ehAdmin } from "@/lib/auth/acessos";
import { requireSessao, type Profile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { lerLojasFisicas, lerOportunidades } from "@/lib/clientes/dados";
import { DIAS_DO_AVISO } from "@/lib/clientes/oportunidades";
import { contaDoMes } from "@/lib/custos/conta";
import { lerDespesas } from "@/lib/custos/dados";
import { lerFilaDaFabrica } from "@/lib/fabrica/dados";
import { DIAS_DE_ATRASO, diasEntreDatas, tomDaEspera } from "@/lib/fabrica/etapas";
import { PRAZOS_DA_KOMMO, sinaisDaKommo, type AlertasDaKommo } from "@/lib/kommo/funil";
import { andamentoDaMeta, diasDoMes, type Andamento } from "@/lib/painel/meta";
import { sinaisDaSaude } from "@/lib/painel/saude";
import { lerSaude } from "@/lib/painel/saude-dados";
import { calcularSinais, type EntradaDosSinais, type Sinal } from "@/lib/painel/sinais";
import { lerMeuMesNoServidor } from "@/lib/pedidos/dados";
import { nomeDoMes, totalDoMes } from "@/lib/pedidos/do-site";
import { SEM_RESUMO_DO_SUPORTE } from "@/lib/suporte/casos";
import { lerResumoDoSuporteNoServidor } from "@/lib/suporte/dados";
import { SEM_RESUMO, esperandoPorMim as esperandoNoChat } from "@/lib/time/chat";
import { lerResumoDoChat } from "@/lib/time/dados";
import { lerResumoDeGasto } from "@/lib/trafego/dados";
import { retornoPorPlataforma } from "@/lib/trafego/retorno";
import { lerResumoDeVendas, ultimaImportacao } from "@/lib/vendas/dados";
import { agruparPorCanal } from "@/lib/vendas/origem";
import { hojeEmSaoPaulo, primeiroDoMes, somarDias } from "@/lib/vendas/periodo";
import { lerResumoPorFora } from "@/lib/vendas/por-fora";
import { lerFilaDeRecuperacao } from "@/lib/vendas/recuperacao";
import type { DadosDeVendas } from "./PainelGeral";
import type { Resultado } from "./ResultadoDoMes";
import type { NumerosDasSalas } from "./Salas";

/**
 * As leituras da Visão geral, uma por função e guardadas por pedido (`cache`).
 *
 * A tela era UMA espera só: nada aparecia até a leitura mais lenta voltar
 * (alertas da Kommo, saúde das ligações, oportunidades), e num dia ruim isso
 * passava de um segundo. Agora cada bloco da tela é um componente com o próprio
 * `Suspense`, e pede só o que usa. Dois blocos que pedem a mesma leitura
 * recebem a mesma resposta, porque o `cache` do React vale para o pedido
 * inteiro (cartão 76). As regras de quem lê o quê são as de antes: cada leitura
 * só acontece com a área liberada, e o banco confere de novo.
 */

/** Quantos dias o painel compara: os últimos 30 contra os 30 anteriores. */
export const DIAS = 30;

const perfil = (): Promise<Profile> => requireSessao();
const db = cache(() => createClient());
const datas = cache(() => {
  const hoje = hojeEmSaoPaulo();
  return { hoje, de: somarDias(hoje, -(DIAS - 1)), mes: primeiroDoMes(hoje) };
});
async function pode(area: Profile["areas"][number]) {
  return (await perfil()).areas.includes(area);
}
async function souAdmin() {
  return ehAdmin((await perfil()).role);
}

export const vendasAtual = cache(async () => ((await pode("vendas")) ? lerResumoDeVendas(await db(), datas().de, datas().hoje) : null));
export const vendasAnterior = cache(async () => {
  if (!(await pode("vendas"))) return null;
  const { de } = datas();
  return lerResumoDeVendas(await db(), somarDias(de, -DIAS), somarDias(de, -1));
});
const ultimaLeitura = cache(async () => ((await pode("vendas")) ? ultimaImportacao(await db()) : null));
const filaDeRecuperacao = cache(async () => ((await pode("recuperacao")) ? lerFilaDeRecuperacao(await db(), 14) : null));
const despesas = cache(async () => ((await souAdmin()) ? lerDespesas(await db()) : null));
export const vendasDoMes = cache(async () => ((await pode("vendas")) ? lerResumoDeVendas(await db(), datas().mes, datas().hoje) : null));
const metaDoMes = cache(async () => {
  if (!(await pode("vendas"))) return 0;
  const { data } = await (await db()).from("metas").select("valor").eq("mes", datas().mes).maybeSingle();
  return Number(data?.valor ?? 0);
});
export const porForaNoMes = cache(async () => ((await pode("vendas")) ? ((await lerResumoPorFora(await db(), datas().mes, datas().hoje))?.valor ?? 0) : 0));
const gasto = cache(async () => ((await pode("trafego")) ? lerResumoDeGasto(await db(), datas().de, datas().hoje) : null));
const gastoDoMes = cache(async () => ((await souAdmin()) ? lerResumoDeGasto(await db(), datas().mes, datas().hoje) : null));
export const oportunidades = cache(async () => {
  if (!(await pode("lancar_venda"))) return [];
  const lojas = await lerLojasFisicas();
  return (await lerOportunidades(await db(), datas().hoje, DIAS_DO_AVISO, lojas))?.lista ?? [];
});
const alertasDaKommo = cache(async () => {
  if (!(await pode("vendas"))) return null;
  const r = await (await db()).rpc("kommo_alertas", { p_atencao_min: PRAZOS_DA_KOMMO.atencao, p_ruim_min: PRAZOS_DA_KOMMO.ruim });
  return (r.data ?? null) as AlertasDaKommo | null;
});
const saude = cache(async () => ((await souAdmin()) ? lerSaude(await db()) : null));
const filaDaFabrica = cache(async () => ((await pode("fabrica")) ? lerFilaDaFabrica(await db(), 15) : null));
export const chat = cache(async () => ((await pode("time")) ? lerResumoDoChat(await db()) : SEM_RESUMO));
export const suporte = cache(async () =>
  (await pode("lancar_venda")) || (await pode("suporte")) ? lerResumoDoSuporteNoServidor(await db()) : SEM_RESUMO_DO_SUPORTE,
);
export const meuMes = cache(async () => ((await pode("lancar_venda")) ? lerMeuMesNoServidor(await db()) : null));
export const conteudo = cache(async () => {
  if (!(await pode("conteudo"))) return null;
  const c = await db();
  const [contents, published, media, products, pendingComments] = await Promise.all([
    c.from("contents").select("*", { count: "exact", head: true }),
    c.from("contents").select("*", { count: "exact", head: true }).eq("status", "published"),
    c.from("media").select("*", { count: "exact", head: true }),
    c.from("products").select("*", { count: "exact", head: true }),
    c.from("comments").select("*", { count: "exact", head: true }).eq("status", "pending"),
  ]);
  return [
    { label: "Conteúdos", value: contents.count ?? 0, hint: `${published.count ?? 0} publicados`, href: "/admin/conteudos" },
    { label: "Imagens", value: media.count ?? 0, hint: "biblioteca de mídia", href: "/admin/midia" },
    { label: "Produtos", value: products.count ?? 0, hint: "sincronizados da Tray", href: "/admin/produtos" },
    { label: "Comentários", value: pendingComments.count ?? 0, hint: "aguardando moderação", href: "/admin/comentarios" },
  ];
});

/** Começa todas as leituras de uma vez, antes de a tela desenhar o primeiro bloco. */
export function comecarLeituras() {
  for (const f of [vendasAtual, vendasAnterior, ultimaLeitura, filaDeRecuperacao, despesas, vendasDoMes, metaDoMes, porForaNoMes, gasto, gastoDoMes, oportunidades, alertasDaKommo, saude, filaDaFabrica, chat, suporte, meuMes, conteudo]) {
    void f().catch(() => null);
  }
}

/** O faturamento do mês é a loja mais o que foi registrado por fora dela. */
export const faturamentoDoMes = cache(async () => {
  const [doMes, porFora] = await Promise.all([vendasDoMes(), porForaNoMes()]);
  return doMes ? Number(doMes.totais.valor_pago) + porFora : 0;
});

export const andamento = cache(async (): Promise<Andamento | null> => {
  const [doMes, valor, faturamento] = await Promise.all([vendasDoMes(), metaDoMes(), faturamentoDoMes()]);
  return doMes && valor > 0 ? andamentoDaMeta(valor, faturamento, datas().hoje) : null;
});

const contaDeCustos = cache(async () => {
  const [lista, doMes, gastoMes, porFora, faturamento] = await Promise.all([despesas(), vendasDoMes(), gastoDoMes(), porForaNoMes(), faturamentoDoMes()]);
  if (!lista || !doMes) return null;
  const { hoje } = datas();
  // A mesma conta da tela de custos: com gasto de anúncio lançado, ele entra no lugar da estimativa.
  const conta = contaDoMes({
    despesas: lista,
    hoje,
    diasNoMes: diasDoMes(hoje),
    pedidosPagos: doMes.totais.pagos,
    anuncioReal: gastoMes ? { gasto: gastoMes.gasto, dias: gastoMes.dias_com_gasto } : null,
  });
  const ativos = lista.filter((d) => d.ativo);
  const custos: EntradaDosSinais["custos"] = { custoAteHoje: conta.total, faturamento };
  const resultado: Resultado = {
    hoje,
    diasNoMes: diasDoMes(hoje),
    loja: Number(doMes.totais.valor_pago),
    porFora,
    pedidosPagos: doMes.totais.pagos,
    conta,
    estimativas: ativos.filter((d) => !d.confirmado).length,
    itens: ativos.length,
  };
  return { custos, resultado };
});

export const resultadoDoMes = cache(async () => (await contaDeCustos())?.resultado ?? null);

export const dadosDeVendas = cache(async (): Promise<DadosDeVendas | null> => {
  const [atual, anterior] = await Promise.all([vendasAtual(), vendasAnterior()]);
  const { de, hoje } = datas();
  return atual ? { atual, anterior, dias: DIAS, de, ate: hoje } : null;
});

const GRAVIDADE = { problema: 0, atencao: 1, oportunidade: 2, bom: 3 } as const;

/** Os avisos do painel: ligação quebrada na frente, depois vendas e Kommo por gravidade. */
export const avisos = cache(async (): Promise<Sinal[]> => {
  const [atual, anterior, fila, custos, meta, g, ultima, kommo, ligacoes] = await Promise.all([
    vendasAtual(),
    vendasAnterior(),
    filaDeRecuperacao(),
    contaDeCustos().then((c) => c?.custos ?? null),
    andamento(),
    gasto(),
    ultimaLeitura(),
    alertasDaKommo(),
    saude(),
  ]);
  const aRecuperar = fila?.resumo.a_recuperar;
  const canaisDeAgora = atual ? agruparPorCanal(atual.por_origem) : [];
  const sinaisDeVendas: Sinal[] = atual
    ? calcularSinais({
        atual: { ...atual, canais: canaisDeAgora },
        anterior: anterior ? { ...anterior, canais: agruparPorCanal(anterior.por_origem) } : null,
        dias: DIAS,
        recuperar: aRecuperar ? { clientes: aRecuperar.clientes, valor: Number(aRecuperar.valor) } : null,
        custos,
        meta,
        anuncios: g ? { gasto: g.gasto, linhas: retornoPorPlataforma(g.por_plataforma, canaisDeAgora) } : null,
        horasDesdeALeitura: ultima ? (Date.now() - Date.parse(ultima.quando)) / 3_600_000 : null,
      })
    : aRecuperar && aRecuperar.clientes > 0
      ? [
          {
            chave: "fila-de-recuperacao",
            gravidade: "oportunidade" as const,
            peso: Number(aRecuperar.valor),
            titulo: `${aRecuperar.clientes} ${aRecuperar.clientes === 1 ? "cliente" : "clientes"} para chamar na fila de recuperação`,
            texto: "São pessoas que criaram pedido na loja nos últimos 14 dias, não pagaram e ninguém chamou. A fila está por ordem de valor.",
            link: { href: "/admin/recuperacao", rotulo: "Abrir a fila" },
          },
        ]
      : [];
  const sinais = [...sinaisDeVendas, ...sinaisDaKommo(kommo)].sort((a, b) => GRAVIDADE[a.gravidade] - GRAVIDADE[b.gravidade] || b.peso - a.peso);
  return ligacoes ? [...sinaisDaSaude(ligacoes), ...sinais] : sinais;
});

/** O bloco do vendedor aparece para quem vende e não vê o faturamento, e para quem vê mas vendeu alguma coisa no mês. */
export const mostrarMeuMes = cache(async () => {
  const m = await meuMes();
  return m !== null && (!(await pode("vendas")) || totalDoMes(m) > 0);
});

/** O número de cada sala, para os cartões de setor. Só entra o que foi lido. */
export const numerosDasSalas = cache(async (): Promise<NumerosDasSalas> => {
  const [doMes, faturamento, g, m, resumoDoChat, c, fila] = await Promise.all([
    vendasDoMes(),
    faturamentoDoMes(),
    gasto(),
    meuMes(),
    chat(),
    conteudo(),
    filaDaFabrica(),
  ]);
  const { hoje } = datas();
  const dinheiro = (n: number) => `R$ ${Math.round(n).toLocaleString("pt-BR")}`;
  const mes = new Date(`${hoje}T12:00:00`).toLocaleDateString("pt-BR", { month: "long" });
  const salas: NumerosDasSalas = {};
  if (doMes) {
    salas.vendas = {
      valor: dinheiro(faturamento),
      apoio: `em ${mes}, com ${doMes.totais.pagos} ${doMes.totais.pagos === 1 ? "pedido pago" : "pedidos pagos"} na loja`,
    };
  }
  if (g) salas.trafego = { valor: dinheiro(g.gasto), apoio: `em anúncio nos últimos ${DIAS} dias` };
  if (m && !salas.vendas && totalDoMes(m) > 0) {
    salas.vendas = { valor: dinheiro(totalDoMes(m)), apoio: `vendidos por você em ${nomeDoMes(m.mes)}` };
  }
  const esperando = esperandoNoChat(resumoDoChat);
  if (esperando > 0) {
    salas.time = {
      valor: esperando.toLocaleString("pt-BR"),
      apoio: esperando === 1 ? "mensagem esperando você no chat" : "mensagens esperando você no chat",
    };
  }
  if (c) {
    const [posts, , produtos] = c;
    salas.conteudo = { valor: posts.value.toLocaleString("pt-BR"), apoio: `conteúdos, ${posts.hint}` };
    salas.loja = { valor: produtos.value.toLocaleString("pt-BR"), apoio: "produtos espelhados da loja" };
  }
  // A sala da fábrica mostra o que está parado esperando começar.
  if (fila) {
    const aProduzir = fila.pedidos.filter((p) => p.etapa === "a_produzir");
    const tarde = aProduzir.filter((p) => tomDaEspera(diasEntreDatas(p.dia, hoje), p.etapa) === "ruim").length;
    salas.fabrica = {
      valor: aProduzir.length.toLocaleString("pt-BR"),
      apoio: `${aProduzir.length === 1 ? "pedido a produzir" : "pedidos a produzir"}${tarde > 0 ? `, ${tarde} há ${DIAS_DE_ATRASO} dias ou mais` : ""}`,
    };
  }
  return salas;
});

/** Sem nada para mostrar: a frase que diz onde fica o trabalho. */
export const semNada = cache(async () => {
  const [vendas, sinais, c, ops, ligacoes, resumoDoChat, sup, meu] = await Promise.all([
    dadosDeVendas(),
    avisos(),
    conteudo(),
    oportunidades(),
    saude(),
    chat(),
    suporte(),
    mostrarMeuMes(),
  ]);
  return !vendas && sinais.length === 0 && !c && ops.length === 0 && !ligacoes && esperandoNoChat(resumoDoChat) === 0 && sup.fila + sup.comigo + sup.novidades === 0 && !meu;
});

export { datas };
