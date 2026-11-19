import { TelaDeOrigem } from "@/app/admin/(painel)/trafego/origem/Tela";
import type { ChegadasPelaBio, PedidoComOrigem } from "@/lib/origem/pedidos";
import type { Demo } from "../tipos";

const base: PedidoComOrigem = {
  pedido: 0, feitoEm: "2026-11-18T14:00:00Z", dia: "2026-11-18", situacao: "pago", status: "Pedido Pago", total: 3000, etiqueta: null, ligado: true,
  canal: "meta", source: "facebook", medium: "paid_social", campaign: null, content: null, term: null, clique: "fbclid", entrada: "/", aparelho: "celular", chegouEm: "2026-11-18T13:30:00Z", chegadas: 1,
  plataforma: null, campanhaId: null, conjuntoId: null, anuncioId: null, campanhaNome: null, conjuntoNome: null, anuncioNome: null, campanhaPor: null, conjuntoPor: null, anuncioPor: null,
};

const exato: Partial<PedidoComOrigem> = {
  plataforma: "meta", campaign: "campanha-exemplo-vendas", term: "conjunto-exemplo-casais", content: "anuncio-exemplo-video",
  campanhaId: "c1", conjuntoId: "s1", anuncioId: "a1", campanhaNome: "Campanha Exemplo Vendas", conjuntoNome: "Conjunto Exemplo Casais", anuncioNome: "Anúncio Exemplo Vídeo",
  campanhaPor: "numero", conjuntoPor: "nome", anuncioPor: "nome",
};

const pedidos: PedidoComOrigem[] = [
  { ...base, pedido: 11001, total: 3000, ...exato },
  { ...base, pedido: 11003, total: 1500, feitoEm: "2026-11-17T11:00:00Z", dia: "2026-11-17", ...exato },
  { ...base, pedido: 10997, total: 2000, feitoEm: "2026-11-15T16:00:00Z", dia: "2026-11-15", plataforma: "meta", campaign: "campanha-exemplo-remarketing", campanhaId: "c2", campanhaNome: "Campanha Exemplo Remarketing", campanhaPor: "numero" },
  { ...base, pedido: 10995, total: 1500, feitoEm: "2026-11-14T10:00:00Z", dia: "2026-11-14", canal: "google_ads", source: "google", medium: "cpc", clique: "gclid", plataforma: "google", campaign: "campanha-exemplo-busca", campanhaId: "g1", campanhaNome: "Campanha Exemplo Busca", campanhaPor: "numero" },
  { ...base, pedido: 10993, total: 3000, feitoEm: "2026-11-13T09:00:00Z", dia: "2026-11-13", canal: "busca_google", source: "google", medium: "organic", clique: null },
  { ...base, pedido: 10990, total: 1000, feitoEm: "2026-11-12T09:00:00Z", dia: "2026-11-12", situacao: "cancelado", status: "Cancelado", ...exato },
];

const bio: ChegadasPelaBio = { chegadas: 100, visitantes: 80, deAnuncio: 20, visitantesDeAnuncio: 15, semAnuncio: 80, porCampanha: [{ campanha: "Campanha Exemplo Vendas", chegadas: 20, visitantes: 15 }] };

const demo: Demo = {
  caminho: "/admin/trafego/origem",
  desenho: () => <TelaDeOrigem pedidos={pedidos} bio={bio} de="2026-10-21" ate="2026-11-19" chave="30d" />,
};
export default demo;
