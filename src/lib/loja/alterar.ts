import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clienteDaLoja, type Loja } from "@/lib/tray/lojas";
import { revalidarPrecos } from "@/lib/tray/revalidar";
import { marcarExportadas } from "@/lib/catalogo/fotos";
import {
  TETO_DE_BYTES, corpoDasFotos, fotosQueNaoEntraram, lerImagens, prepararFotos,
  type FotoNova, type ImagemNaLoja, type TipoDeFoto, type Troca,
} from "./imagens";
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
 * As fotos do produto seguem o mesmo desenho, mais abaixo (`levarFotosParaLoja`):
 * lê, confere, manda, lê de novo e registra.
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

// ---------------------------------------------------------------------------
// Fotos do produto
// ---------------------------------------------------------------------------
//
// O que a Tray faz com as fotos está contado em `imagens.ts`, medido na loja de
// testes. O resumo: a posição enviada SUBSTITUI a foto que está naquele lugar,
// e a resposta é "enviado" mesmo quando a foto é descartada. Por isso o envio
// só termina depois de o painel ler o produto de novo e ver a foto no lugar.

export type PreviaDeFotos =
  | { estado: "nao_autorizada" }
  | { estado: "nao_achado" }
  | { estado: "invalida"; erro: string }
  | { estado: "previa"; nome: string; atuais: ImagemNaLoja[]; trocas: Troca[]; avisos: string[] };

export type ResultadoDeFotos =
  | { estado: "nao_autorizada" }
  | { estado: "nao_achado" }
  | { estado: "invalida"; erro: string }
  | { estado: "recusada"; erro: string }
  | { estado: "erro"; erro: string }
  /** `pendentes`: a Tray recebeu, mas a foto ainda não apareceu no produto. */
  | { estado: "ok"; entraram: Troca[]; pendentes: Troca[]; atuais: ImagemNaLoja[] };

type PedidoDeFotos = { loja: Loja["chave"]; trayId: string; fotos: FotoNova[] };

/** De quanto em quanto tempo, e por quanto, o painel espera a Tray processar as fotos. */
const ESPERA_ENTRE_LEITURAS = 4000;
const LEITURAS = 8;
const dormir = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

/** As fotos aprovadas do produto, a mais nova de cada tipo. */
export async function fotosAprovadas(db: SupabaseClient, productId: string): Promise<{ trayId: string; nome: string; fotos: FotoNova[] } | null> {
  const { data: produto } = await db.from("products").select("tray_id, name").eq("id", productId).maybeSingle();
  if (!produto) return null;
  const { data } = await db
    .from("produto_fotos")
    .select("id, tipo, url, storage_path, bytes, largura, altura")
    .eq("product_id", productId)
    .eq("status", "aprovada")
    .order("criada_em", { ascending: false });
  const fotos = (data ?? []).map((f) => ({
    id: f.id as string,
    tipo: f.tipo as TipoDeFoto,
    url: f.url as string,
    caminho: (f.storage_path as string | null) ?? null,
    bytes: (f.bytes as number | null) ?? null,
    largura: (f.largura as number | null) ?? null,
    altura: (f.altura as number | null) ?? null,
  }));
  return { trayId: String(produto.tray_id), nome: String(produto.name), fotos };
}

/**
 * Os bytes que vão de fato para a Tray, e o MD5 deles.
 *
 * Foto dentro do teto vai como está. Acima dele vai uma cópia do mesmo tamanho
 * em pixels, só com a compressão mais baixa: a Tray descarta arquivo grande em
 * silêncio. O MD5 é o que a Tray põe no nome do arquivo que guarda, então é
 * com ele que o painel prova, depois, que a foto no lugar é esta.
 */
async function arquivoParaLoja(db: SupabaseClient, foto: FotoNova): Promise<{ md5: string; bytes: number; leve: Buffer | null }> {
  if (!foto.caminho || foto.caminho.startsWith("tray:")) throw new Error(`Não achei o arquivo da foto de ${foto.tipo}.`);
  const baixado = await db.storage.from("media").download(foto.caminho);
  if (baixado.error || !baixado.data) {
    const sumiu = /not found/i.test(baixado.error?.message ?? "");
    throw new Error(sumiu ? `O arquivo da foto de ${foto.tipo} não está mais guardado no painel. Envie a foto de novo.` : `Não deu para baixar a foto de ${foto.tipo}: ${baixado.error?.message ?? "sem arquivo"}.`);
  }
  const original = Buffer.from(await baixado.data.arrayBuffer());
  const md5 = (b: Buffer) => createHash("md5").update(b).digest("hex");
  if (original.length <= TETO_DE_BYTES) return { md5: md5(original), bytes: original.length, leve: null };

  const sharp = (await import("sharp")).default;
  for (const qualidade of [86, 80, 74, 68, 60, 50]) {
    const tentativa = await sharp(original, { failOn: "none" }).jpeg({ quality: qualidade, mozjpeg: true }).toBuffer();
    if (tentativa.length <= TETO_DE_BYTES) return { md5: md5(tentativa), bytes: original.length, leve: tentativa };
  }
  throw new Error(`A foto de ${foto.tipo} não coube em ${Math.round(TETO_DE_BYTES / 1000)} KB nem com mais compressão. Envie uma versão menor.`);
}

/** A mais nova de cada tipo, já com o MD5 do que será mandado. `leves` guarda as cópias reduzidas. */
async function fotosComArquivo(db: SupabaseClient, fotos: FotoNova[]): Promise<{ fotos: FotoNova[]; leves: Map<string, Buffer> }> {
  const umaPorTipo = fotos.filter((f, i) => fotos.findIndex((x) => x.tipo === f.tipo) === i);
  const leves = new Map<string, Buffer>();
  const prontas = await Promise.all(
    umaPorTipo.map(async (f) => {
      const arquivo = await arquivoParaLoja(db, f);
      if (arquivo.leve) leves.set(f.id, arquivo.leve);
      return { ...f, bytes: arquivo.bytes, md5: arquivo.md5 };
    }),
  );
  return { fotos: prontas, leves };
}

/** O "antes e depois" das fotos, posição por posição. Não manda nada. */
export async function preverFotosNaLoja(db: SupabaseClient, p: PedidoDeFotos): Promise<PreviaDeFotos> {
  const cliente = await clienteDaLoja(db, p.loja);
  if (!cliente) return { estado: "nao_autorizada" };
  if (!soDigitos(p.trayId)) return { estado: "nao_achado" };
  if (p.fotos.length === 0) return { estado: "invalida", erro: "Este produto não tem foto aprovada esperando ir para a loja." };
  const cru = await cliente.produto(p.trayId);
  if (!cru) return { estado: "nao_achado" };
  const atuais = lerImagens(cru);
  let fotos: FotoNova[];
  try {
    ({ fotos } = await fotosComArquivo(db, p.fotos));
  } catch (e) {
    return { estado: "invalida", erro: e instanceof Error ? e.message : "Não deu para ler as fotos." };
  }
  const preparo = prepararFotos(atuais, fotos);
  if (!preparo.ok) return { estado: "invalida", erro: preparo.erro };
  return { estado: "previa", nome: String(cru.name ?? ""), atuais, trocas: preparo.trocas, avisos: preparo.avisos };
}

/**
 * Manda as fotos para a loja e só responde depois de conferir.
 *
 * `darBaixa` liga a atualização do estado das fotos no painel (aprovada vira
 * "na loja") e do espelho do produto. Fica desligado no teste contra a loja de
 * testes, cujo produto não existe no catálogo do painel.
 */
export async function levarFotosParaLoja(
  db: SupabaseClient,
  p: PedidoDeFotos & { quem: string | null; darBaixa: boolean },
): Promise<ResultadoDeFotos> {
  const cliente = await clienteDaLoja(db, p.loja);
  if (!cliente) return { estado: "nao_autorizada" };
  if (!soDigitos(p.trayId)) return { estado: "nao_achado" };
  if (p.fotos.length === 0) return { estado: "invalida", erro: "Este produto não tem foto aprovada esperando ir para a loja." };

  const cru = await cliente.produto(p.trayId);
  if (!cru) return { estado: "nao_achado" };
  const antes = lerImagens(cru);

  let fotos: FotoNova[];
  let leves: Map<string, Buffer>;
  try {
    ({ fotos, leves } = await fotosComArquivo(db, p.fotos));
  } catch (e) {
    return { estado: "invalida", erro: e instanceof Error ? e.message : "Não deu para ler as fotos." };
  }
  const preparo = prepararFotos(antes, fotos);
  if (!preparo.ok) return { estado: "invalida", erro: preparo.erro };
  const { trocas } = preparo;
  const aMandar = trocas.filter((t) => !t.jaEsta);
  const nome = String(cru.name ?? "").slice(0, 300);

  const porPosicao = (lista: (string | null)[]) => Object.fromEntries(trocas.map((t, i) => [String(t.ficaEm), lista[i]]));
  const registrar = async (resultado: "ok" | "recusada" | "erro", depois: (string | null)[], http: number | null, erro: string | null) => {
    const { error } = await db.from("loja_alteracoes").insert({
      feita_por: p.quem,
      loja: p.loja,
      recurso: "imagem",
      recurso_id: p.trayId,
      rotulo: nome,
      antes: porPosicao(trocas.map((t) => t.antes?.url ?? null)),
      depois: porPosicao(depois),
      resultado,
      http,
      erro: erro?.slice(0, 600) ?? null,
    });
    if (error) console.error("[loja] fotos enviadas e não registradas:", error.message);
  };

  // A cópia leve sobe com outro nome: a Tray pede que o mesmo nome não seja
  // mandado duas vezes. Falhou aqui, nada foi para a loja.
  const enderecos: Record<string, string> = {};
  for (const t of aMandar) {
    const leve = leves.get(t.fotoId);
    const foto = fotos.find((f) => f.id === t.fotoId);
    if (!leve || !foto?.caminho) continue;
    const caminho = foto.caminho.replace(/\.jpe?g$/i, "") + `-loja-${Date.now()}.jpg`;
    const up = await db.storage.from("media").upload(caminho, leve, { contentType: "image/jpeg", cacheControl: "31536000", upsert: false });
    if (up.error) return { estado: "invalida", erro: `Não deu para guardar a cópia leve da foto de ${t.tipo}: ${up.error.message}.` };
    enderecos[t.fotoId] = db.storage.from("media").getPublicUrl(caminho).data.publicUrl;
  }
  const enviados = trocas.map((t) => enderecos[t.fotoId] ?? t.depois);

  let http: number | null = null;
  let depois = antes;
  let pendentes = aMandar;
  if (aMandar.length > 0) {
    let resposta;
    try {
      resposta = await cliente.pedir("POST", `/products/${p.trayId}/images`, { Images: corpoDasFotos(trocas, enderecos) });
    } catch (e) {
      await registrar("erro", enviados, null, e instanceof Error ? e.message : "A Tray não respondeu.");
      return { estado: "erro", erro: "A Tray não respondeu. Confira as fotos do produto na loja antes de tentar de novo." };
    }
    http = resposta.status;
    if (resposta.status < 200 || resposta.status >= 300) {
      const motivo = resposta.causas.join(" ") || `A Tray recusou as fotos (${resposta.status}).`;
      await registrar("recusada", enviados, resposta.status, motivo);
      return { estado: "recusada", erro: motivo };
    }

    // A Tray processa as fotos em fila. Na loja de testes levou menos de 6
    // segundos; aqui se espera até meio minuto antes de dizer "ainda não".
    for (let i = 0; i < LEITURAS && pendentes.length > 0; i++) {
      await dormir(ESPERA_ENTRE_LEITURAS);
      const lido = await cliente.produto(p.trayId).catch(() => null);
      if (!lido) continue;
      depois = lerImagens(lido);
      pendentes = fotosQueNaoEntraram(antes, depois, aMandar);
    }
  }

  // Entrou a que o painel viu na loja agora e a que já estava lá antes.
  const entraram = trocas.filter((t) => !pendentes.includes(t));
  const naLoja = trocas.map((t) => (pendentes.includes(t) ? null : (depois[t.ficaEm - 1]?.url ?? null)));
  if (aMandar.length > 0) {
    await registrar(
      pendentes.length === 0 ? "ok" : "erro",
      naLoja,
      http,
      pendentes.length === 0
        ? null
        : `A Tray respondeu que recebeu, mas ${
            aMandar.length === 1 ? "a foto não apareceu" : pendentes.length === 1 ? `1 das ${aMandar.length} fotos não apareceu` : `${pendentes.length} das ${aMandar.length} fotos não apareceram`
          } no produto em ${(LEITURAS * ESPERA_ENTRE_LEITURAS) / 1000} segundos: ${pendentes.map((t) => t.tipo).join(", ")}.`,
    );
  }

  if (p.darBaixa && entraram.length > 0) {
    // Só as fotos que o painel VIU na loja mudam de estado. A que ficou
    // pendente continua "aprovada", para a pessoa poder mandar de novo: marcar
    // como enviada faria a sincronização dar baixa nela só porque a foto
    // principal mudou, mesmo que a Tray a tivesse descartado.
    const ids = entraram.map((t) => t.fotoId);
    await marcarExportadas(db, ids).catch((e) => console.error("[loja] fotos enviadas e não marcadas:", e));
    const { error } = await db
      .from("produto_fotos")
      .update({ status: "na_loja", na_loja_em: new Date().toISOString() })
      .in("id", ids)
      .eq("status", "aprovada");
    if (error) console.error("[loja] baixa das fotos não gravada:", error.message);
    // A foto principal mudou: o espelho e as páginas do site passam a mostrar a nova.
    if (p.loja === "jk" && entraram.some((t) => t.ficaEm === 1) && depois[0]) {
      const { error: doEspelho } = await db.from("products").update({ main_image_url: depois[0].url, sync_hash: null }).eq("tray_id", p.trayId);
      if (doEspelho) console.error("[loja] espelho da imagem não atualizado:", doEspelho.message);
      revalidarPrecos();
    }
  }
  return { estado: "ok", entraram, pendentes, atuais: depois };
}
