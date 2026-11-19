import { Catalogo } from "@/app/admin/(painel)/produtos/Catalogo";
import type { AcoesDeExemplo } from "@/app/admin/(painel)/produtos/Gaveta";
import type { MargemNaLista } from "@/app/admin/(painel)/produtos/util";
import type { ItemDoCatalogo, Padroes } from "@/lib/catalogo/fotos";
import type { EstadoNaLoja } from "@/lib/loja/produto";
import type { Demo } from "../tipos";

const item = (n: number, nome: string, categoria: string, preco: number, vendidos: number, estado: ItemDoCatalogo["estado"] = "falta"): ItemDoCatalogo => ({
  id: `exemplo-${n}`, trayId: String(1000 + n), nome, url: null, categoriaId: categoria.startsWith("Alianças de ouro") ? "c1" : "c2", categoria,
  preco, precoAntes: null, disponivel: true, vendidos, miniatura: null, imagem: null, estado, nota: null, reservadoAte: null,
});

const itens: ItemDoCatalogo[] = [
  item(1, "Par de alianças de ouro 18k", "Alianças de ouro 18k", 3000, 90),
  item(2, "Par de alianças de ouro 18k abauladas", "Alianças de ouro 18k", 3500, 70, "aguardando"),
  item(3, "Par de alianças de ouro 18k anatômicas", "Alianças de ouro 18k", 4000, 40, "na_loja"),
  item(4, "Par de alianças de prata", "Alianças de prata", 500, 60),
  item(5, "Par de alianças de prata lisas", "Alianças de prata", 600, 30, "aprovada"),
  item(6, "Anel solitário de prata", "Anéis", 400, 20),
];
const padroes: Padroes = { geral: "", porCategoria: {} };

const atual: EstadoNaLoja = {
  nome: "Par de alianças de ouro 18k", preco: 3000, promocional: null, promocaoDe: null, promocaoAte: null, estoque: 10, disponivel: true,
  titulo: "Par de alianças de ouro 18k", palavrasChave: "", resumo: "Par de alianças em ouro 18k.", descricao: "", itensInclusos: "", mensagemAdicional: "",
  categoria: "c1", outrasCategorias: [], marca: "", modelo: "", referencia: "", peso: null, comprimento: null, largura: null, altura: null,
  prazo: "", prazoDias: 2, estoqueMinimo: 0, garantia: "", video: "", ean: "", ncm: "", destaque: false, lancamento: false,
};

const exemplo: AcoesDeExemplo = {
  lerProduto: async () => {
    "use server";
    return { ok: true as const, fotos: [], padrao: "", padraoDaCategoria: false };
  },
  lerNaLoja: async () => {
    "use server";
    return { estado: "ok" as const, atual, categorias: [{ id: "c1", nome: "Alianças de ouro 18k", ativa: true }, { id: "c2", nome: "Alianças de prata", ativa: true }] };
  },
  preverNaLoja: async (_trayId, edicao) => {
    "use server";
    const dinheiro = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const mudancas = [
      edicao.nome !== undefined && edicao.nome !== atual.nome ? { campo: "nome" as const, rotulo: "Nome", antes: atual.nome, depois: edicao.nome } : null,
      edicao.preco !== undefined && edicao.preco !== atual.preco ? { campo: "preco" as const, rotulo: "Preço", antes: dinheiro(atual.preco), depois: dinheiro(edicao.preco) } : null,
      edicao.promocional ? { campo: "promocional" as const, rotulo: "Preço promocional", antes: "sem promoção", depois: dinheiro(edicao.promocional) } : null,
      edicao.estoque !== undefined && edicao.estoque !== atual.estoque ? { campo: "estoque" as const, rotulo: "Estoque", antes: String(atual.estoque), depois: String(edicao.estoque) } : null,
    ].filter((m): m is NonNullable<typeof m> => m !== null);
    return { estado: "previa" as const, atual, mudancas, avisos: [] };
  },
  gravarNaLoja: async () => {
    "use server";
    return { estado: "nao_achado" as const };
  },
};

const margens: Record<string, MargemNaLista> = Object.fromEntries(
  itens.map((p) => [p.id, {
    custo: 1500, detalhe: null, falta: null, reais: 1500, fracao: 0.5, descontoMaximo: 0.2, abaixo: false, descontoHoje: null, fracaoHoje: null, hojePassa: false,
    cpaMaximo: 300, cpaEmpate: 1500, roasMinimo: 10, material: "ouro_18k", familia: "F01", gramas: 6, resto: 100, custoFixo: null,
  } as MargemNaLista]),
);

const demo: Demo = {
  caminho: "/admin/produtos",
  desenho: (nivel) => (
    <div data-painel-largo>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow">Loja</p>
          <h1 className="font-display mt-2 text-4xl text-ink">Produtos</h1>
          <p className="mt-3 max-w-2xl text-muted">As peças da loja, por categoria, da que mais vende para a que menos.</p>
        </div>
        <p className="text-xs text-muted">Preço e estoque vêm da Tray. Última leitura da loja: 19/11, 08:00.</p>
      </header>
      <Catalogo
        itens={itens}
        padroes={padroes}
        margens={nivel === "gm" ? margens : null}
        loja={{ podePreco: nivel === "gm" }}
        exemplo={exemplo}
      />
    </div>
  ),
};
export default demo;
