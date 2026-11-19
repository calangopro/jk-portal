import { TelaDaFicha } from "@/app/admin/(painel)/clientes/[ref]/TelaDaFicha";
import type { FichaDoCliente } from "@/lib/clientes/dados";
import type { DadosDaLinha } from "@/lib/clientes/linha-do-tempo";
import type { Demo } from "../tipos";

/** A ficha de um cliente de exemplo: dois pedidos, uma venda por fora, o cadastro no grupo e um negócio na Kommo. */
const ficha: FichaDoCliente = {
  ref: "p11001", nome: "Cliente Exemplo Um", telefone: "(11) 90000-0000", email: null, cidade: "Cidade Exemplo", uf: "SP",
  pedidosPagos: 2, pedidosNaoPagos: 0, vendasPorFora: 1, ultimaCompra: "2026-11-18", noGrupo: true, fase: "noivado", responsavelId: "a", responsavel: "Vendedor Exemplo",
  eu: "a",
  ficha: {
    fase: "noivado", parNome: "Par Exemplo", aniversario: null, aniversarioPar: null, dataNamoro: "2024-03-10", dataCasamento: null, datasRecusadas: [],
    anotacoes: "Prefere atendimento à tarde.", responsavelId: "a", atualizadoEm: "2026-11-10T12:00:00Z", atualizadoPor: "Vendedor Exemplo",
  },
  pedidos: [
    { pedido: 11001, feitoEm: "2026-11-18T14:00:00Z", dia: "2026-11-18", status: "A ENVIAR", situacao: "pago", total: 3000, pagamento: "Pix", frete: "Retirada em loja", cidade: "Cidade Exemplo", uf: "SP", rastreio: null, itens: [{ nome: "Par de alianças de ouro 18k", quantidade: 1, preco: 3000, referencia: null, info: null }] },
    { pedido: 10850, feitoEm: "2026-08-20T10:00:00Z", dia: "2026-08-20", status: "ENTREGUE", situacao: "pago", total: 1500, pagamento: "Cartão", frete: "Correios", cidade: "Cidade Exemplo", uf: "SP", rastreio: "XX000000000BR", itens: [{ nome: "Par de alianças de namoro de prata", quantidade: 1, preco: 1500, referencia: null, info: null }] },
  ],
  porFora: [{ id: "v1", dia: "2026-09-12", valor: 1200, forma: "pix", canal: "whatsapp", produto: "Anel solitário", vendedor: "Vendedor Exemplo", estornada: false }],
  cadastros: [{ criadoEm: "2026-07-01T10:00:00Z", origem: "bio", campanha: null, momento: null, entrouNoGrupoEm: "2026-07-01T10:30:00Z" }],
  recuperacao: [],
  marcadas: [],
  historico: [],
  equipe: [{ id: "a", nome: "Vendedor Exemplo" }, { id: "b", nome: "Vendedora Exemplo" }],
};

const linha: DadosDaLinha = {
  kommo: {
    lidoEm: "2026-11-19T12:00:00Z", contatos: 1,
    negocios: [{
      id: 1001, nome: "Negócio Exemplo Um", funil: "Vendas", etapa: "Venda ganha", fase: "ganho", aberto: false, ganho: true, perdido: false, apagado: false,
      etapaDesde: "2026-11-18T14:00:00Z", criadoEm: "2026-11-10T10:00:00Z", fechadoEm: "2026-11-18T14:00:00Z", esperandoDesde: null,
      responsavel: "Vendedor Exemplo", pessoa: "Vendedor Exemplo", meu: true, valor: 3000, pedidoTray: "11001", link: "#",
    }],
    eventos: [
      { id: "e1", tipo: "lead_added", em: "2026-11-10T10:00:00Z", negocio: 1001, quem: "Vendedor Exemplo", robo: false, etapaDe: null, etapaPara: { funil: "Vendas", etapa: "Novo contato" }, responsavelPara: null },
      { id: "e2", tipo: "lead_status_changed", em: "2026-11-18T14:00:00Z", negocio: 1001, quem: "Vendedor Exemplo", robo: false, etapaDe: { funil: "Vendas", etapa: "Em negociação" }, etapaPara: { funil: "Vendas", etapa: "Venda ganha" }, responsavelPara: null },
    ],
  },
  pedidos: [
    { pedido: 11001, origem: null, eventos: [{ tipo: "criado", em: "2026-11-18T13:50:00Z" }, { tipo: "pago", dia: "2026-11-18" }, { tipo: "fabrica", em: "2026-11-19T09:00:00Z", de: null, para: "em_producao", quem: "Fábrica Exemplo" }] },
  ],
  vendas: [],
};

const demo: Demo = {
  caminho: "/admin/clientes",
  desenho: (nivel) => (
    <TelaDaFicha
      f={ficha}
      sugestoes={[]}
      oportunidades={[]}
      hoje="2026-11-19"
      linha={linha}
      agora={Date.parse("2026-11-19T13:00:00Z")}
      areas={nivel === "vendas" ? ["time", "lancar_venda"] : ["time", "lancar_venda", "vendas", "recuperacao"]}
      podeVerRecuperacao={nivel !== "vendas"}
      salvar={async () => {
        "use server";
        return { ok: true as const };
      }}
      marcar={async () => {
        "use server";
        return { ok: true as const };
      }}
    />
  ),
};
export default demo;
