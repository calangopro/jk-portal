import Link from "next/link";
import { PainelDeAnuncios, type LinhaDeAnuncio } from "@/app/admin/(painel)/anuncios/PainelDeAnuncios";
import type { Parametros } from "@/lib/margem/calculo";
import type { Demo } from "../tipos";

/** Limite de anúncio com produtos, preços e custos inventados, redondos. */
const parametros: Parametros = { cotacao18k: 500, cotacao10k: 300, taxa: 0.05, imposto: 0.1, frete: 0, embalagem: 10, margemMinima: 0.3 };

const p = (id: string, nome: string, categoria: string, vendidos: number, preco: number, custo: number | null): LinhaDeAnuncio => ({
  id, trayId: id, nome, categoria, vendidos, precoCheio: preco, precoHoje: preco, custo, falta: custo === null ? "Falta o custo" : null,
});

const linhas: LinhaDeAnuncio[] = [
  p("1001", "Par de alianças Exemplo Ouro 18k", "Alianças de casamento", 120, 4000, 1500),
  p("1002", "Par de alianças Exemplo Ouro 10k", "Alianças de casamento", 90, 3000, 1200),
  p("1003", "Par de alianças Exemplo Prata", "Alianças de namoro", 300, 800, 250),
  p("1004", "Par de alianças Exemplo Semijoia", "Alianças de namoro", 200, 300, 120),
  p("1005", "Anel solitário Exemplo", "Anéis", 60, 2000, 800),
  p("1006", "Brinco Exemplo", "Brincos", 40, 600, 450),
  p("1007", "Par de alianças Exemplo Aço", "Alianças de namoro", 150, 200, 160),
  p("1008", "Aliança Exemplo sem custo", "Alianças de casamento", 20, 2500, null),
];

const demo: Demo = {
  caminho: "/admin/anuncios",
  desenho: () => (
    <div data-painel-largo>
      <header>
        <p className="eyebrow">Tráfego</p>
        <h1 className="font-display mt-2 text-4xl text-ink">Anúncios</h1>
        <p className="mt-3 max-w-3xl text-muted">
          Quanto cada produto aguenta pagar de anúncio por venda sem ficar abaixo da margem mínima. É o número para o
          lance de custo por resultado no Meta e no Google. Usa o custo e os parâmetros de{" "}
          <Link href="/admin/margem" className="font-semibold text-brand-nav hover:underline">Margem</Link>.
        </p>
      </header>
      <PainelDeAnuncios linhas={linhas} parametros={parametros} />
    </div>
  ),
};
export default demo;
