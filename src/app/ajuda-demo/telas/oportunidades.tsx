import { TelaDeOportunidades } from "@/app/admin/(painel)/oportunidades/Tela";
import type { ListaDeOportunidades } from "@/lib/clientes/dados";
import type { Demo } from "../tipos";

const dados: ListaDeOportunidades = {
  eu: "a",
  dias: 30,
  lista: [
    { ref: "p10850", tipo: "aniversario_namoro", ocorrencia: "2026-11-17", emDias: -2, origem: "ficha", motivo: "Aniversário de namoro, 2 anos", oferecer: "Um presente para comemorar a data", cliente: "Cliente Exemplo Um", fase: null, responsavelId: null, telefone: "(11) 90000-0000", cidade: "Cidade Exemplo", uf: "SP", responsavel: "Vendedor Exemplo" },
    { ref: "p11003", tipo: "casamento_chegando", ocorrencia: "2026-11-24", emDias: 5, origem: "ficha", motivo: "Casamento em 24/11, sem aliança de casamento comprada", oferecer: "O par de alianças de casamento", cliente: "Cliente Exemplo Dois", fase: null, responsavelId: null, telefone: "(11) 90000-0001", cidade: "Cidade Exemplo", uf: "RJ", responsavel: null },
    { ref: "p10997", tipo: "aniversario_cliente", ocorrencia: "2026-11-27", emDias: 8, origem: "ficha", motivo: "Aniversário do cliente em 27/11", oferecer: "Uma mensagem de parabéns", cliente: "Cliente Exemplo Três", fase: null, responsavelId: null, telefone: "(11) 90000-0002", cidade: "Cidade Exemplo", uf: "MG", responsavel: "Vendedor Exemplo" },
    { ref: "p10993", tipo: "um_ano_da_compra", ocorrencia: "2026-12-05", emDias: 16, origem: "compra", motivo: "Um ano da compra em 05/12", oferecer: "Convidar para polir a aliança na loja", cliente: "Cliente Exemplo Quatro", fase: null, responsavelId: null, telefone: "(11) 90000-0003", cidade: "Cidade Exemplo", uf: "SP", responsavel: null },
  ],
};

const demo: Demo = {
  caminho: "/admin/oportunidades",
  desenho: () => (
    <TelaDeOportunidades
      dados={dados}
      dias={30}
      marcar={async () => {
        "use server";
        return { ok: true as const };
      }}
    />
  ),
};
export default demo;
