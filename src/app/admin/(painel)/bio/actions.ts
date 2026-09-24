"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/session";
import { TAG_BIO } from "@/lib/bio/ler";
import { produtosDaVitrine } from "@/lib/bio/produtos";
import { bioDeFabrica, esquemaDaBio, esquemaDaFonte, type Bio, type ProdutoDaBio } from "@/lib/bio/tipos";

export type ResultadoDaBio = { ok: true } | { ok: false; erro: string };

/** Travessão é proibido em qualquer texto do projeto (REGRAS.md §1). */
const TRAVESSAO = /[—–]/;

/**
 * Endereço que um link da bio pode ter. Página do portal começa com "/", o
 * resto precisa ser https. Fica de fora qualquer esquema que execute código
 * (`javascript:`), que num link salvo pelo painel viraria armadilha para quem
 * toca nele.
 */
function linkAceito(href: string): boolean {
  if (href.startsWith("/") && !href.startsWith("//")) return true;
  try {
    const u = new URL(href);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

/** Todos os textos do objeto, com o caminho de cada um, para dizer ONDE está o erro. */
function textos(valor: unknown, caminho: string, saida: [string, string][]) {
  if (typeof valor === "string") saida.push([caminho, valor]);
  else if (Array.isArray(valor)) valor.forEach((v, i) => textos(v, `${caminho}[${i}]`, saida));
  else if (valor && typeof valor === "object") {
    for (const [k, v] of Object.entries(valor)) textos(v, caminho ? `${caminho}.${k}` : k, saida);
  }
  return saida;
}

/** Nome legível do lugar do erro, pelo caminho no JSON. */
function ondeFica(bio: Bio, caminho: string): string {
  const campanha = caminho.match(/^campanhas\[(\d+)\]/);
  const aba = campanha ? `aba ${bio.campanhas[Number(campanha[1])]?.nome ?? ""}` : caminho.startsWith("normal") ? "aba Normal" : "cabeçalho";
  const bloco = caminho.match(/blocos\[(\d+)\]/);
  if (!bloco) return aba;
  const lista = campanha ? bio.campanhas[Number(campanha[1])]?.blocos : bio.normal.blocos;
  const b = lista?.[Number(bloco[1])];
  const titulo = b && "titulo" in b && b.titulo ? ` (${b.titulo})` : "";
  return `${aba}, bloco ${Number(bloco[1]) + 1}${titulo}`;
}

function conferir(bio: Bio): string | null {
  const todos = textos(bio, "", []);

  const comTravessao = todos.filter(([, v]) => TRAVESSAO.test(v)).map(([c]) => ondeFica(bio, c));
  if (comTravessao.length > 0) {
    return `Tem travessão em ${[...new Set(comTravessao)].join("; ")}. Use vírgula, dois pontos ou parênteses.`;
  }

  const links: [string, string][] = [];
  const juntarLinks = (blocos: Bio["normal"]["blocos"], prefixo: string) =>
    blocos.forEach((b, i) => {
      const onde = `${prefixo}.blocos[${i}]`;
      if (b.tipo === "campanha" && b.botao) links.push([onde, b.botao.href]);
      if (b.tipo === "vitrine" && b.verTudo) links.push([onde, b.verTudo.href]);
      if (b.tipo === "captura" && b.grupoLink) links.push([onde, b.grupoLink]);
      if (b.tipo === "links") b.itens.forEach((it) => links.push([onde, it.href]));
    });
  juntarLinks(bio.normal.blocos, "normal");
  bio.campanhas.forEach((c, j) => juntarLinks(c.blocos, `campanhas[${j}]`));
  const ruins = links.filter(([, href]) => !linkAceito(href.trim()));
  if (ruins.length > 0) {
    return `Link que não abre em ${[...new Set(ruins.map(([c]) => ondeFica(bio, c)))].join("; ")}. Use o endereço completo, começando com https://, ou um caminho do site começando com /.`;
  }

  const trocadas = bio.campanhas.filter((c) => c.inicio > c.fim).map((c) => c.nome);
  if (trocadas.length > 0) {
    return `A campanha ${trocadas.join(", ")} termina antes de começar. Confira as datas.`;
  }

  // O código da campanha vai nos eventos: dois iguais misturariam os relatórios.
  const codigos = bio.campanhas.map((c) => c.id);
  if (new Set(codigos).size !== codigos.length) return "Duas campanhas ficaram com o mesmo código.";

  return null;
}

export async function salvarBio(bruto: unknown): Promise<ResultadoDaBio> {
  const perfil = await requireStaff();

  const lido = esquemaDaBio.safeParse(bruto);
  if (!lido.success) {
    const campo = lido.error.issues[0]?.path.join(".") ?? "";
    return { ok: false, erro: `Tem um campo obrigatório vazio ou inválido${campo ? ` (${campo})` : ""}.` };
  }
  const bio = lido.data;

  // Regras da casa conferidas no servidor. Deixar só na tela seria conselho, e
  // conselho se contorna.
  const problema = conferir(bio);
  if (problema) return { ok: false, erro: problema };

  const supabase = await createClient();
  const { error } = await supabase.from("site_settings").upsert(
    { key: "pagina:bio", value: bio as unknown as Record<string, unknown>, updated_by: perfil.id },
    { onConflict: "key" },
  );
  if (error) return { ok: false, erro: error.message };

  // A tag derruba o JSON cacheado; o caminho derruba o HTML já pronto. Só a
  // tag deixaria a bio velha no ar até o ISR de cinco minutos vencer.
  revalidateTag(TAG_BIO);
  revalidatePath("/bio");
  return { ok: true };
}

/** Volta a bio à de fábrica. */
export async function restaurarBio(): Promise<ResultadoDaBio> {
  await requireStaff();
  return salvarBio(bioDeFabrica());
}

/** Produtos de uma vitrine para a prévia, com o mesmo preço ao vivo da página. */
export async function produtosParaPrevia(fonte: unknown, limite: number): Promise<ProdutoDaBio[]> {
  await requireStaff();
  const lida = esquemaDaFonte.safeParse(fonte);
  if (!lida.success) return [];
  return produtosDaVitrine(lida.data, Math.min(16, Math.max(2, Math.round(limite) || 8)));
}

export type ProdutoParaEscolher = {
  trayId: string;
  nome: string;
  imagem: string | null;
};

/**
 * Busca no espelho do catálogo para escolher produto à mão.
 *
 * Aqui pode ser o espelho (`products`), e não a loja ao vivo: o que se procura
 * é o NOME e o id. O preço que vai para a vitrine continua vindo da loja na hora
 * de servir a página.
 */
export async function procurarProdutos(termo: string): Promise<ProdutoParaEscolher[]> {
  await requireStaff();
  const busca = termo.trim().slice(0, 80);
  if (busca.length < 2) return [];

  const supabase = await createClient();
  let consulta = supabase
    .from("products")
    .select("tray_id, name, main_image_url")
    .eq("is_active", true)
    .limit(12);
  // Número puro é id da Tray, que é o que aparece no painel da loja.
  consulta = /^\d+$/.test(busca) ? consulta.eq("tray_id", busca) : consulta.ilike("name", `%${busca}%`);

  const { data } = await consulta;
  return ((data ?? []) as { tray_id: string; name: string; main_image_url: string | null }[]).map((p) => ({
    trayId: p.tray_id,
    nome: p.name,
    imagem: p.main_image_url,
  }));
}

/** Nome e foto dos produtos já escolhidos, na ordem da lista. */
export async function produtosEscolhidos(ids: string[]): Promise<ProdutoParaEscolher[]> {
  await requireStaff();
  const limpos = ids.filter((id) => /^\d+$/.test(id)).slice(0, 32);
  if (limpos.length === 0) return [];

  const supabase = await createClient();
  const { data } = await supabase.from("products").select("tray_id, name, main_image_url").in("tray_id", limpos);
  const porId = new Map(
    ((data ?? []) as { tray_id: string; name: string; main_image_url: string | null }[]).map((p) => [p.tray_id, p]),
  );
  return limpos.map((id) => {
    const p = porId.get(id);
    return { trayId: id, nome: p?.name ?? `Produto ${id}`, imagem: p?.main_image_url ?? null };
  });
}
