import { TelaNaFabrica } from "@/app/admin/(painel)/na-fabrica/Tela";
import type { FilaDaFabrica, PedidoDaFabrica } from "@/lib/fabrica/dados";
import { ETAPAS_DE_FABRICA } from "@/lib/fabrica/etapas";
import type { Demo } from "../tipos";

const base: Omit<PedidoDaFabrica, "ref" | "pedido" | "os" | "dia" | "feitoEm" | "pecas" | "etapa" | "cliente"> = {
  tipo: "venda_nova", prioridade: "normal", prazo: null, pedidoOrigem: null, alteracoes: [], origem: "loja", statusDaLoja: "A ENVIAR",
  etapaEm: "2026-11-19T12:00:00Z", movidoPor: null, cidade: null, uf: null, entrega: "Retire na loja do Shopping Exemplo", endereco: null,
  vendedor: null, rastreio: null, nota: null, kommo: null, desfeitoNaKommo: false,
};
const peca = (nome: string) => ({ nome, quantidade: 1, referencia: null, info: null, foto: null, miniatura: null });

const fila: FilaDaFabrica = {
  dias: 60,
  podeMover: false,
  etapas: ETAPAS_DE_FABRICA,
  pedidos: [
    { ...base, ref: "11001", pedido: 11001, os: 1001, dia: "2026-11-15", feitoEm: "2026-11-15T14:00:00Z", cliente: "Cliente Exemplo Um", etapa: "gravacao", pecas: [peca("Par de alianças de ouro 18k")],
      alteracoes: [{ id: 1, texto: "Trocar a gravação do aro 02", em: "2026-11-19T13:00:00Z", por: "Vendedor", cienteEm: null, cientePor: null }] },
    { ...base, ref: "a00000000-0000-4000-8000-000000000001", origem: "avulso", pedido: null, pedidoOrigem: 10990, os: 1005, tipo: "polimento", dia: "2026-11-18", feitoEm: "2026-11-18T09:00:00Z", cliente: "Cliente Exemplo Dois", etapa: "a_produzir", vendedor: "Vendedor", pecas: [peca("Polimento de aliança")] },
    { ...base, ref: "10993", pedido: 10993, os: 1002, dia: "2026-11-11", feitoEm: "2026-11-11T09:00:00Z", cliente: "Cliente Exemplo Três", etapa: "enviado", rastreio: "AA123456789BR", pecas: [peca("Solitário de prata")] },
  ],
};

const abrir = async () => {
  "use server";
  return { ok: true as const, os: 1006 };
};
const pedirAlteracao = async () => {
  "use server";
  return { ok: true as const };
};

const demo: Demo = {
  caminho: "/admin/na-fabrica",
  desenho: () => <TelaNaFabrica fila={fila} hoje="2026-11-19" produtos={[]} lojas={["Shopping Exemplo"]} abrir={abrir} pedirAlteracao={pedirAlteracao} />,
};
export default demo;
