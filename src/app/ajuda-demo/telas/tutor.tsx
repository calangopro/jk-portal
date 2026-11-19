import { TelaDoTutor } from "@/app/admin/(painel)/tutor/Tela";
import type { Demo } from "../tipos";

const demo: Demo = {
  caminho: "/admin/tutor",
  desenho: () => (
    <TelaDoTutor
      semResposta={null}
      perguntar={async () => {
        "use server";
        // Uma resposta de exemplo, para o print do Tutor respondendo. Nada aqui chama o modelo de linguagem.
        return {
          ok: true as const,
          resposta: {
            pergunta: "O cliente pergunta se a aliança de prata escurece e como cuidar.",
            respondeu: true,
            paraOVendedor: "Prata pode escurecer com o tempo e com o contato com produtos de limpeza. Explique que dá para polir na loja e que é bom guardar a peça seca.",
            fraseParaOCliente: "A prata pode escurecer com o tempo, é normal. Se isso acontecer, você pode trazer a aliança em uma de nossas lojas para polir. Para cuidar no dia a dia, guarde seca e longe de produtos de limpeza.",
            fontes: [{ id: "r1", pergunta: "A aliança de prata escurece?", explicacao: "Pode escurecer. Dá para polir na loja.", frase: null, confirmada: true }],
            temFonteAConfirmar: false,
            leitura: null,
            produtos: [],
          },
        };
      }}
    />
  ),
};
export default demo;
