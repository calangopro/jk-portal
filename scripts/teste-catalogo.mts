/**
 * Arquivo do catálogo do Meta e do Google: teste das contas puras e conferência
 * com o arquivo da Tray.
 *
 *   npm run verificar:catalogo                       testes e conferência com o da Tray
 *   npm run verificar:catalogo -- --sem-internet     só os testes (é o que o build roda)
 *   npm run verificar:catalogo -- --painel=URL       compara com outro endereço do painel
 *                                                    (prévia da Vercel ou http://localhost:3001/guias/...)
 *   npm run verificar:catalogo -- --tray=URL         outro arquivo da Tray (o do Google, por exemplo)
 *   npm run verificar:catalogo -- --destino=google   confere o arquivo do Google do painel
 *
 * A conferência baixa os dois arquivos, compara item a item (códigos que
 * faltam ou sobram, preço, promoção, disponibilidade, link, fotos, descrição e
 * o resto dos campos) e, com o `.env.local` presente, explica pelo banco cada
 * código que só um dos dois tem. Sai com 1 quando há diferença crítica (código,
 * preço, promoção, disponibilidade, link ou foto principal), e com 2 quando não
 * conseguiu baixar um dos arquivos. Passo a passo em `docs/catalogo-pelo-painel.md`.
 *
 * Os produtos e textos dos testes são INVENTADOS, só com a forma do que a Tray
 * entrega. Nada de produto de verdade mora neste arquivo.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  CATEGORIAS_QUE_ENTRAM_SOZINHAS, MOTIVO_EM_PALAVRAS, PARCEIRO, RAMOS_QUE_ENTRAM, SEPARADOR_DO_TIPO,
  caminhoDaCategoria, categoriaEntra, categoriasDaArvore, cortar, descricaoEmTexto, detalheDaApi,
  itemDoArquivo, linkComParceiro, montarItens, motivoDeFora, quemLer, xmlDoArquivo,
  type Categoria, type DetalheDaLoja, type ProdutoDoArquivo,
} from "../src/lib/catalogo/arquivo.ts";
import { CAMPOS_CONFERIDOS, CAMPOS_CRITICOS, codificacaoDoXml, compararArquivos, lerArquivo, ondeDifere } from "../src/lib/catalogo/conferencia.ts";
import { precoVigente } from "../src/lib/tray/preco.ts";

let falhas = 0;
function confere(nome: string, ok: boolean, detalhe = "") {
  if (ok) console.log(`  ok  ${nome}`);
  else {
    falhas++;
    console.error(`  ERRO ${nome}${detalhe ? `\n       ${detalhe}` : ""}`);
  }
}

// ---------------------------------------------------------------------------
// Árvore inventada, com a forma de web_api/categories/tree e os ids da regra.
const ARVORE_CRUA = {
  Category: [
    { Category: { id: "7", name: "Alianças de Namoro", children: [{ Category: { id: "53", name: "Alianças de Prata", children: [{ Category: { id: "231", name: "Aliança Unitária", children: [] } }] } }] } },
    { Category: { id: "23", name: "Alianças de Casamento", children: [{ Category: { id: "113", name: "Alianças Prata Banhadas a Ouro", children: [] } }] } },
    {
      Category: {
        id: "11", name: "Joias",
        children: [
          { Category: { id: "127", name: "Joias de Ouro 18k", children: [] } },
          { Category: { id: "121", name: "Joias de Prata", children: [{ Category: { id: "17", name: "Brincos", children: [] } }] } },
          { Category: { id: "35", name: "Caixinha de Joia", children: [] } },
        ],
      },
    },
    { Category: { id: "175", name: "Semijoia", children: [{ Category: { id: "177", name: "Colares", children: [] } }] } },
    {
      Category: {
        id: "233", name: "Anéis",
        children: [
          { Category: { id: "77", name: "Anéis de Noivado", children: [{ Category: { id: "229", name: "Anéis Semijoias", children: [] } }, { Category: { id: "83", name: "Anéis de Ouro 18k", children: [] } }] } },
          { Category: { id: "143", name: "Anéis de Formatura", children: [{ Category: { id: "145", name: "Anel de Ouro 18k", children: [] } }] } },
        ],
      },
    },
    { Category: { id: "237", name: "Aniversário", children: [] } },
    { Category: { id: "", name: "sem id" } },
  ],
};
const ARVORE = categoriasDaArvore(ARVORE_CRUA);
const MAPA = new Map(ARVORE.map((c) => [c.id, c]));
const caminho = (id: string) => caminhoDaCategoria(id, MAPA) as Categoria[];
const entra = (id: string) => categoriaEntra(caminho(id));

console.log("\nÁrvore e regra de quem entra");
{
  confere("a árvore achatada guarda o pai de cada categoria", MAPA.get("231")?.pai === "53" && MAPA.get("53")?.pai === "7" && MAPA.get("7")?.pai === null);
  confere("categoria sem id é ignorada", !ARVORE.some((c) => c.nome === "sem id"));
  confere("caminho vai da raiz até a categoria", caminho("145").map((c) => c.id).join(">") === "233>143>145");
  confere("categoria fora da árvore não tem caminho", caminhoDaCategoria("999", MAPA) === null && caminhoDaCategoria(null, MAPA) === null);
  const ciclo = new Map<string, Categoria>([["1", { id: "1", nome: "a", pai: "2" }], ["2", { id: "2", nome: "b", pai: "1" }]]);
  confere("árvore com ciclo não trava", caminhoDaCategoria("1", ciclo) === null);
  confere("ramos que entram: namoro, casamento e anéis", RAMOS_QUE_ENTRAM.join() === "7,23,233");
  confere("alianças de namoro e as de baixo entram", entra("7") && entra("53") && entra("231"));
  confere("alianças de casamento e as de baixo entram", entra("23") && entra("113"));
  confere("anéis entram, inclusive formatura e noivado", entra("233") && entra("145") && entra("83"));
  confere("anéis semijoias ficam fora", !entra("229"));
  confere("joias, joias de prata e de ouro 18k entram sozinhas", CATEGORIAS_QUE_ENTRAM_SOZINHAS.every((id) => entra(id)));
  confere("brincos (filha de joias de prata) ficam fora", !entra("17"));
  confere("caixinha de joia fica fora", !entra("35"));
  confere("semijoia e as de baixo ficam fora", !entra("175") && !entra("177"));
  confere("categoria de campanha fica fora", !entra("237"));
  confere("caminho vazio não entra", !categoriaEntra([]));
}

// ---------------------------------------------------------------------------
const PRODUTO_DA_API = {
  id: "9001",
  name: "Aliança de Exemplo",
  description: "<p>Primeira linha&nbsp;com acento: alian&ccedil;a &#128142;</p>\n\n<p>&nbsp;</p>\n\n<ul>\n\t<li>Item um;</li>\n\t<li>Item dois &amp; tr&ecirc;s</li>\n</ul>",
  reference: "REF 10",
  model: "Clássico",
  ean: "7890000000001",
  weight: "3",
  length: "27",
  width: "18",
  height: "10",
  stock: "12",
  modified: "2026-11-10 10:00:00",
  ProductImage: [
    { http: "http://img.exemplo.test/9001_1.jpg", https: "https://img.exemplo.test/9001_1.jpg" },
    { https: "https://img.exemplo.test/9001_3.jpg" },
    { http: "http://img.exemplo.test/9001_2.jpg" },
  ],
};

console.log("\nDetalhes vindos da API");
const detalhe = detalheDaApi(PRODUTO_DA_API);
{
  confere("fotos na ordem da loja, preferindo https", detalhe.imagens.join() === "https://img.exemplo.test/9001_1.jpg,https://img.exemplo.test/9001_3.jpg,http://img.exemplo.test/9001_2.jpg");
  confere("referência, modelo e GTIN", detalhe.referencia === "REF 10" && detalhe.modelo === "Clássico" && detalhe.ean === "7890000000001");
  confere("peso, medidas e estoque viram número", detalhe.peso === 3 && detalhe.comprimento === 27 && detalhe.largura === 18 && detalhe.altura === 10 && detalhe.estoque === 12);
  const vazio = detalheDaApi({ id: "1", reference: "", model: "  ", ean: "", weight: "", ProductImage: null });
  confere("campo vazio vira nulo, e sem foto vira lista vazia", vazio.referencia === null && vazio.modelo === null && vazio.ean === null && vazio.peso === null && vazio.imagens.length === 0);
}

console.log("\nDescrição");
{
  const texto = descricaoEmTexto(PRODUTO_DA_API.description);
  confere(
    "sem marcação, entidade trocada, quebra de linha vira espaço e tabulação some",
    texto === "Primeira linha\u00a0com acento: aliança 💎  \u00a0   Item um; Item dois & três ",
    JSON.stringify(texto),
  );
  confere("descrição vazia vira texto vazio", descricaoEmTexto(null) === "" && descricaoEmTexto("<p></p>") === "");
  confere("espaço da ponta fica, como na Tray", descricaoEmTexto("<p>\u00a0a</p>\n") === "\u00a0a ");
  confere("comentário e script saem", descricaoEmTexto("a<!-- x -->b<script>alert(1)</script>c") === "abc");
  confere("entidade desconhecida fica como está", descricaoEmTexto("a &naoexiste; b") === "a &naoexiste; b");
  confere("cortar não parte emoji", cortar("ab💎cd", 3) === "ab💎" && cortar("abc", 5) === "abc");
}

// ---------------------------------------------------------------------------
const HOJE = "2026-11-17";
function produto(a: Partial<ProdutoDoArquivo> = {}): ProdutoDoArquivo {
  return {
    trayId: "9001",
    nome: "Aliança de Exemplo\u00a0",
    url: "https://loja.exemplo.test/aliancas/alianca-de-exemplo",
    ativo: true,
    disponivel: true,
    categoriaId: "145",
    marca: "JK ALIANÇAS",
    imagemPrincipal: "https://img.exemplo.test/9001_1.jpg",
    descricaoCurta: "Descrição curta de exemplo.",
    preco: { atual: 499.9, anterior: null },
    promocao: { inicio: null, fim: null },
    detalhe,
    ...a,
  };
}
const campos = (p: ProdutoDoArquivo, destino: "meta" | "google" = "meta") => itemDoArquivo(p, caminho(p.categoriaId as string), destino, HOJE).campos;
const valor = (cs: [string, string][], nome: string) => cs.filter(([n]) => n === nome).map(([, v]) => v);

console.log("\nO item");
{
  const cs = campos(produto());
  const ordem = [...new Set(cs.map(([n]) => n))].join(",");
  confere(
    "campos na ordem do arquivo da Tray",
    ordem === "id,title,link,price,shipping_weight,description,brand,image_link,additional_image_link,product_type,availability,gtin,mpn,condition,shipping_size",
    ordem,
  );
  confere("o código é o tray_id", valor(cs, "id")[0] === "9001");
  confere("o nome vai como a loja escreveu, sem aparar", valor(cs, "title")[0] === "Aliança de Exemplo\u00a0");
  confere("link do Meta com parceiro=1516", valor(cs, "link")[0] === "https://loja.exemplo.test/aliancas/alianca-de-exemplo?parceiro=1516");
  confere("link do Google com parceiro=1517", valor(campos(produto(), "google"), "link")[0].endsWith("?parceiro=1517") && PARCEIRO.google === "1517");
  confere("link que já tem parâmetro ganha &", linkComParceiro("https://x.test/a?b=1", "meta") === "https://x.test/a?b=1&parceiro=1516");
  confere("preço com duas casas e BRL", valor(cs, "price")[0] === "499.90 BRL");
  confere("sem promoção, nada de sale_price", valor(cs, "sale_price").length === 0 && valor(cs, "sale_price_effective_date").length === 0);
  confere("peso em gramas e medidas em centímetros", valor(cs, "shipping_weight")[0] === "3 g" && valor(cs, "shipping_size")[0] === "27x18x10 cm");
  confere("mpn é código, referência e modelo colados", valor(cs, "mpn")[0] === "9001REF 10Clássico");
  confere("gtin quando a loja tem", valor(cs, "gtin")[0] === "7890000000001");
  confere("tipo é o caminho da categoria com o separador da Tray", valor(cs, "product_type")[0] === ["Anéis", "Anéis de Formatura", "Anel de Ouro 18k"].join(SEPARADOR_DO_TIPO));
  confere("o separador é o &gt; por extenso, como a Tray manda", SEPARADOR_DO_TIPO === " &gt; ");
  confere("primeira foto é a principal e as outras vêm na ordem", valor(cs, "image_link")[0].endsWith("9001_1.jpg") && valor(cs, "additional_image_link").join().endsWith("9001_3.jpg,http://img.exemplo.test/9001_2.jpg"));
  confere("disponível sai como in stock, novo", valor(cs, "availability")[0] === "in stock" && valor(cs, "condition")[0] === "new");
  confere("descrição completa da loja", valor(cs, "description")[0].startsWith("Primeira linha"));

  const semMarca = campos(produto({ marca: "" }));
  confere("sem marca na loja, sem brand no arquivo", valor(semMarca, "brand").length === 0);

  const fotoNova = campos(produto({ imagemPrincipal: "https://img.exemplo.test/9001_nova.jpg" }));
  confere(
    "foto principal trocada depois da leitura: só a do espelho até reler",
    valor(fotoNova, "image_link")[0].endsWith("9001_nova.jpg") && valor(fotoNova, "additional_image_link").length === 0,
  );

  const semDetalhe = campos(produto({ detalhe: null }));
  confere(
    "sem detalhe: uma foto, descrição curta, mpn só com o código, sem peso nem medida",
    valor(semDetalhe, "additional_image_link").length === 0 && valor(semDetalhe, "description")[0] === "Descrição curta de exemplo." &&
      valor(semDetalhe, "mpn")[0] === "9001" && valor(semDetalhe, "shipping_weight").length === 0 && valor(semDetalhe, "shipping_size").length === 0,
  );

  const descricaoVazia = campos(produto({ detalhe: { ...detalhe, descricaoHtml: "<p>&nbsp; </p>" }, descricaoCurta: null }));
  confere("descrição vazia na loja e sem curta: vai o nome", valor(descricaoVazia, "description")[0] === "Aliança de Exemplo");

  const zerado: DetalheDaLoja = { ...detalhe, peso: 0, comprimento: 0, largura: 0, altura: 0, ean: null, referencia: null, modelo: null };
  const csZ = campos(produto({ detalhe: zerado }));
  confere("peso zero sai 0 g e medida toda zero não sai", valor(csZ, "shipping_weight")[0] === "0 g" && valor(csZ, "shipping_size").length === 0 && valor(csZ, "gtin").length === 0);
  const umaMedida = campos(produto({ detalhe: { ...zerado, comprimento: 55 } }));
  confere("uma medida só já sai, como a Tray faz (55x0x0)", valor(umaMedida, "shipping_size")[0] === "55x0x0 cm");

  const longa = campos(produto({ detalhe: { ...detalhe, descricaoHtml: `<p>${"a".repeat(6000)}</p>` } }));
  confere("descrição cortada em 5.000 caracteres", Array.from(valor(longa, "description")[0]).length === 5000);
}

console.log("\nPromoção, pela mesma conta do site (precoVigente)");
{
  const comPromo = (inicio: string, fim: string) => {
    const pv = precoVigente({ price: 2999.9, promotional_price: 2849.9, start_promotion: inicio, end_promotion: fim }, HOJE);
    return campos(produto({ preco: { atual: pv.atual, anterior: pv.anterior }, promocao: { inicio, fim } }));
  };
  const valendo = comPromo("2026-11-01", "2026-11-30");
  confere("promoção valendo: price cheio e sale_price", valor(valendo, "price")[0] === "2999.90 BRL" && valor(valendo, "sale_price")[0] === "2849.90 BRL");
  confere(
    "datas no formato da Tray, o dia inteiro no relógio de São Paulo",
    valor(valendo, "sale_price_effective_date")[0] === "2026-11-01T00:00-03:00/2026-11-30T23:59-03:00",
  );
  const ordem = valendo.map(([n]) => n);
  confere("sale_price vem depois de availability, como na Tray", ordem.indexOf("sale_price") === ordem.indexOf("availability") + 1 && ordem.indexOf("sale_price_effective_date") === ordem.indexOf("sale_price") + 1);
  const vencida = comPromo("2026-08-01", "2026-08-31");
  confere("promoção vencida: preço cheio e nada de sale_price", valor(vencida, "price")[0] === "2999.90 BRL" && valor(vencida, "sale_price").length === 0);
  const futura = comPromo("2026-11-20", "2026-11-30");
  confere("promoção que ainda não começou não entra", valor(futura, "sale_price").length === 0);
  const semInicio = comPromo("0000-00-00", "2026-11-30");
  confere("sem data de início, vale desde hoje", valor(semInicio, "sale_price_effective_date")[0] === "2026-11-17T00:00-03:00/2026-11-30T23:59-03:00");
  const semFim = comPromo("2026-11-01", "0000-00-00");
  confere("sem data de fim, sale_price sem janela", valor(semFim, "sale_price")[0] === "2849.90 BRL" && valor(semFim, "sale_price_effective_date").length === 0);
}

console.log("\nQuem fica fora, e por quê");
{
  const motivo = (a: Partial<ProdutoDoArquivo>) => {
    const p = produto(a);
    return motivoDeFora(p, caminhoDaCategoria(p.categoriaId, MAPA));
  };
  confere("produto disponível de categoria que entra: entra", motivo({}) === null);
  confere("indisponível fica fora", motivo({ disponivel: false }) === "indisponivel");
  confere("desativado fica fora", motivo({ ativo: false }) === "inativo");
  confere("categoria fora da regra fica fora", motivo({ categoriaId: "175" }) === "categoria_fora");
  confere("categoria fora da árvore fica fora", motivo({ categoriaId: "999" }) === "categoria_desconhecida");
  confere("sem preço fica fora", motivo({ preco: { atual: null, anterior: null } }) === "sem_preco");
  confere("sem foto nenhuma fica fora", motivo({ imagemPrincipal: null, detalhe: null }) === "sem_foto");
  confere("todo motivo tem frase", Object.values(MOTIVO_EM_PALAVRAS).every((f) => f.length > 5));
  const r = montarItens(
    [produto({ trayId: "30" }), produto({ trayId: "4", categoriaId: "17" }), produto({ trayId: "200", detalhe: null }), produto({ trayId: "7", disponivel: false })],
    ARVORE, "meta", HOJE,
  );
  confere("montarItens separa quem entra, quem fica fora e quem saiu sem detalhe", r.itens.map((i) => i.id).join() === "30,200" && r.fora.length === 2 && r.semDetalhe.join() === "200");
}

console.log("\nQuem a rotina lê primeiro");
{
  const agora = new Date("2026-11-17T12:00:00Z");
  const fila = quemLer(
    [
      { trayId: "1", imagemPrincipal: "a.jpg" },
      { trayId: "2", imagemPrincipal: "nova.jpg" },
      { trayId: "3", imagemPrincipal: "c.jpg" },
      { trayId: "4", imagemPrincipal: "d.jpg" },
      { trayId: "5", imagemPrincipal: "e.jpg" },
    ],
    [
      { trayId: "2", primeiraImagem: "velha.jpg", lidoEm: "2026-11-17T11:00:00Z", encontrado: true },
      { trayId: "3", primeiraImagem: "c.jpg", lidoEm: "2026-11-17T11:00:00Z", encontrado: true },
      { trayId: "4", primeiraImagem: "d.jpg", lidoEm: "2026-11-10T11:00:00Z", encontrado: true },
      { trayId: "5", primeiraImagem: "e.jpg", lidoEm: "2026-11-01T11:00:00Z", encontrado: true },
    ],
    agora,
    10,
  );
  confere("nunca lido, depois foto que mudou, depois o mais velho", fila.map((f) => `${f.trayId}:${f.motivo}`).join() === "1:nunca_lido,2:foto_mudou,5:leitura_velha,4:leitura_velha");
  confere("lido há pouco e com a mesma foto não entra", !fila.some((f) => f.trayId === "3"));
  confere("o máximo corta a fila", quemLer([{ trayId: "1", imagemPrincipal: null }, { trayId: "2", imagemPrincipal: null }], [], agora, 1).length === 1);
}

console.log("\nXML e leitura de volta");
{
  const especial = produto({ trayId: "77", nome: "Anel <Lua> & \"Sol\" 'Mar' 💍\u0001" });
  const r = montarItens([produto(), especial], ARVORE, "meta", HOJE);
  const xml = xmlDoArquivo(r.itens);
  confere("declaração UTF-8 e namespace g:", xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">'));
  confere("caractere de controle não entra no XML", !xml.includes("\u0001"));
  const lidos = lerArquivo(xml);
  const escrito = r.itens.find((i) => i.id === "9001");
  const lido = lidos.find((i) => i.id === "9001");
  confere("o que se escreve se lê igual", lidos.length === 2 && JSON.stringify(lido?.campos) === JSON.stringify(escrito?.campos));
  confere("escape de & < > aspas e emoji volta igual", lidos.find((i) => i.id === "77")?.campos.find(([n]) => n === "title")?.[1] === "Anel <Lua> & \"Sol\" 'Mar' 💍");

  const daTray =
    '<?xml version="1.0" encoding="ISO-8859-1"?>\n<rss version="2.0"\nxmlns:g="http://base.google.com/ns/1.0">\n<channel><title>Loja</title><item>\n' +
    "  <g:id>9001</g:id>\n  <g:title>Alian&#231;a de Exemplo&#160;</g:title>\n" +
    "  <g:product_type>An&#233;is &#38;gt; An&#233;is de Formatura &#38;gt; Anel de Ouro 18k</g:product_type>\n" +
    "  \n  <g:description><![CDATA[texto <b>cru</b>]]></g:description>\n  <g:gtin/>\n</item></channel></rss>";
  confere("codificação lida da declaração", codificacaoDoXml(daTray) === "iso-8859-1" && codificacaoDoXml(xml) === "utf-8");
  const [t] = lerArquivo(daTray);
  const tv = (n: string) => t.campos.find(([c]) => c === n)?.[1];
  confere("entidade numérica da Tray vira caractere", tv("title") === "Aliança de Exemplo\u00a0");
  confere(
    "o &#38;gt; da Tray chega como o texto &gt;, igual ao que o painel manda",
    tv("product_type") === valor(campos(produto()), "product_type")[0],
    String(tv("product_type")),
  );
  confere("CDATA e campo vazio", tv("description") === "texto <b>cru</b>" && tv("gtin") === "");
}

console.log("\nComparação");
{
  const base = montarItens([produto({ trayId: "1" }), produto({ trayId: "2" }), produto({ trayId: "3" })], ARVORE, "meta", HOJE).itens;
  const outro = montarItens(
    [produto({ trayId: "1" }), produto({ trayId: "2", preco: { atual: 450, anterior: null } }), produto({ trayId: "4" })],
    ARVORE, "meta", HOJE,
  ).itens;
  const c = compararArquivos(base, outro);
  confere("códigos que faltam e que sobram", c.soNaTray.join() === "3" && c.soNoPainel.join() === "4");
  confere("diferença de preço aparece no campo", c.porCampo.price?.[0]?.id === "2" && c.porCampo.price[0].painel[0] === "450.00 BRL");
  confere("iguais contam só quem bate em tudo", c.iguais === 1);
  confere("críticas somam códigos e campos críticos", c.criticas === 3 && CAMPOS_CRITICOS.has("price"));
  confere("repetido dentro do mesmo arquivo é apontado", compararArquivos([...base, base[0]], base).repetidos.tray.join() === "1");
  confere("todo campo crítico é conferido", [...CAMPOS_CRITICOS].every((cc) => (CAMPOS_CONFERIDOS as readonly string[]).includes(cc)));
  const onde = ondeDifere("abcdef", "abcXef");
  confere("onde dois textos diferem", onde?.posicao === 3 && ondeDifere("a", "a") === null);
}

console.log("\nAs rotas");
{
  const meta = readFileSync("src/app/api/catalogo/meta.xml/route.ts", "utf8");
  const google = readFileSync("src/app/api/catalogo/google.xml/route.ts", "utf8");
  confere("a rota do Meta serve o destino meta", /responderArquivo\("meta"\)/.test(meta));
  confere("a rota do Google serve o destino google", /responderArquivo\("google"\)/.test(google));
  const servir = readFileSync("src/lib/catalogo/servir.ts", "utf8");
  confere("erro responde 503 sem cache, nunca arquivo vazio", /status: 503/.test(servir) && /no-store/.test(servir) && /itens\.length === 0\) throw/.test(servir));
  confere("o preço passa por precoVigente", /precoVigente\(/.test(servir));
  const rotina = readFileSync("src/app/api/cron/catalogo-detalhes/route.ts", "utf8");
  confere("a rotina confere o segredo e deixa pulso", /cronAutorizado/.test(rotina) && /registrarPulso\(\s*supabase,\s*"catalogo-detalhes"/.test(rotina));
  const saude = readFileSync("src/lib/painel/saude.ts", "utf8");
  confere("a rotina aparece na Saúde", /id: "catalogo-detalhes"/.test(saude));
  const textos = [meta, google, servir, rotina, readFileSync("src/lib/catalogo/arquivo.ts", "utf8"), readFileSync("src/lib/catalogo/detalhes.ts", "utf8")];
  confere("nenhum travessão nos arquivos do catálogo", textos.every((t) => !/[\u2013\u2014]/.test(t)));
}

if (falhas > 0) {
  console.error(`\n${falhas} teste(s) falharam.`);
  process.exit(1);
}
console.log("\nTestes puros: tudo certo.");

// ---------------------------------------------------------------------------
// Conferência com o arquivo da Tray, pela internet.

if (process.argv.includes("--sem-internet")) process.exit(0);

const opcao = (nome: string) => process.argv.find((a) => a.startsWith(`--${nome}=`))?.slice(nome.length + 3);
const destino = opcao("destino") === "google" ? "google" : "meta";
const URL_DA_TRAY = opcao("tray") ?? "https://www.jkaliancas.com.br/xml/xml.php?Chave=wav9mYlNWYmx3N4ETNwMTM";
const URL_DO_PAINEL = opcao("painel") ?? `https://www.jkaliancas.com.br/guias/api/catalogo/${destino}.xml`;

async function baixar(url: string): Promise<{ texto: string; quando: string | null; cabecalhos: Headers }> {
  const resp = await fetch(url, { headers: { "User-Agent": "conferencia-do-catalogo" }, cache: "no-store" });
  if (!resp.ok) throw new Error(`${url} respondeu ${resp.status}`);
  const bytes = new Uint8Array(await resp.arrayBuffer());
  const inicio = new TextDecoder("latin1").decode(bytes.subarray(0, 200));
  return { texto: new TextDecoder(codificacaoDoXml(inicio)).decode(bytes), quando: resp.headers.get("last-modified"), cabecalhos: resp.headers };
}

function lerEnv(): Record<string, string> {
  const caminhoEnv = resolve(process.cwd(), ".env.local");
  if (!existsSync(caminhoEnv)) return {};
  const env: Record<string, string> = {};
  for (const linha of readFileSync(caminhoEnv, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(linha);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

type NoBanco = {
  tray_id: string; is_active: boolean; status: string | null; updated_at: string | null;
  categoria: string | null; nome_categoria: string | null;
};

/** O que o banco sabe de cada código que só um dos arquivos tem. */
async function explicar(ids: string[]): Promise<Map<string, NoBanco & { detalhe: boolean; caminho: string | null; entra: boolean | null }>> {
  const env = { ...lerEnv(), ...process.env } as Record<string, string | undefined>;
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = env.SUPABASE_SERVICE_ROLE_KEY;
  const saida = new Map<string, NoBanco & { detalhe: boolean; caminho: string | null; entra: boolean | null }>();
  if (!url || !chave || ids.length === 0) return saida;
  const pedir = async (caminhoRest: string) => {
    const r = await fetch(`${url}/rest/v1/${caminhoRest}`, { headers: { apikey: chave, Authorization: `Bearer ${chave}` } });
    if (!r.ok) throw new Error(`${caminhoRest.split("?")[0]} respondeu ${r.status}`);
    return r.json();
  };
  const categorias = ((await pedir("catalogo_categorias?select=tray_id,nome,pai")) as { tray_id: string; nome: string; pai: string | null }[]).map((c) => ({ id: c.tray_id, nome: c.nome, pai: c.pai }));
  const mapa = new Map(categorias.map((c) => [c.id, c]));
  for (let i = 0; i < ids.length; i += 100) {
    const lote = ids.slice(i, i + 100).join(",");
    const produtos = (await pedir(
      `products?select=tray_id,is_active,status,updated_at,categoria:raw->>category_id,nome_categoria:raw->Category->>name&tray_id=in.(${lote})`,
    )) as NoBanco[];
    const detalhes = new Set(((await pedir(`catalogo_detalhes?select=tray_id&encontrado=eq.true&tray_id=in.(${lote})`)) as { tray_id: string }[]).map((d) => d.tray_id));
    for (const p of produtos) {
      const cam = caminhoDaCategoria(p.categoria, mapa);
      saida.set(p.tray_id, { ...p, detalhe: detalhes.has(p.tray_id), caminho: cam ? cam.map((c) => c.nome).join(" > ") : null, entra: cam ? categoriaEntra(cam) : null });
    }
  }
  return saida;
}

const horaSP = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)) : "?";

const curto = (v: string[]) => (v.length === 0 ? "(nada)" : v.map((x) => (x.length > 90 ? `${x.slice(0, 90)}...` : x)).join(" | "));

console.log(`\nConferência do arquivo do ${destino === "meta" ? "Meta" : "Google"}`);
console.log(`  Tray:   ${URL_DA_TRAY.replace(/Chave=[^&]+/, "Chave=...")}`);
console.log(`  Painel: ${URL_DO_PAINEL}`);

let tray: Awaited<ReturnType<typeof baixar>>;
let painel: Awaited<ReturnType<typeof baixar>>;
try {
  [tray, painel] = await Promise.all([baixar(URL_DA_TRAY), baixar(URL_DO_PAINEL)]);
} catch (e) {
  console.error(`\nNão foi possível baixar os arquivos: ${(e as Error).message}`);
  process.exit(2);
}

const itensDaTray = lerArquivo(tray.texto);
const itensDoPainel = lerArquivo(painel.texto);
const c = compararArquivos(itensDaTray, itensDoPainel);
const geradoPelaTray = tray.quando ? new Date(tray.quando).toISOString() : null;

console.log(`\n  Arquivo da Tray gerado em ${horaSP(geradoPelaTray)} (São Paulo).`);
console.log(`  Itens: Tray ${c.naTray}, painel ${c.noPainel}, idênticos em todos os campos ${c.iguais}.`);
const semDetalhe = painel.cabecalhos.get("x-catalogo-sem-detalhe");
if (semDetalhe && semDetalhe !== "0") console.log(`  O painel avisou ${semDetalhe} itens sem os detalhes da API (uma foto só, descrição curta).`);
if (c.repetidos.tray.length || c.repetidos.painel.length) console.log(`  Códigos repetidos: Tray ${c.repetidos.tray.join(", ") || "nenhum"}; painel ${c.repetidos.painel.join(", ") || "nenhum"}.`);

const explicacoes = await explicar([...c.soNaTray, ...c.soNoPainel]).catch((e) => {
  console.log(`  (sem explicação pelo banco: ${(e as Error).message})`);
  return new Map();
});

function porQue(id: string, lado: "tray" | "painel"): string {
  const e = explicacoes.get(id);
  if (!e) return explicacoes.size ? "não existe no espelho do painel" : "";
  const partes: string[] = [];
  if (!e.is_active) partes.push("desativado no espelho");
  else if (e.status !== "available") partes.push("indisponível no espelho");
  else if (e.entra === false) partes.push(`categoria fora da regra (${e.caminho})`);
  else if (e.entra === null) partes.push(`categoria ${e.categoria} fora da árvore guardada`);
  else partes.push(`disponível, categoria ${e.caminho}`);
  if (e.updated_at && geradoPelaTray && Date.parse(e.updated_at) > Date.parse(geradoPelaTray)) partes.push(`mudou no espelho às ${horaSP(e.updated_at)}, depois do arquivo da Tray`);
  if (lado === "painel" && !e.detalhe) partes.push("ainda sem detalhe da API");
  return partes.join("; ");
}

if (c.soNaTray.length) {
  console.log(`\n  Só na Tray (${c.soNaTray.length}):`);
  for (const id of c.soNaTray) console.log(`    ${id}: ${porQue(id, "tray")}`);
}
if (c.soNoPainel.length) {
  console.log(`\n  Só no painel (${c.soNoPainel.length}):`);
  for (const id of c.soNoPainel) console.log(`    ${id}: ${porQue(id, "painel")}`);
}

for (const campo of CAMPOS_CONFERIDOS) {
  const lista = c.porCampo[campo];
  if (!lista?.length) {
    console.log(`  ok  ${campo}: igual nos ${c.naTray - c.soNaTray.length} itens em comum`);
    continue;
  }
  console.log(`\n  ${CAMPOS_CRITICOS.has(campo) ? "CRÍTICO" : "difere"} ${campo}: ${lista.length} itens`);
  for (const d of lista.slice(0, campo === "description" ? 4 : 8)) {
    if (campo === "description") {
      const o = ondeDifere(d.tray[0] ?? "", d.painel[0] ?? "");
      console.log(`    ${d.id}: a partir do caractere ${o?.posicao} (Tray ${Array.from(d.tray[0] ?? "").length}, painel ${Array.from(d.painel[0] ?? "").length})`);
      console.log(`      Tray:   ${JSON.stringify(o?.tray)}`);
      console.log(`      painel: ${JSON.stringify(o?.painel)}`);
    } else {
      console.log(`    ${d.id}: Tray ${curto(d.tray)}  /  painel ${curto(d.painel)}`);
    }
  }
  if (lista.length > 8) console.log(`    ... e mais ${lista.length - 8}`);
}

console.log(`\n  Diferenças críticas: ${c.criticas}.`);
process.exit(c.criticas > 0 ? 1 : 0);
