import type { Cartao, CartaoInteiro, Conflito } from "@/lib/roadmap/roadmap";
import type { CamposDoCartao, Levada, NovoCartao, Pegada } from "./actions";

/** A resposta de toda ação da tela: deu certo com os dados, ou a frase do porquê. */
export type Resposta<T = object> = ({ ok: true } & T) | { ok: false; erro: string; motivo?: string; de?: string };

/**
 * As ações que a tela usa. Vêm da página (as de verdade, em `actions.ts`) ou
 * de uma prévia sem sessão (de mentira), por isso entram como propriedade.
 */
export type Acoes = {
  ver: (id: number) => Promise<Resposta<{ inteiro: CartaoInteiro }>>;
  conferir: (caminhos: string[], exceto: number | null) => Promise<Resposta<{ conflitos: Conflito[] }>>;
  criar: (d: NovoCartao) => Promise<Resposta<{ id: number }>>;
  pegar: (id: number, d: Pegada) => Promise<Resposta<{ cartao: Cartao; conflitos: Conflito[] }>>;
  mover: (id: number, coluna: string, nota: string) => Promise<Resposta<{ cartao: Cartao }>>;
  ligarPr: (id: number, pr: string, ramo: string) => Promise<Resposta<{ cartao: Cartao }>>;
  editar: (id: number, campos: CamposDoCartao) => Promise<Resposta<{ cartao: Cartao }>>;
  levar: (sugestao: number, d: Levada) => Promise<Resposta<{ id: number }>>;
};
