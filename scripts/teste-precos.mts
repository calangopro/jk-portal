/**
 * Confere o contrato entre o HTML que a vitrine gera e a troca de preço no
 * servidor, e a janela da promoção que decide qual preço vale. Roda sem banco
 * e sem navegador:
 *   node --experimental-strip-types scripts/teste-precos.mts
 *
 * O caso de teste é HTML REAL, copiado do que o editor gravou, e não um exemplo
 * escrito à mão. Exemplo à mão passaria mesmo se o editor mudasse o markup, que
 * é justamente a falha que este teste existe para pegar.
 *
 * As linhas passam por `precoVigente`, o mesmo caminho de `comPrecosAtuais`,
 * então o que se testa aqui é a linha do banco virando texto no card.
 */
import { aplicarPrecos, type LinhaDeProduto } from "../src/lib/conteudo/precos-html.ts";
import { hojeEmSaoPaulo, precoVigente } from "../src/lib/tray/preco.ts";

/** Dia fixo, para o teste não mudar de resultado conforme a data em que roda. */
const HOJE = "2026-09-24";

type Bruta = {
  id: string;
  price: number | null;
  promotional_price: number | null;
  start_promotion?: string | null;
  end_promotion?: string | null;
  status: string | null;
  availability_text: string | null;
};

function linhas(brutas: Bruta[], hoje = HOJE): LinhaDeProduto[] {
  return brutas.map((b) => ({
    id: b.id,
    preco: precoVigente(b, hoje),
    status: b.status,
    availability_text: b.availability_text,
  }));
}

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
  const r = aplicarPrecos(html, linhas([
    { id: ID, price: 1290, promotional_price: null, status: "available", availability_text: "Pronta entrega" },
  ]));
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
  const r = aplicarPrecos(html, linhas([
    {
      id: ID, price: 1000, promotional_price: 750,
      start_promotion: "2026-09-01", end_promotion: "2026-09-30",
      status: "available", availability_text: null,
    },
  ]));
  confere("preço promocional na frente", /produto-card__preco"[^>]*>R\$\s750,00</.test(r));
  confere("preço cheio riscado apareceu", /<s class="produto-card__antigo" data-antigo-de="[^"]+">R\$\s1\.000,00<\/s>/.test(r));
  confere("selo de desconto apareceu", r.includes(">25% OFF<"));
  confere("nenhum hidden sobrou no preço antigo", !/produto-card__antigo[^>]*hidden/.test(r));
  confere("aviso sem prazo some", /produto-card__aviso[^>]*hidden/.test(r));
}

console.log("\n3. Produto ficou sem estoque (a loja tira a página do ar)");
{
  const r = aplicarPrecos(html, linhas([
    {
      id: ID, price: 1000, promotional_price: 750,
      start_promotion: "2026-09-01", end_promotion: "2026-09-30",
      status: "unavailable", availability_text: "Sob encomenda",
    },
  ]));
  confere("avisa que acabou", r.includes(">Sem estoque no momento<"));
  confere("o prazo antigo não fica junto", !r.includes("Sob encomenda"));
  confere("não anuncia preço", /produto-card__preco[^>]*hidden/.test(r) && !r.includes("974,90"));
  confere("nem promoção", !r.includes("750,00") && !r.includes("1.000,00") && !r.includes("% OFF"));
}

console.log("\n4. Produto sumiu do catálogo");
{
  const r = aplicarPrecos(html, []);
  confere("HTML sai intacto", r === html);
}

console.log("\n5. Produto sem preço");
{
  const r = aplicarPrecos(html, linhas([
    { id: ID, price: null, promotional_price: null, status: "available", availability_text: null },
  ]));
  confere("o preço some em vez de virar R$ 0,00", /produto-card__preco[^>]*hidden/.test(r));
  confere("não sobrou valor antigo na tela", !r.includes("974,90"));
}

console.log("\n6. Id de outro produto não encosta neste card");
{
  const r = aplicarPrecos(html, linhas([
    { id: "11111111-2222-3333-4444-555555555555", price: 1, promotional_price: null, status: "available", availability_text: null },
  ]));
  confere("HTML sai intacto", r === html);
}

console.log("\n7. Promoção vencida (a Tray não apaga o preço promocional)");
{
  // Caso real, Kit Forever 3mm (tray_id 1637), conferido na loja em 24/09/2026:
  // a loja cobra 409,90, e o banco ainda guarda 369,90 da promoção de março.
  const r = aplicarPrecos(html, linhas([
    {
      id: ID, price: 409.9, promotional_price: 369.9,
      start_promotion: "2026-03-01", end_promotion: "2026-03-31",
      status: "available", availability_text: null,
    },
  ]));
  confere("mostra o preço cheio", /produto-card__preco"[^>]*>R\$\s409,90</.test(r));
  confere("o promocional vencido não aparece", !r.includes("369,90"));
  confere("preço riscado continua escondido", /produto-card__antigo[^>]*hidden/.test(r));
  confere("selo continua escondido", /produto-card__selo[^>]*hidden/.test(r));
}

console.log("\n8. Janela da promoção, ponta a ponta");
{
  const base = { price: 449.9, promotional_price: 399.9 };
  const setembro = { ...base, start_promotion: "2026-09-01", end_promotion: "2026-09-30" };
  const vale = (p: Parameters<typeof precoVigente>[0], hoje: string) =>
    precoVigente(p, hoje).atual === 399.9;

  // Eternal Love (tray_id 217): janela de 01/09 a 30/09, "de 449,90 por 399,90" na loja.
  confere("dentro da janela vale", vale(setembro, "2026-09-24"));
  confere("primeiro dia vale", vale(setembro, "2026-09-01"));
  confere("último dia vale (fim inclusivo)", vale(setembro, "2026-09-30"));
  confere("dia seguinte ao fim não vale", !vale(setembro, "2026-10-01"));
  confere("véspera do início não vale", !vale(setembro, "2026-08-31"));
  confere("datas vazias são janela aberta", vale({ ...base, start_promotion: "", end_promotion: "" }, HOJE));
  confere("0000-00-00 é janela aberta", vale({ ...base, start_promotion: "0000-00-00", end_promotion: "0000-00-00" }, HOJE));
  confere("sem data nenhuma é janela aberta", vale(base, HOJE));
  confere("só com início, depois dele vale", vale({ ...base, start_promotion: "2026-09-01" }, HOJE));
  confere("só com fim, depois dele não vale", !vale({ ...base, end_promotion: "2026-09-23" }, HOJE));
  confere(
    "promocional maior que o cheio não vira promoção",
    precoVigente({ price: 100, promotional_price: 120 }, HOJE).anterior === null,
  );
}

console.log("\n9. O dia é o de São Paulo, não o do servidor");
{
  // 02:30 em UTC do dia 25 ainda é 23:30 do dia 24 em São Paulo. A Vercel roda
  // em UTC, e sem o fuso a promoção acabaria três horas antes da loja.
  confere("23:30 em SP ainda é o dia 24", hojeEmSaoPaulo(new Date("2026-09-25T02:30:00Z")) === "2026-09-24");
  confere("00:30 em SP já é o dia 25", hojeEmSaoPaulo(new Date("2026-09-25T03:30:00Z")) === "2026-09-25");
}

console.log(falhas === 0 ? "\nTodos os casos passaram.\n" : `\n${falhas} caso(s) falharam.\n`);
process.exit(falhas === 0 ? 0 : 1);
