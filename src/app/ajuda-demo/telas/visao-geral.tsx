import { andamentoDaMeta } from "@/lib/painel/meta";
import { contaDoMes } from "@/lib/custos/conta";
import type { Sinal } from "@/lib/painel/sinais";
import type { ResumoDeVendas } from "@/lib/vendas/dados";
import type { Area } from "@/lib/auth/acessos";
import { MetaDoMes } from "@/app/admin/(painel)/MetaDoMes";
import { Salas, type NumerosDasSalas } from "@/app/admin/(painel)/Salas";
import { ResultadoDoMes, type Resultado } from "@/app/admin/(painel)/ResultadoDoMes";
import { PainelGeral, type DadosDeVendas } from "@/app/admin/(painel)/PainelGeral";
import { ChatParaMim } from "@/app/admin/(painel)/ChatParaMim";
import type { Demo } from "../tipos";

const HOJE = "2026-11-19";
const AGORA = Date.parse("2026-11-19T15:00:00Z");

/** Trinta dias de vendas inventadas, valores redondos. */
const dia = (i: number) => new Date(Date.UTC(2026, 9, 21 + i, 12)).toISOString().slice(0, 10);
const VALORES = [2000, 3000, 2500, 4000, 1500, 3000, 2000, 3500, 2500, 3000, 2000, 4500, 3000, 2500, 2000, 3000, 3500, 2500, 4000, 3000, 2000, 2500, 3000, 3500, 2000, 3000, 4000, 2500, 3000, 3500];
const resumo = (fator: number): ResumoDeVendas => {
  const total = VALORES.reduce((s, v) => s + v, 0) * fator;
  return {
    totais: { pagos: Math.round(total / 1500), valor_pago: total, aguardando: 12, valor_aguardando: 18000, cancelados: 20, valor_cancelado: 30000, frete: 0, desconto: 0, clientes: 40, com_itens: 40 },
    por_dia: VALORES.map((v, i) => ({ dia: dia(i), pagos: Math.round((v * fator) / 1500), valor_pago: v * fator, aguardando: 0, valor_aguardando: 0, cancelados: 0, valor_cancelado: 0 })),
    por_hora: [],
    por_origem: [
      { origem: "google", pagos: 20, valor: total * 0.4, criados: 30 },
      { origem: "instagram", pagos: 15, valor: total * 0.35, criados: 25 },
      { origem: "", pagos: 10, valor: total * 0.25, criados: 15 },
    ],
    por_pagamento: [],
    produtos: [],
    pedidos: [],
  };
};

const vendas: DadosDeVendas = { atual: resumo(1), anterior: resumo(0.8), dias: 30, de: dia(0), ate: HOJE };

const sinais: Sinal[] = [
  { chave: "meta", gravidade: "atencao", peso: 20000, titulo: "A meta do mês está atrás do ritmo", texto: "No ritmo de agora o mês fecha abaixo da meta. Falta vender um pouco mais por dia.", link: { href: "/admin/vendas", rotulo: "Abrir as vendas" } },
  { chave: "cancelamento", gravidade: "problema", peso: 30000, titulo: "Muitos pedidos não viraram venda", texto: "Dois em cada cinco pedidos criados foram cancelados. A maioria travou no pagamento.", link: { href: "/admin/gargalos", rotulo: "Ver os gargalos" } },
  { chave: "recuperar", gravidade: "oportunidade", peso: 15000, titulo: "10 clientes para chamar na fila de recuperação", texto: "São pessoas que criaram pedido nos últimos 14 dias, não pagaram e ninguém chamou.", link: { href: "/admin/recuperacao", rotulo: "Abrir a fila" } },
];

const salasDaDiretoria: NumerosDasSalas = {
  vendas: { valor: "R$ 70.000", apoio: "em novembro, com 45 pedidos pagos na loja" },
  trafego: { valor: "R$ 15.000", apoio: "em anúncio nos últimos 30 dias" },
  fabrica: { valor: "12", apoio: "pedidos a produzir" },
  conteudo: { valor: "30", apoio: "conteúdos, 20 publicados" },
};

const andamento = andamentoDaMeta(120000, 70000, HOJE);
const resultado: Resultado = {
  hoje: HOJE, diasNoMes: 30, loja: 70000, porFora: 10000, pedidosPagos: 45,
  conta: contaDoMes({
    despesas: [
      { tipo: "mensal", categoria: "pessoas", valor: 30000, ativo: true },
      { tipo: "mensal", categoria: "plataformas", valor: 5000, ativo: true },
      { tipo: "por_pedido", categoria: "embalagem", valor: 20, ativo: true },
    ],
    hoje: HOJE, diasNoMes: 30, pedidosPagos: 45, anuncioReal: { gasto: 15000, dias: 18 },
  }),
  estimativas: 2, itens: 3,
};

const AREAS_DIRETORIA: Area[] = ["time", "consulta", "lancar_venda", "vendas", "suporte", "recuperacao", "trafego", "catalogo", "loja", "campanhas", "fabrica", "metricas", "anuncios", "margem", "custos", "conteudo", "site", "redes"];
const AREAS_TODOS: Area[] = ["time", "consulta", "lancar_venda", "trafego"];

const demo: Demo = {
  caminho: "/admin",
  desenho: (nivel) => {
    const diretoria = nivel === "gm";
    return (
      <div data-painel-largo>
        <header>
          <p className="eyebrow">Visão geral</p>
          <h1 className="font-display mt-2 text-4xl text-ink">Olá, {diretoria ? "Diretoria" : "Equipe"}</h1>
          <p className="mt-3 text-muted">Seu acesso é de {diretoria ? "GM" : "Tráfego"}. Aqui fica o que pede atenção hoje.</p>
        </header>
        {diretoria ? (
          <MetaDoMes andamento={andamento} hoje={HOJE} porFora={10000} acao={async () => { "use server"; }} />
        ) : null}
        <Salas areas={diretoria ? AREAS_DIRETORIA : AREAS_TODOS} numeros={diretoria ? salasDaDiretoria : { time: { valor: "2", apoio: "mensagens esperando você no chat" } }} />
        <ChatParaMim resumo={{ novas: 2, pedidos: 0, pedidosDoSetor: 0, desde: null }} agora={AGORA} />
        {diretoria ? <ResultadoDoMes r={resultado} /> : null}
        <PainelGeral vendas={diretoria ? vendas : null} sinais={sinais} />
      </div>
    );
  },
};
export default demo;
