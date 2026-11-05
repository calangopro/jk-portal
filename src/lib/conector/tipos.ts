import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";
import type { AppRole } from "@/lib/auth/session";

/**
 * O que é uma OPERAÇÃO do conector.
 *
 * Cada coisa que o Claude pode fazer no painel se declara UMA vez aqui, e dela
 * saem as três formas de uso: a função `jk.area.acao()` no modo código, a
 * ferramenta `area_acao` no modo de ferramentas e a linha no catálogo da tela
 * /admin/conector. É o mesmo espírito do registro de ferramentas do site
 * (`lib/ferramentas/registro.ts`).
 */

/**
 * leitura: só olha. Roda pelo `consultar`, que o app do Claude libera sem
 * pedir licença.
 * escrita: muda rascunho, cadastro interno ou coisa que não aparece para o
 * público.
 * perigosa: muda o que o público vê ou o que não volta sozinho (publicar,
 * responder comentário em nome da JK, redirect, destino de QR impresso, bio,
 * home). O Claude pede o "sim" da pessoa antes.
 */
export type Risco = "leitura" | "escrita" | "perigosa";

export type Escopo = "leitura" | "completo";

export type QuemUsa = {
  id: string;
  email: string | null;
  nome: string | null;
  papel: AppRole;
};

export type Acesso = {
  id: string;
  nome: string;
  escopo: Escopo;
  via: "manual" | "oauth";
};

export type Contexto = {
  quem: QuemUsa;
  acesso: Acesso;
  /** Cliente service_role. As travas de papel moram em `executarOperacao`. */
  db: SupabaseClient;
  /** https://www.jkaliancas.com.br/guias (ou o host da prévia). */
  base: string;
  /** O pedido original, para quem precisa de cabeçalho ou de endereço. */
  req: Request;
};

export type Operacao<S extends z.ZodType = z.ZodType> = {
  /** "conteudos.criar". Vira jk.conteudos.criar() e a ferramenta conteudos_criar. */
  nome: string;
  /** Uma linha: o que faz. Aparece na busca e na lista de ferramentas. */
  resumo: string;
  /** Detalhe, regra e exemplo, quando a linha não basta. */
  detalhe?: string;
  entrada: S;
  /** O formato da resposta, em TypeScript, para o Claude escrever código sem tatear. */
  retorno?: string;
  risco: Risco;
  /** Só administrador (as mesmas telas que hoje pedem `requireAdmin`). */
  soAdmin?: boolean;
  executar: (args: z.infer<S>, ctx: Contexto) => Promise<unknown>;
};

/** Ajuda o TypeScript a inferir o tipo dos argumentos dentro de `executar`. */
export function operacao<S extends z.ZodType>(op: Operacao<S>): Operacao<S> {
  return op;
}

/** Erro que vira mensagem legível para o Claude, sem pilha. */
export class ErroDoConector extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export const falhar = (mensagem: string, status = 400): never => {
  throw new ErroDoConector(mensagem, status);
};
