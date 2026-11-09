import "server-only";
import { z } from "zod";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { revalidatePath } from "next/cache";
import { cartaoEmHtml, formatoValido, MAXIMO_DE_PRODUTOS, type ProdutoDoBloco } from "@/lib/editor/VitrineNode";
import { precoVigente } from "@/lib/tray/preco";
import { descreverImagem } from "@/lib/analyzer/assistente";
import { falhar, operacao } from "../tipos";
import { escaparHtml, faixa, id, limite, ok, painel } from "./apoio";

/**
 * Mídia e blocos do editor.
 *
 * O envio de imagem segue a regra do REGRAS.md (WebP, no máximo 2000 px de
 * largura, nome de arquivo legível, alt obrigatório). No painel a conversão é
 * feita no navegador; aqui, no servidor, com o sharp que já vem com o Next.
 */

// ---------------------------------------------------------------- HTML a partir da saída do ProseMirror

type Spec = string | [string, Record<string, string>?, ...unknown[]];

/** Serializa o DOMOutputSpec que os nós do editor devolvem. É o mesmo HTML que o editor grava. */
function specParaHtml(spec: unknown): string {
  if (typeof spec === "string") return escaparHtml(spec);
  if (!Array.isArray(spec)) return "";
  const [tag, ...resto] = spec as [string, ...unknown[]];
  let attrs: Record<string, string> = {};
  let filhos = resto;
  if (resto[0] && typeof resto[0] === "object" && !Array.isArray(resto[0])) {
    attrs = resto[0] as Record<string, string>;
    filhos = resto.slice(1);
  }
  const a = Object.entries(attrs)
    .map(([k, v]) => (v === "" ? ` ${k}` : ` ${k}="${escaparHtml(String(v))}"`))
    .join("");
  const vazio = ["img", "br", "hr"].includes(tag);
  return vazio ? `<${tag}${a}>` : `<${tag}${a}>${filhos.map(specParaHtml).join("")}</${tag}>`;
}

// ---------------------------------------------------------------- download seguro

const PRIVADO_V4 = [
  [0x0a000000, 8],
  [0x7f000000, 8],
  [0xa9fe0000, 16],
  [0xac100000, 12],
  [0xc0a80000, 16],
  [0x64400000, 10],
  [0x00000000, 8],
] as const;

function ipPrivado(ip: string): boolean {
  if (isIP(ip) === 4) {
    const n = ip.split(".").reduce((s, p) => (s << 8) + Number(p), 0) >>> 0;
    return PRIVADO_V4.some(([rede, bits]) => n >>> (32 - bits) === rede >>> (32 - bits));
  }
  const x = ip.toLowerCase();
  if (x.startsWith("::ffff:")) return ipPrivado(x.slice(7));
  return x === "::1" || x === "::" || x.startsWith("fc") || x.startsWith("fd") || x.startsWith("fe8") || x.startsWith("fe9") || x.startsWith("fea") || x.startsWith("feb");
}

/** Baixa uma imagem de fora sem deixar o servidor virar ponte para a rede interna. */
export async function baixar(url: string): Promise<{ bytes: Buffer; tipo: string; final: string }> {
  let atual = url;
  for (let salto = 0; salto < 4; salto++) {
    const u = new URL(atual);
    if (u.protocol !== "https:") falhar("Só link https.");
    if (u.username || u.password) falhar("Link com usuário e senha não serve.");
    const enderecos = isIP(u.hostname) ? [{ address: u.hostname }] : await lookup(u.hostname, { all: true }).catch(() => []);
    if (!enderecos.length) falhar("Não achei esse endereço.");
    if (enderecos.some((e) => ipPrivado(e.address))) falhar("Esse endereço aponta para rede interna.");
    const r = await fetch(atual, { redirect: "manual", signal: AbortSignal.timeout(15_000), headers: { "user-agent": "JKAliancas-Conector/1.0" } });
    if (r.status >= 300 && r.status < 400 && r.headers.get("location")) {
      atual = new URL(r.headers.get("location")!, atual).toString();
      continue;
    }
    if (!r.ok) falhar(`O link respondeu ${r.status}.`);
    const tipo = (r.headers.get("content-type") || "").split(";")[0].trim();
    if (!tipo.startsWith("image/")) falhar(`O link não é imagem (veio ${tipo || "sem tipo"}).`);
    const tamanho = Number(r.headers.get("content-length") || 0);
    if (tamanho > 20 * 1024 * 1024) falhar("Imagem maior que 20 MB.");
    const bytes = Buffer.from(await r.arrayBuffer());
    if (bytes.length > 20 * 1024 * 1024) falhar("Imagem maior que 20 MB.");
    return { bytes, tipo, final: atual };
  }
  return falhar("Redirecionamentos demais.");
}

const nomeLegivel = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "imagem";

const COLUNAS = "id, url, alt, title, caption, credit, mime, width, height, bytes, storage_path, deactivated_at, created_at";

type Midia = {
  id: string;
  url: string | null;
  alt: string | null;
  title: string | null;
  caption: string | null;
  credit: string | null;
  mime: string | null;
  width: number | null;
  height: number | null;
  bytes: number | null;
  storage_path: string;
  deactivated_at: string | null;
  created_at: string;
};

const paraSaida = (m: Midia) => ({
  id: m.id,
  url: m.url,
  alt: m.alt,
  titulo: m.title,
  legenda: m.caption,
  credito: m.credit,
  tipo: m.mime,
  largura: m.width,
  altura: m.height,
  kb: m.bytes ? Math.round(m.bytes / 1024) : null,
  arquivo: m.storage_path,
  desativada: !!m.deactivated_at,
});

export const OPERACOES_MIDIA = [
  operacao({
    nome: "midia.listar",
    resumo: "Lista as imagens da biblioteca, com busca no alt, título e legenda.",
    entrada: z.object({
      busca: z.string().max(100).optional(),
      sem_alt: z.boolean().optional().describe("Só as que ainda não têm texto alternativo."),
      desativadas: z.boolean().default(false),
      limite: limite(40, 200),
      pagina: z.number().int().min(1).default(1),
    }),
    retorno: "{ total: number; itens: Array<{ id, url, alt, titulo, legenda, credito, tipo, largura, altura, kb, arquivo, desativada }> }",
    risco: "leitura",
    async executar(a, ctx) {
      let q = ctx.db.from("media").select(COLUNAS, { count: "exact" });
      q = a.desativadas ? q.not("deactivated_at", "is", null) : q.is("deactivated_at", null);
      if (a.sem_alt) q = q.or("alt.is.null,alt.eq.");
      if (a.busca) {
        const t = a.busca.replace(/[%,()]/g, " ").trim();
        q = q.or(`alt.ilike.%${t}%,title.ilike.%${t}%,caption.ilike.%${t}%,storage_path.ilike.%${t}%`);
      }
      const [de, ate] = faixa(a.pagina, a.limite);
      const r = await q.order("created_at", { ascending: false }).range(de, ate);
      return { total: r.count ?? 0, itens: (ok(r) as Midia[]).map(paraSaida) };
    },
  }),

  operacao({
    nome: "midia.ler",
    resumo: "Uma imagem e onde ela é usada (posts e lojas).",
    entrada: z.object({ id }),
    retorno: "{ ...imagem, usada_em: Array<{ tipo: 'post'|'loja', papel, titulo, id }> }",
    risco: "leitura",
    async executar(a, ctx) {
      const { data: m } = await ctx.db.from("media").select(COLUNAS).eq("id", a.id).maybeSingle();
      if (!m) falhar("Imagem não encontrada.", 404);
      const [posts, lojas] = await Promise.all([
        ctx.db.from("content_media").select("role, contents:content_id(id, title)").eq("media_id", a.id),
        ctx.db.from("location_media").select("role, locations:location_id(id, name)").eq("media_id", a.id),
      ]);
      const um = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);
      return {
        ...paraSaida(m as Midia),
        usada_em: [
          ...(posts.data ?? []).map((p) => {
            const c = um(p.contents as unknown as { id: string; title: string } | null);
            return { tipo: "post", papel: p.role, id: c?.id, titulo: c?.title };
          }),
          ...(lojas.data ?? []).map((p) => {
            const l = um(p.locations as unknown as { id: string; name: string } | null);
            return { tipo: "loja", papel: p.role, id: l?.id, titulo: l?.name };
          }),
        ],
      };
    },
  }),

  operacao({
    nome: "midia.enviar_de_url",
    resumo: "Baixa uma imagem de um link https e guarda na biblioteca, já em WebP e com no máximo 2000 px de largura.",
    detalhe:
      "alt é obrigatório (descreva para quem não enxerga). nome_arquivo vira o nome legível (ex.: alianca-ouro-18k-4mm). Foto de terceiro só com licença e crédito. SVG e GIF ficam como vieram.",
    entrada: z.object({
      url: z.string().url(),
      alt: z.string().min(5).max(300),
      nome_arquivo: z.string().max(80).optional(),
      titulo: z.string().max(200).optional(),
      legenda: z.string().max(500).optional(),
      credito: z.string().max(200).optional(),
    }),
    retorno: "{ id, url, alt, largura, altura, kb, tipo }",
    risco: "escrita",
    async executar(a, ctx) {
      const { bytes, tipo } = await baixar(a.url);
      let saida = bytes;
      let mime = tipo;
      let largura: number | null = null;
      let altura: number | null = null;
      let ext = tipo.split("/")[1]?.replace("jpeg", "jpg").replace("svg+xml", "svg") || "img";
      if (!["image/svg+xml", "image/gif"].includes(tipo)) {
        const sharp = (await import("sharp")).default;
        const img = sharp(bytes, { failOn: "none" }).rotate();
        const meta = await img.metadata();
        const redimensionada = (meta.width ?? 0) > 2000 ? img.resize({ width: 2000 }) : img;
        const r = await redimensionada.webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
        saida = r.data;
        largura = r.info.width;
        altura = r.info.height;
        mime = "image/webp";
        ext = "webp";
      }
      const caminho = `${nomeLegivel(a.nome_arquivo || a.titulo || a.alt)}-${Date.now()}.${ext}`;
      const up = await ctx.db.storage.from("media").upload(caminho, saida, { contentType: mime, cacheControl: "31536000", upsert: false });
      if (up.error) falhar(`Não deu para guardar a imagem: ${up.error.message}`, 500);
      const url = ctx.db.storage.from("media").getPublicUrl(caminho).data.publicUrl;
      const m = ok(
        await ctx.db
          .from("media")
          .insert({
            bucket: "media",
            storage_path: caminho,
            url,
            mime,
            bytes: saida.length,
            width: largura,
            height: altura,
            alt: a.alt.trim(),
            title: a.titulo?.trim() || null,
            caption: a.legenda?.trim() || null,
            credit: a.credito?.trim() || null,
            created_by: ctx.quem.id,
          })
          .select(COLUNAS)
          .single(),
        "registro",
      ) as Midia;
      revalidatePath("/admin/midia");
      return paraSaida(m);
    },
  }),

  operacao({
    nome: "midia.editar",
    resumo: "Muda alt, título, legenda ou crédito de uma imagem.",
    entrada: z.object({
      id,
      alt: z.string().min(5).max(300).optional(),
      titulo: z.string().max(200).optional(),
      legenda: z.string().max(500).optional(),
      credito: z.string().max(200).optional(),
    }),
    retorno: "{ ...imagem }",
    risco: "escrita",
    async executar(a, ctx) {
      const d: Record<string, string | null> = {};
      if (a.alt !== undefined) d.alt = a.alt.trim();
      if (a.titulo !== undefined) d.title = a.titulo.trim() || null;
      if (a.legenda !== undefined) d.caption = a.legenda.trim() || null;
      if (a.credito !== undefined) d.credit = a.credito.trim() || null;
      if (!Object.keys(d).length) falhar("Nada para mudar.");
      const m = ok(await ctx.db.from("media").update(d).eq("id", a.id).select(COLUNAS).maybeSingle(), "gravação") as Midia | null;
      if (!m) falhar("Imagem não encontrada.", 404);
      revalidatePath("/admin/midia");
      return paraSaida(m!);
    },
  }),

  operacao({
    nome: "midia.desativar",
    resumo: "Tira a imagem da biblioteca (o arquivo fica; dá para reativar).",
    entrada: z.object({ id, reativar: z.boolean().default(false) }),
    retorno: "{ ok: true }",
    risco: "escrita",
    async executar(a, ctx) {
      ok(await ctx.db.from("media").update({ deactivated_at: a.reativar ? null : new Date().toISOString() }).eq("id", a.id), "mudança");
      revalidatePath("/admin/midia");
      return { ok: true };
    },
  }),

  operacao({
    nome: "midia.sugerir_alt",
    resumo: "Pede à IA do painel (OpenAI da JK) um texto alternativo e uma legenda olhando a imagem.",
    entrada: z.object({ id, contexto: z.string().max(300).optional().describe("Do que trata o post, para o alt sair no assunto certo.") }),
    retorno: "{ alt: string; legenda: string }",
    risco: "leitura",
    async executar(a, ctx) {
      const { data: m } = await ctx.db.from("media").select("url").eq("id", a.id).maybeSingle();
      if (!m?.url) falhar("Imagem não encontrada.", 404);
      try {
        return await descreverImagem({ imagemUrl: m!.url!, contexto: a.contexto });
      } catch (e) {
        return falhar(`A IA não respondeu: ${e instanceof Error ? e.message : String(e)}`, 502);
      }
    },
  }),

  // ---------------------------------------------------------------- blocos prontos para o corpo

  operacao({
    nome: "blocos.vitrine",
    resumo: "Monta o HTML da vitrine de produtos (1 a 4) para colar no corpo_html, com os dados reais do catálogo.",
    detalhe: "O preço impresso no HTML é só o de partida: ao servir a página, o site troca pelo preço do dia. Produto indisponível não entra.",
    entrada: z.object({
      produtos: z.array(id).min(1).max(MAXIMO_DE_PRODUTOS).describe("ids de jk.produtos.buscar"),
      formato: z.enum(["vertical", "quadrado", "horizontal"]).default("vertical"),
    }),
    retorno: "{ html: string; ignorados: string[] }",
    risco: "leitura",
    async executar(a, ctx) {
      const { data } = await ctx.db
        .from("products")
        .select("id, name, url, main_image_url, price, promotional_price, status, is_active, availability_text, raw")
        .in("id", a.produtos);
      const porId = new Map((data ?? []).map((p) => [p.id, p]));
      const ignorados: string[] = [];
      const cartoes: ProdutoDoBloco[] = [];
      for (const pid of a.produtos) {
        const p = porId.get(pid);
        if (!p || !p.is_active || p.status !== "available") {
          ignorados.push(`${pid}: ${p ? "indisponível na loja" : "não existe"}`);
          continue;
        }
        const raw = (p.raw ?? {}) as Record<string, string>;
        const v = precoVigente({ price: p.price, promotional_price: p.promotional_price, start_promotion: raw.start_promotion, end_promotion: raw.end_promotion });
        cartoes.push({
          id: p.id,
          nome: p.name,
          url: p.url,
          imagem: p.main_image_url,
          preco: v.atual != null ? String(v.atual) : null,
          precoAntigo: v.anterior != null ? String(v.anterior) : null,
          disponivel: true,
          prazo: p.availability_text,
        });
      }
      if (!cartoes.length) falhar(`Nenhum produto disponível. ${ignorados.join("; ")}`);
      const formato = formatoValido(a.formato);
      const html = `<div class="vitrine vitrine--${formato}" data-vitrine="" data-formato="${formato}" data-n="${cartoes.length}">${cartoes
        .map((c) => specParaHtml(cartaoEmHtml(c)))
        .join("")}</div>`;
      return { html, ignorados };
    },
  }),

  operacao({
    nome: "blocos.figura",
    resumo: "Monta o HTML de uma imagem da biblioteca para o corpo (com largura, altura, alt e, se houver, legenda e crédito).",
    entrada: z.object({ midia_id: id, legenda: z.string().max(500).optional(), credito: z.string().max(200).optional() }),
    retorno: "{ html: string }",
    risco: "leitura",
    async executar(a, ctx) {
      const { data: m } = await ctx.db.from("media").select("url, alt, width, height, caption, credit").eq("id", a.midia_id).maybeSingle();
      if (!m?.url) falhar("Imagem não encontrada.", 404);
      if (!m!.alt?.trim()) falhar("A imagem não tem alt. Corrija antes com jk.midia.editar.");
      const dims = m!.width && m!.height ? ` width="${m!.width}" height="${m!.height}"` : "";
      const img = `<img src="${escaparHtml(m!.url!)}" alt="${escaparHtml(m!.alt!)}"${dims} loading="lazy" decoding="async">`;
      const legenda = (a.legenda ?? m!.caption ?? "").trim();
      const credito = (a.credito ?? m!.credit ?? "").trim();
      if (!legenda && !credito) return { html: img };
      const texto = [legenda, credito ? `Foto: ${credito}` : ""].filter(Boolean).join(" ");
      return {
        html: `<figure data-figura="">${img}<figcaption data-legenda="${escaparHtml(legenda)}" data-credito="${escaparHtml(credito)}">${escaparHtml(texto)}</figcaption></figure>`,
      };
    },
  }),

  operacao({
    nome: "blocos.ferramentas",
    resumo: "As ferramentas que podem entrar no meio do post e o marcador de cada uma.",
    entrada: z.object({}),
    retorno: "{ ferramentas: Array<{ slug, html }> }",
    risco: "leitura",
    async executar(_a, ctx) {
      const { FERRAMENTAS_ATIVAS } = await import("@/lib/ferramentas/registro");
      return {
        ferramentas: [...FERRAMENTAS_ATIVAS].map((slug) => ({ slug, html: `<div data-ferramenta="${slug}"></div>`, pagina: `${ctx.base}/ferramentas/${slug}` })),
        painel: painel(ctx, "/conteudos"),
      };
    },
  }),
];
