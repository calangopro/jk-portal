import { QuadroDaFabrica } from "@/app/admin/fabrica-quadro/Quadro";
import type { FilaDaFabrica, PedidoDaFabrica } from "@/lib/fabrica/dados";
import { ETAPAS_DE_FABRICA } from "@/lib/fabrica/etapas";
import type { Demo } from "../tipos";

const base: Omit<PedidoDaFabrica, "ref" | "pedido" | "os" | "dia" | "feitoEm" | "pecas" | "etapa"> = {
  tipo: "venda_nova", prioridade: "normal", prazo: null, origem: "loja", statusDaLoja: "A ENVIAR", etapaEm: "2026-11-19T12:00:00Z",
  movidoPor: null, cliente: null, cidade: null, uf: null, entrega: "Retire na loja do Shopping Exemplo", endereco: null, vendedor: null,
  rastreio: null, nota: null, kommo: null, desfeitoNaKommo: false,
};
const peca = (nome: string, info: string) => ({ nome, quantidade: 1, referencia: null, info, foto: null, miniatura: null });

const fila: FilaDaFabrica = {
  dias: 30,
  etapas: ETAPAS_DE_FABRICA,
  pedidos: [
    { ...base, ref: "11001", pedido: 11001, os: 1001, dia: "2026-11-15", feitoEm: "2026-11-15T14:00:00Z", etapa: "a_produzir", pecas: [peca("Par de alianças de ouro 18k", "Numeração - Aro 01: 12<br />Numeração - Aro 02: 20<br />Gravação - Aro 01: Exemplo, 01.01.2026")] },
    { ...base, ref: "11003", pedido: 11003, os: 1003, dia: "2026-11-17", feitoEm: "2026-11-17T11:00:00Z", etapa: "a_produzir", prioridade: "urgente", tipo: "refazer", prazo: "2026-11-20", entrega: "CORREIOS SEDEX", pecas: [peca("Solitário de prata 950", "Numeração - Aro 01: 15")] },
    { ...base, ref: "10997", pedido: 10997, os: 1004, dia: "2026-11-16", feitoEm: "2026-11-16T16:00:00Z", etapa: "em_producao", prazo: "2026-11-28", pecas: [peca("Par de alianças de prata", "Numeração - Aro 01: 14<br />Numeração - Aro 02: 22")] },
    { ...base, ref: "10993", pedido: 10993, os: 1002, dia: "2026-11-11", feitoEm: "2026-11-11T09:00:00Z", etapa: "gravacao", prioridade: "motoboy", nota: "Cliente pediu para conferir a data da gravação.", pecas: [peca("Par de alianças de ouro 18k", "Numeração - Aro 01: 16<br />Numeração - Aro 02: 21<br />Gravação - Aro 01: Exemplo Um<br />Gravação - Aro 02: Exemplo Dois")] },
    { ...base, ref: "10990", pedido: 10990, os: 1005, dia: "2026-11-10", feitoEm: "2026-11-10T09:00:00Z", etapa: "verificar", tipo: "polimento", pecas: [peca("Polimento de aliança", "Numeração - Aro 01: 18")] },
  ],
};

const mover = async () => {
  "use server";
  return { ok: true as const };
};

const demo: Demo = {
  caminho: "/admin/fabrica-quadro",
  desenho: () => <QuadroDaFabrica fila={fila} hoje="2026-11-19" so={[]} meuId={null} mover={mover} aoVivo={false} />,
};
export default demo;
