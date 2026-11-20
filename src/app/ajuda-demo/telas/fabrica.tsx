import { TelaDaFabrica } from "@/app/admin/(painel)/fabrica/Tela";
import type { FilaDaFabrica, PedidoDaFabrica } from "@/lib/fabrica/dados";
import { ETAPAS_DE_FABRICA } from "@/lib/fabrica/etapas";
import type { Demo } from "../tipos";

const base: Omit<PedidoDaFabrica, "ref" | "pedido" | "dia" | "feitoEm" | "cliente" | "pecas" | "etapa" | "os"> = {
  tipo: "venda_nova", prioridade: "normal", prazo: null, pedidoOrigem: null, alteracoes: [], relato: null, loja: null, numeroPapel: null, fotos: [], transcricao: null,
  origem: "loja", statusDaLoja: "A ENVIAR", etapaEm: null, movidoPor: null, cidade: "Cidade Exemplo", uf: "SP",
  entrega: "Retirada na loja Exemplo", endereco: null, vendedor: null, rastreio: null, nota: null, kommo: null, desfeitoNaKommo: false,
};
const peca = (nome: string, info: string) => ({ nome, quantidade: 1, referencia: null, info, foto: null, miniatura: null });

const fila: FilaDaFabrica = {
  dias: 15,
  podeMover: true,
  etapas: ETAPAS_DE_FABRICA,
  pedidos: [
    { ...base, ref: "11001", pedido: 11001, os: 1001, dia: "2026-11-09", feitoEm: "2026-11-09T14:00:00Z", cliente: "Cliente Exemplo Um", etapa: "a_produzir", pecas: [peca("Par de alianças de ouro 18k", "Numeração: 12 e 20<br />Gravação a laser: Exemplo e Exemplo, 01.01.2026")] },
    { ...base, ref: "11003", pedido: 11003, os: 1003, prioridade: "urgente", tipo: "refazer", prazo: "2026-11-21", dia: "2026-11-14", feitoEm: "2026-11-14T11:00:00Z", cliente: "Cliente Exemplo Dois", entrega: "Correios", etapa: "a_produzir", pecas: [peca("Par de alianças de prata", "Numeração: 14 e 22")] },
    { ...base, ref: "10997", pedido: 10997, os: 1004, dia: "2026-11-16", feitoEm: "2026-11-16T16:00:00Z", cliente: "Cliente Exemplo Três", etapa: "a_produzir", pecas: [peca("Anel solitário", "Numeração: 15")] },
    { ...base, ref: "10993", pedido: 10993, os: 1002, dia: "2026-11-11", feitoEm: "2026-11-11T09:00:00Z", cliente: "Cliente Exemplo Quatro", etapa: "em_producao", etapaEm: "2026-11-13T09:00:00Z", movidoPor: "Fábrica Exemplo", pecas: [peca("Par de alianças de ouro 18k", "Numeração: 16 e 21")] },
  ],
};

const mover = async () => {
  "use server";
  return { ok: true as const };
};
const moverVarios = async () => {
  "use server";
  return { ok: true as const, movidos: 0, fora: 0 };
};
const ciente = async () => {
  "use server";
  return { ok: true as const };
};
const marcar = async () => {
  "use server";
  return { ok: true as const };
};

const demo: Demo = {
  caminho: "/admin/fabrica",
  desenho: () => <TelaDaFabrica fila={fila} etapa="a_produzir" dias={15} hoje="2026-11-19" mover={mover} moverVarios={moverVarios} marcar={marcar} ciente={ciente} />,
};
export default demo;
