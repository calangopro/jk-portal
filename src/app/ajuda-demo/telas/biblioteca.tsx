import { TelaDaBiblioteca } from "@/app/admin/(painel)/biblioteca/Tela";
import type { Resposta } from "@/lib/time/biblioteca";
import type { Demo } from "../tipos";

const r = (n: number, tema: Resposta["tema"], pergunta: string, explicacao: string, frase: string | null, estado: Resposta["estado"]): Resposta => ({
  id: `00000000-0000-4000-8000-00000000000${n}`, tema, pergunta, explicacao, frase, estado, origem: "Combinado do time", criadoPor: "a", criadoPorNome: "Vendedor Exemplo",
  criadoEm: "2026-11-10T10:00:00Z", confirmadoPorNome: estado === "confirmada" ? "Gerente Exemplo" : null, confirmadoEm: estado === "confirmada" ? "2026-11-11T10:00:00Z" : null,
  atualizadoEm: "2026-11-11T10:00:00Z", conversa: null,
});

const respostas: Resposta[] = [
  r(1, "pos_venda", "A aliança de prata escurece?", "Pode escurecer com o tempo. Dá para polir na loja. Explique antes de o cliente comprar.", "A prata pode escurecer com o tempo, é normal. É só trazer em uma de nossas lojas para polir.", "confirmada"),
  r(2, "estoque_prazo", "Quanto tempo leva para ficar pronta?", "O prazo vem escrito em cada produto. Confira o produto na Consulta antes de prometer data.", "O prazo de produção está na página de cada aliança. Posso conferir o da sua peça agora.", "confirmada"),
  r(3, "gravacao_produto", "Dá para gravar um desenho na aliança?", "Gravação a laser aceita texto. Desenho depende da JK confirmar.", null, "a_confirmar"),
  r(4, "troca", "O cliente quer trocar uma peça com gravação", "Peça gravada tem regra própria. Chame o gerente antes de responder.", null, "a_confirmar"),
];

const demo: Demo = {
  caminho: "/admin/biblioteca",
  desenho: (nivel) => (
    <TelaDaBiblioteca
      respostas={respostas}
      admin={nivel === "gm"}
      meuId="a"
      sugerir={async () => {
        "use server";
        return { ok: true as const };
      }}
      editar={async () => {
        "use server";
        return { ok: true as const };
      }}
      definirEstado={
        nivel !== "gm"
          ? undefined
          : async () => {
              "use server";
              return { ok: true as const };
            }
      }
    />
  ),
};
export default demo;
