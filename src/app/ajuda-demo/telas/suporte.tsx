import { PainelDoSuporte } from "@/app/admin/(painel)/suporte/Painel";
import { lerLista } from "@/lib/suporte/casos";
import type { Demo } from "../tipos";

/** Dois casos de exemplo: um na fila, com cliente esperando, e um que o suporte fechou com nota. Entra pelo leitor do banco, como na tela de verdade. */
const lista = (atende: boolean) =>
  lerLista({
    agora: "2026-11-19T13:00:00Z",
    atende,
    abre: true,
    casos: [
      {
        id: 2, assunto: "ajuste", relato: "Cliente quer ajustar o tamanho da aliança. Ela ficou grande no dedo.", urgente: true, estado: "na_fila",
        aberto_em: "2026-11-19T11:30:00Z", aberto_por: "a", aberto_por_nome: "Vendedor Exemplo", imagens: 1, visto: true,
        cliente: { nome: "Cliente Exemplo Um", telefone: "5511900000000", pedido: 11001, ref: "p11001", situacao: "pago", etapa: "em_producao" },
      },
      {
        id: 1, assunto: "pedra", relato: "Caiu uma pedra do anel de noivado.", urgente: false, estado: "resolvido",
        aberto_em: "2026-11-17T10:00:00Z", aberto_por: "a", aberto_por_nome: "Vendedor Exemplo", assumido_por: "g", assumido_por_nome: "Gerente Exemplo",
        assumido_em: "2026-11-17T11:00:00Z", fechado_por_nome: "Gerente Exemplo", fechado_em: "2026-11-18T09:00:00Z",
        nota: "Combinei de repor a pedra na loja do Centro. O cliente passa na sexta.", imagens: 0, visto: false,
        cliente: { nome: "Cliente Exemplo Dois", telefone: "5511900000001", pedido: 10997, ref: "p10997", situacao: "pago", etapa: "enviado" },
      },
    ],
  });

const demo: Demo = {
  caminho: "/admin/suporte",
  desenho: (nivel) => (
    <div>
      <header>
        <p className="eyebrow">Vendas</p>
        <h1 className="font-display mt-2 text-3xl text-ink sm:text-4xl">Suporte pós-venda</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
          {nivel === "vendas"
            ? "Assunto de pós-venda passa para o suporte: o gerente fala com o cliente e você volta a vender. Você é avisado quando o caso fechar."
            : "O que os vendedores passaram: assuma, fale com o cliente pelo WhatsApp e feche com uma nota, que é o que o vendedor lê."}
        </p>
      </header>
      <div className="mt-6">
        <PainelDoSuporte inicial={lista(nivel !== "vendas")} meuId={nivel === "vendas" ? "a" : "g"} />
      </div>
    </div>
  ),
};
export default demo;
