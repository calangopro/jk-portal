import type { Bio } from "./tipos";

/**
 * A conferência da bio antes de gravar, fora do zod: travessão em qualquer
 * texto, link que não abre, campanha com datas trocadas e código repetido.
 *
 * Mora aqui (e não na action) porque são duas portas que gravam a bio: a tela
 * /admin/bio e o conector do Claude. A regra é uma só.
 */

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

export function conferirBio(bio: Bio): string | null {
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
