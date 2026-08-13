/**
 * Confere o contrato entre o HTML que a vitrine gera e a troca de preço no
 * servidor. Roda sem banco e sem navegador:
 *   node --experimental-strip-types scripts/teste-precos.mts
 *
 * O caso de teste é HTML REAL, copiado do que o editor gravou, e não um exemplo
 * escrito à mão. Exemplo à mão passaria mesmo se o editor mudasse o markup, que
 * é justamente a falha que este teste existe para pegar.
 */
import { aplicarPrecos } from "../src/lib/conteudo/precos-html.ts";

const ID = "0e684015-8a01-4cdb-9e89-239e2d771937";

const html =
  `<p>Comparando.</p><div class="vitrine vitrine--quadrado" data-vitrine="" data-formato="quadrado" data-n="1">` +
  `<a class="produto-card" href="https://loja/x" target="_blank" rel="noopener sponsored" data-produto="" ` +
  `data-produto-id="${ID}" data-nome="Aliança de Ouro 18k" data-preco="974.9" data-preco-antigo="" ` +
  `data-disponivel="1" data-prazo="Disponível em 3 dias úteis">` +
  `<span class="produto-card__midia"><img src="https://x/y.jpg" alt="Aliança de Ouro 18k" loading="lazy" decoding="async">` +
  `<span class="produto-card__selo" data-selo-de="${ID}" hidden=""></span></span>` +
  `<span class="produto-card__corpo"><span class="produto-card__nome">Aliança de Ouro 18k</span>` +
  `<span class="produto-card__precos"><s class="produto-card__antigo" data-antigo-de="${ID}" hidden=""></s>` +
  `<strong class="produto-card__preco" data-preco-de="${ID}">R$&nbsp;974,90</strong></span>` +
  `<span class="produto-card__aviso" data-aviso-de="${ID}">Disponível em 3 dias úteis</span>` +
  `<span class="produto-card__acao">Ver produto</span></span></a></div>`;

let falhas = 0;
function confere(nome: string, condicao: boolean, detalhe = "") {
  if (condicao) console.log(`  ok   ${nome}`);
  else { falhas += 1; console.log(`  FALHA ${nome} ${detalhe}`); }
}

console.log("\n1. Preço subiu, sem promoção");
{
  const r = aplicarPrecos(html, [
    { id: ID, price: 1290, promotional_price: null, status: "available", availability_text: "Pronta entrega" },
  ]);
  confere("mostra o preço novo", /produto-card__preco"[^>]*>R\$\s1\.290,00</.test(r));
  confere("o preço velho sumiu", !r.includes("974,90"));
  confere("preço antigo continua escondido", /produto-card__antigo[^>]*hidden/.test(r));
  confere("selo continua escondido", /produto-card__selo[^>]*hidden/.test(r));
  confere("aviso vira o prazo novo", r.includes(">Pronta entrega<"));
  confere("nada mais no HTML mudou", r.replace(/<(strong|s|span) class="produto-card__(preco|antigo|selo|aviso)"[\s\S]*?<\/\1>/g, "@")
    === html.replace(/<(strong|s|span) class="produto-card__(preco|antigo|selo|aviso)"[\s\S]*?<\/\1>/g, "@"));
}

console.log("\n2. Entrou em promoção (elementos escondidos precisam APARECER)");
{
  const r = aplicarPrecos(html, [
    { id: ID, price: 1000, promotional_price: 750, status: "available", availability_text: null },
  ]);
  confere("preço promocional na frente", /produto-card__preco"[^>]*>R\$\s750,00</.test(r));
  confere("preço cheio riscado apareceu", /<s class="produto-card__antigo" data-antigo-de="[^"]+">R\$\s1\.000,00<\/s>/.test(r));
  confere("selo de desconto apareceu", r.includes(">25% OFF<"));
  confere("nenhum hidden sobrou no preço antigo", !/produto-card__antigo[^>]*hidden/.test(r));
  confere("aviso sem prazo some", /produto-card__aviso[^>]*hidden/.test(r));
}

console.log("\n3. Produto ficou sem estoque");
{
  const r = aplicarPrecos(html, [
    { id: ID, price: 974.9, promotional_price: null, status: "unavailable", availability_text: "Sob encomenda" },
  ]);
  confere("avisa que acabou", r.includes(">Sem estoque no momento<"));
  confere("o prazo antigo não fica junto", !r.includes("Sob encomenda"));
}

console.log("\n4. Produto sumiu do catálogo");
{
  const r = aplicarPrecos(html, []);
  confere("HTML sai intacto", r === html);
}

console.log("\n5. Produto sem preço");
{
  const r = aplicarPrecos(html, [
    { id: ID, price: null, promotional_price: null, status: "available", availability_text: null },
  ]);
  confere("o preço some em vez de virar R$ 0,00", /produto-card__preco[^>]*hidden/.test(r));
  confere("não sobrou valor antigo na tela", !r.includes("974,90"));
}

console.log("\n6. Id de outro produto não encosta neste card");
{
  const r = aplicarPrecos(html, [
    { id: "11111111-2222-3333-4444-555555555555", price: 1, promotional_price: null, status: "available", availability_text: null },
  ]);
  confere("HTML sai intacto", r === html);
}

console.log(falhas === 0 ? "\nTodos os casos passaram.\n" : `\n${falhas} caso(s) falharam.\n`);
process.exit(falhas === 0 ? 0 : 1);
