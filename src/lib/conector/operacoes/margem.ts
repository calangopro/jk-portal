import "server-only";
import { z } from "zod";
import { listarCatalogo } from "@/lib/catalogo/fotos";
import { margensDoCatalogo } from "@/lib/margem/dados";
import { limiteDeAnuncio, precoComDesconto } from "@/lib/margem/calculo";
import { operacao } from "../tipos";
import { painel } from "./apoio";

/**
 * Margem e limite de anúncio. Só administrador: o CPA máximo, junto do preço,
 * entrega o custo da peça, que é dado da empresa.
 */

const semAcento = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const dinheiro = (n: number) => Math.round(n * 100) / 100;

export const OPERACOES_MARGEM = [
  operacao({
    nome: "margem.limite_de_anuncio",
    resumo: "Quanto cada produto aguenta pagar de anúncio por venda (CPA máximo e ROAS mínimo) sem ficar abaixo da margem mínima.",
    detalhe:
      "cpa_maximo: o máximo por venda que ainda deixa a margem mínima (zero ou negativo: não anunciar neste preço). " +
      "cpa_empate: a partir daí é prejuízo. roas_minimo: o retorno que o anúncio precisa dar (5 = R$ 5 vendidos por R$ 1 de anúncio). " +
      "Sem desconto_pct, a conta usa o preço de hoje na loja; com ele, o preço cheio menos o desconto, em ,90, como numa campanha. " +
      "Produto sem custo cadastrado não entra (conta em sem_custo). Valores em reais.",
    entrada: z.object({
      produto: z.string().max(60).optional().describe("Código da Tray ou nome (parte do nome serve)."),
      categoria: z.string().max(80).optional().describe("Nome da categoria, ou parte dele."),
      desconto_pct: z.number().min(0).max(90).optional().describe("Cenário de campanha: desconto sobre o preço cheio."),
      ordem: z.enum(["folga", "roas", "vendidos"]).default("folga"),
      quantos: z.number().int().min(1).max(200).default(20),
    }),
    retorno:
      "{ margem_minima: number|null; cenario: string; itens: Array<{ produto, nome, categoria, preco, cpa_maximo, cpa_empate, roas_minimo: number|null, vendidos, painel }>; sem_custo: number }",
    risco: "leitura",
    soAdmin: true,
    async executar(a, ctx) {
      const itens = (await listarCatalogo(ctx.db)).filter((p) => p.disponivel);
      const { parametros, porProduto } = await margensDoCatalogo(ctx.db, itens);
      const termo = a.produto ? semAcento(a.produto.trim()) : "";
      const cat = a.categoria ? semAcento(a.categoria.trim()) : "";
      const escolhidos = itens.filter(
        (p) =>
          (!termo || p.trayId === a.produto?.trim() || semAcento(p.nome).includes(termo)) &&
          (!cat || semAcento(p.categoria).includes(cat)),
      );
      const comCusto = escolhidos.filter((p) => porProduto[p.id]?.custo !== null && (p.precoAntes ?? p.preco));
      const linhas = comCusto.map((p) => {
        const cheio = (p.precoAntes ?? p.preco)!;
        const preco = a.desconto_pct !== undefined ? precoComDesconto(cheio, a.desconto_pct / 100) : (p.preco ?? cheio);
        const l = limiteDeAnuncio(preco, porProduto[p.id].custo!, parametros);
        return {
          produto: p.trayId,
          nome: p.nome,
          categoria: p.categoria,
          preco: dinheiro(preco),
          cpa_maximo: dinheiro(l.cpaMaximo),
          cpa_empate: dinheiro(l.cpaEmpate),
          roas_minimo: l.roasMinimo === null ? null : Math.round(l.roasMinimo * 10) / 10,
          vendidos: p.vendidos,
          painel: painel(ctx, `/produtos?p=${p.trayId}`),
        };
      });
      const ordem = {
        folga: (x: (typeof linhas)[number], y: (typeof linhas)[number]) => y.cpa_maximo - x.cpa_maximo,
        roas: (x: (typeof linhas)[number], y: (typeof linhas)[number]) => (x.roas_minimo ?? Infinity) - (y.roas_minimo ?? Infinity),
        vendidos: (x: (typeof linhas)[number], y: (typeof linhas)[number]) => y.vendidos - x.vendidos,
      }[a.ordem];
      return {
        margem_minima: parametros.margemMinima,
        cenario: a.desconto_pct !== undefined ? `${a.desconto_pct}% sobre o preço cheio` : "preço de hoje na loja",
        itens: linhas.sort(ordem).slice(0, a.quantos),
        sem_custo: escolhidos.length - comCusto.length,
      };
    },
  }),
];
