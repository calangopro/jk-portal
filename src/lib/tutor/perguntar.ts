import "server-only";
import { MODELO_RAPIDO, cliente, pedirJson } from "@/lib/analyzer/openai";
import type { ProdutoDaConsulta } from "@/lib/consulta/dados";
import type { RespostaProxima } from "@/lib/time/biblioteca";
import { quandoFica, type RegrasDeEntrega } from "@/lib/vendas/prazos";
import {
  ESQUEMA_DA_LEITURA, ESQUEMA_DA_RESPOSTA, INSTRUCAO_DA_LEITURA, INSTRUCAO_DA_RESPOSTA, SEM_RESPOSTA, conferirSaida, montarPergunta, produtosDoTexto,
  type FonteDoTutor, type LeituraDoPrint, type ProdutoDoTutor, type RespostaDoTutor, type SaidaDoModelo,
} from "./regras";

/**
 * O tutor do vendedor, do lado do servidor: lê o print, junta o que a casa já
 * respondeu e o que o catálogo diz, e pede ao modelo uma resposta presa a isso.
 *
 * São no máximo duas chamadas ao modelo: uma para ler a imagem (só quando há
 * print) e uma para responder. Sem nenhuma resposta da casa e nenhum produto
 * que trate da dúvida, a segunda nem acontece: o tutor diz que não sabe.
 *
 * A imagem vai para o modelo e NÃO é guardada em lugar nenhum. O que se guarda
 * é a dúvida em uma frase.
 *
 * As leituras (biblioteca e catálogo) vêm de fora, como funções, para o tutor
 * poder ser exercitado em desenvolvimento sem sessão.
 */

export type Leituras = {
  /** As respostas da Biblioteca JK mais próximas de um texto. */
  respostas: (texto: string) => Promise<RespostaProxima[]>;
  /** O catálogo, para achar o produto citado. */
  catalogo: () => Promise<ProdutoDaConsulta[] | null>;
  /** O dia de hoje e as regras do malote: com elas, o tutor leva a data da MESMA conta da Consulta, em vez de estimar. */
  entrega: { hoje: string; regras: RegrasDeEntrega };
};

export type ResultadoDoTutor = RespostaDoTutor & { leitura: LeituraDoPrint | null; produtos: ProdutoDoTutor[]; pergunta: string };

/** Lê o print com o modelo. Detalhe alto: print de celular tem letra pequena, e em baixa resolução o texto não se lê. */
async function lerPrint(imagem: string): Promise<LeituraDoPrint> {
  const resp = await cliente().chat.completions.create({
    model: MODELO_RAPIDO,
    // Ler o que está escrito não pede raciocínio: o esforço mínimo responde na metade do tempo.
    reasoning_effort: "minimal",
    max_completion_tokens: 900,
    messages: [
      { role: "system", content: INSTRUCAO_DA_LEITURA },
      { role: "user", content: [{ type: "text", text: "Leia o print." }, { type: "image_url", image_url: { url: imagem, detail: "high" } }] },
    ],
    response_format: { type: "json_schema", json_schema: { name: "leitura_do_print", strict: true, schema: ESQUEMA_DA_LEITURA as unknown as Record<string, unknown> } },
  });
  const bruto = resp.choices[0]?.message?.content;
  if (!bruto) throw new Error("O modelo não conseguiu ler a imagem.");
  const l = JSON.parse(bruto) as { e_conversa: boolean; pergunta_do_cliente: string; produto: string; detalhes: string };
  const limpo = (s: string, max: number) => String(s ?? "").replace(/\s*[—–]\s*/g, ", ").trim().slice(0, max);
  return { eConversa: l.e_conversa === true, pergunta: limpo(l.pergunta_do_cliente, 400), produto: limpo(l.produto, 160) || null, detalhes: limpo(l.detalhes, 300) || null };
}

export async function perguntarAoTutor(a: { duvida: string; imagem: string | null }, ler: Leituras): Promise<ResultadoDoTutor> {
  const duvida = a.duvida.trim().slice(0, 600);
  const leitura = a.imagem ? await lerPrint(a.imagem) : null;

  // A busca na biblioteca usa as duas coisas: o que a pessoa escreveu e o que o print mostra.
  const texto = [duvida, leitura?.pergunta, leitura?.detalhes].filter(Boolean).join(" ");
  const [proximas, catalogo] = await Promise.all([ler.respostas(texto), ler.catalogo()]);

  const fontes: FonteDoTutor[] = proximas.map((x) => ({
    id: x.resposta.id,
    pergunta: x.resposta.pergunta,
    explicacao: x.resposta.explicacao,
    frase: x.resposta.frase,
    confirmada: x.resposta.estado === "confirmada",
  }));
  // O produto vem do print quando ele cita um; senão, da própria dúvida.
  const produtos: ProdutoDoTutor[] = produtosDoTexto(leitura?.produto ?? duvida, catalogo ?? []).map((p) => ({
    codigo: p.codigo,
    nome: p.nome,
    preco: p.preco,
    url: p.url,
    diasUteis: p.diasUteis,
    prazo:
      p.diasUteis === null || !p.disponivel
        ? null
        : {
            retirada: quandoFica({ hoje: ler.entrega.hoje, diasUteis: p.diasUteis, caminho: "retirada", regras: ler.entrega.regras }).frase,
            correios: quandoFica({ hoje: ler.entrega.hoje, diasUteis: p.diasUteis, caminho: "correios", regras: ler.entrega.regras }).frase,
          },
  }));

  const pergunta = (duvida || leitura?.pergunta || "Print sem texto").slice(0, 600);
  if (fontes.length === 0 && produtos.length === 0) return { ...SEM_RESPOSTA, leitura, produtos, pergunta };

  const saida = await pedirJson<SaidaDoModelo>(
    INSTRUCAO_DA_RESPOSTA,
    montarPergunta({ duvida, leitura, fontes, produtos }),
    ESQUEMA_DA_RESPOSTA as unknown as Record<string, unknown>,
    "resposta_do_tutor",
    { modelo: MODELO_RAPIDO, tetoSaida: 1800, esforco: "low" },
  );
  return { ...conferirSaida(saida, fontes, produtos.length > 0), leitura, produtos, pergunta };
}
