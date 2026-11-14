import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clienteDaLoja, type Loja } from "@/lib/tray/lojas";
import { revalidarPrecos } from "@/lib/tray/revalidar";
import { lerEstado, naoPegaram, prepararEdicao, type Campo, type Edicao, type EstadoNaLoja, type Mudanca } from "./produto";

/**
 * O ÚNICO caminho por onde o painel altera a loja na Tray.
 *
 * Cada alteração segue os mesmos cinco passos, nesta ordem:
 *   1. lê o produto na Tray AGORA (o espelho do banco pode estar atrasado);
 *   2. confere a edição contra esse estado (`prepararEdicao`);
 *   3. manda para a Tray só os campos que mudam;
 *   4. lê de novo e confere se cada campo ficou como pedido. A Tray responde
 *      "Saved" mesmo quando ignora um campo, então o "ok" dela não basta;
 *   5. registra em `loja_alteracoes`, inclusive quando foi recusada, e só
 *      então atualiza o espelho.
 *
 * Quem chama passa `quem` (a pessoa logada) e `podePreco`. Não existe
 * alteração sem autor: rotina e conector não escrevem por aqui sem que alguém
 * decida isso de propósito.
 *
 * A loja de testes só existe fora de produção (`clienteDaLoja` devolve nulo).
 */

export type Previa =
  | { estado: "nao_autorizada" }
  | { estado: "nao_achado" }
  | { estado: "invalida"; erro: string }
  | { estado: "previa"; atual: EstadoNaLoja; mudancas: Mudanca[]; avisos: string[] };

export type Resultado =
  | { estado: "nao_autorizada" }
  | { estado: "nao_achado" }
  | { estado: "invalida"; erro: string }
  | { estado: "sem_mudanca"; atual: EstadoNaLoja }
  | { estado: "recusada"; erro: string }
  | { estado: "erro"; erro: string }
  | { estado: "ok"; mudancas: Mudanca[]; depois: EstadoNaLoja };

type Pedido = { loja: Loja["chave"]; trayId: string; edicao: Edicao; podePreco: boolean };

const soDigitos = (v: string) => /^\d{1,12}$/.test(v);

/** O produto como está na loja agora, para preencher o formulário. */
export async function lerProdutoNaLoja(db: SupabaseClient, loja: Loja["chave"], trayId: string): Promise<{ estado: "nao_autorizada" | "nao_achado" } | { estado: "ok"; atual: EstadoNaLoja }> {
  const cliente = await clienteDaLoja(db, loja);
  if (!cliente) return { estado: "nao_autorizada" };
  if (!soDigitos(trayId)) return { estado: "nao_achado" };
  const atual = lerEstado(await cliente.produto(trayId));
  return atual ? { estado: "ok", atual } : { estado: "nao_achado" };
}

/** O "antes e depois" que a pessoa confere. Não grava nada. */
export async function preverEdicaoDoProduto(db: SupabaseClient, p: Pedido): Promise<Previa> {
  const lido = await lerProdutoNaLoja(db, p.loja, p.trayId);
  if (lido.estado !== "ok") return lido;
  const preparo = prepararEdicao(lido.atual, p.edicao, { podePreco: p.podePreco });
  if (!preparo.ok) return { estado: "invalida", erro: preparo.erro };
  return { estado: "previa", atual: lido.atual, mudancas: preparo.mudancas, avisos: preparo.avisos };
}

const recorte = (e: EstadoNaLoja, campos: Campo[]) => Object.fromEntries(campos.map((c) => [c, e[c]]));

export async function alterarProdutoNaLoja(db: SupabaseClient, p: Pedido & { quem: string | null }): Promise<Resultado> {
  const cliente = await clienteDaLoja(db, p.loja);
  if (!cliente) return { estado: "nao_autorizada" };
  if (!soDigitos(p.trayId)) return { estado: "nao_achado" };

  const atual = lerEstado(await cliente.produto(p.trayId));
  if (!atual) return { estado: "nao_achado" };
  const preparo = prepararEdicao(atual, p.edicao, { podePreco: p.podePreco });
  if (!preparo.ok) return { estado: "invalida", erro: preparo.erro };
  if (preparo.mudancas.length === 0) return { estado: "sem_mudanca", atual };

  const campos = preparo.mudancas.map((m) => m.campo);
  const registrar = async (resultado: "ok" | "recusada" | "erro", depois: EstadoNaLoja, http: number | null, erro: string | null) => {
    const { error } = await db.from("loja_alteracoes").insert({
      feita_por: p.quem,
      loja: p.loja,
      recurso: "produto",
      recurso_id: p.trayId,
      rotulo: atual.nome.slice(0, 300),
      antes: recorte(atual, campos),
      depois: recorte(depois, campos),
      resultado,
      http,
      erro: erro?.slice(0, 600) ?? null,
    });
    if (error) console.error("[loja] alteração feita e não registrada:", error.message);
  };

  let resposta;
  try {
    resposta = await cliente.pedir("PUT", `/products/${p.trayId}`, { Product: preparo.corpo });
  } catch (e) {
    const erro = e instanceof Error ? e.message : "A Tray não respondeu.";
    await registrar("erro", preparo.final, null, erro);
    return { estado: "erro", erro: "A Tray não respondeu. Nada foi alterado, até onde dá para saber: confira o produto antes de tentar de novo." };
  }
  if (resposta.status < 200 || resposta.status >= 300) {
    const motivo = resposta.causas.join(" ") || `A Tray recusou a alteração (${resposta.status}).`;
    await registrar("recusada", preparo.final, resposta.status, motivo);
    return { estado: "recusada", erro: motivo };
  }

  const depois = lerEstado(await cliente.produto(p.trayId));
  if (!depois) {
    await registrar("erro", preparo.final, resposta.status, "A Tray gravou, mas o produto não pôde ser lido depois.");
    return { estado: "erro", erro: "A Tray respondeu que gravou, mas o produto não pôde ser lido depois. Confira na loja." };
  }
  const falharam = naoPegaram(preparo.final, depois, campos);
  if (falharam.length > 0) {
    const nomes = preparo.mudancas.filter((m) => falharam.includes(m.campo)).map((m) => m.rotulo.toLowerCase()).join(", ");
    await registrar("erro", depois, resposta.status, `A Tray respondeu que gravou, mas não mudou: ${nomes}.`);
    return { estado: "erro", erro: `A Tray respondeu que gravou, mas não mudou: ${nomes}. O resto ficou como pedido.` };
  }
  await registrar("ok", depois, resposta.status, null);

  // O espelho só existe para a loja de verdade. `sync_hash` nulo faz a próxima
  // sincronização regravar a linha inteira, com o que mais tiver mudado.
  if (p.loja === "jk") {
    const { data: linha } = await db.from("products").select("raw").eq("tray_id", p.trayId).maybeSingle();
    const raw = { ...((linha?.raw as Record<string, unknown> | null) ?? {}), start_promotion: depois.promocaoDe ?? "0000-00-00", end_promotion: depois.promocaoAte ?? "0000-00-00" };
    const { error } = await db
      .from("products")
      .update({ name: depois.nome, price: depois.preco, promotional_price: depois.promocional, status: depois.disponivel ? "available" : "unavailable", raw, sync_hash: null })
      .eq("tray_id", p.trayId);
    if (error) console.error("[loja] espelho não atualizado:", error.message);
    if (campos.some((c) => c !== "estoque")) revalidarPrecos();
  }
  return { estado: "ok", mudancas: preparo.mudancas, depois };
}
