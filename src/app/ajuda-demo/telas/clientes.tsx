import { TelaDeClientes } from "@/app/admin/(painel)/clientes/Tela";
import type { ResumoDoCliente } from "@/lib/clientes/dados";
import type { Demo } from "../tipos";

const c = (ref: string, nome: string, pagos: number, ultima: string, extra: Partial<ResumoDoCliente> = {}): ResumoDoCliente => ({
  ref, nome, telefone: null, email: null, cidade: "Cidade Exemplo", uf: "SP", pedidosPagos: pagos, pedidosNaoPagos: 0, vendasPorFora: 0,
  ultimaCompra: ultima, noGrupo: false, fase: null, responsavelId: null, responsavel: null, ...extra,
});

const recentes = [
  c("p11001", "Cliente Exemplo Um", 1, "2026-11-18"),
  c("p11003", "Cliente Exemplo Dois", 1, "2026-11-17", { fase: "namoro" }),
  c("p10997", "Cliente Exemplo Três", 2, "2026-11-15", { fase: "noivado", noGrupo: true }),
  c("p10993", "Cliente Exemplo Quatro", 1, "2026-11-13"),
];
const meus = [c("p10990", "Cliente Exemplo Cinco", 1, "2026-11-10", { fase: "casamento_marcado", responsavel: "Vendedor Exemplo" })];

const demo: Demo = {
  caminho: "/admin/clientes",
  desenho: () => (
    <TelaDeClientes
      buscar={async () => {
        "use server";
        return recentes;
      }}
      recentes={recentes}
      meus={meus}
    />
  ),
};
export default demo;
