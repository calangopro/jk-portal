"use client";

import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import {
  ChevronLeft, ChevronRight, Plus, RectangleHorizontal, RectangleVertical,
  ShoppingBag, Square, Trash2,
} from "lucide-react";
import {
  FORMATOS, MAXIMO_DE_PRODUTOS, descontoEmTexto, formatoValido, moeda,
  type FormatoDaVitrine, type ProdutoDoBloco,
} from "./VitrineNode";

/**
 * Vitrine no editor: o mesmo desenho do site, com controles por cima.
 *
 * As classes são as MESMAS do HTML publicado (`produto-card`, `vitrine`), então
 * o que aparece aqui é o que vai ao ar. O que muda é a casca: aqui cada card é
 * um `<span>`, não um `<a>`, porque link dentro do editor levaria a pessoa para
 * a loja no meio da escrita.
 */

const ICONE_DO_FORMATO: Record<FormatoDaVitrine, typeof Square> = {
  vertical: RectangleVertical,
  quadrado: Square,
  horizontal: RectangleHorizontal,
};

const btControle =
  "flex h-7 w-7 items-center justify-center rounded-full border border-border bg-white text-ink shadow-[var(--jk-sombra-menu)] transition-colors hover:border-brand hover:bg-brand/14 disabled:cursor-not-allowed disabled:opacity-35";

export function VitrineView({ node, updateAttributes, deleteNode, selected, extension }: NodeViewProps) {
  const formato = formatoValido(node.attrs.formato);
  const produtos = (node.attrs.produtos ?? []) as ProdutoDoBloco[];

  const trocar = (lista: ProdutoDoBloco[]) => {
    if (lista.length === 0) {
      deleteNode();
      return;
    }
    updateAttributes({ produtos: lista });
  };

  const mover = (de: number, para: number) => {
    if (para < 0 || para >= produtos.length) return;
    const lista = [...produtos];
    const [item] = lista.splice(de, 1);
    lista.splice(para, 0, item);
    trocar(lista);
  };

  const adicionar = () => {
    const pedir = extension.options.aoPedirProduto as
      | ((aceitar: (p: ProdutoDoBloco) => void) => void)
      | undefined;
    if (!pedir) return;
    // O nó guarda a lista de agora numa variável local. Sem isso, escolher dois
    // produtos seguidos faria o segundo apagar o primeiro, porque `produtos`
    // aqui é a leitura de quando o botão foi desenhado.
    const antes = produtos;
    pedir((novo) => {
      if (antes.length >= MAXIMO_DE_PRODUTOS) return;
      try {
        updateAttributes({ produtos: [...antes, novo] });
      } catch {
        // A vitrine pode ter sido apagada enquanto a janela de busca estava
        // aberta. Perder o produto escolhido é chato; derrubar o editor é pior.
      }
    });
  };

  const cheia = produtos.length >= MAXIMO_DE_PRODUTOS;

  return (
    <NodeViewWrapper
      className={`vitrine-editor ${selected ? "vitrine-editor--ativa" : ""}`}
      data-arrastar
    >
      <div className="vitrine-editor__barra" contentEditable={false}>
        <span className="vitrine-editor__marca">
          <ShoppingBag size={13} />
          {produtos.length === 1 ? "1 produto" : `${produtos.length} produtos`}
        </span>

        <span className="vitrine-editor__formatos" role="group" aria-label="Formato do card">
          {FORMATOS.map(({ valor, nome, ajuda }) => {
            const Icone = ICONE_DO_FORMATO[valor];
            return (
              <button
                key={valor}
                type="button"
                title={`${nome}: ${ajuda}`}
                aria-pressed={formato === valor}
                onClick={() => updateAttributes({ formato: valor })}
                className={`vitrine-editor__formato ${formato === valor ? "is-ativo" : ""}`}
              >
                <Icone size={13} /> {nome}
              </button>
            );
          })}
        </span>

        <button
          type="button"
          onClick={adicionar}
          disabled={cheia}
          title={cheia ? "Quatro é o limite: mais que isso o card fica ilegível." : "Adicionar produto"}
          className="vitrine-editor__adicionar"
        >
          <Plus size={13} /> Produto
        </button>
      </div>

      <div className={`vitrine vitrine--${formato}`} data-n={produtos.length} contentEditable={false}>
        {produtos.map((p, i) => {
          const preco = moeda(p.preco);
          const antigo = moeda(p.precoAntigo);
          const desconto = descontoEmTexto(p.preco, p.precoAntigo);
          const aviso = !p.disponivel ? "Sem estoque no momento" : p.prazo || "";

          return (
            <span key={`${p.id ?? p.nome}-${i}`} className="produto-card vitrine-editor__card">
              <span className="produto-card__midia">
                {p.imagem ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imagem} alt={p.nome} loading="lazy" />
                ) : (
                  <span className="produto-card__semfoto">Sem foto</span>
                )}
                {desconto ? <span className="produto-card__selo">{desconto}</span> : null}
              </span>

              <span className="produto-card__corpo">
                <span className="produto-card__nome">{p.nome}</span>
                <span className="produto-card__precos">
                  {antigo ? <s className="produto-card__antigo">{antigo}</s> : null}
                  {preco ? <strong className="produto-card__preco">{preco}</strong> : null}
                </span>
                {aviso ? <span className="produto-card__aviso">{aviso}</span> : null}
                <span className="produto-card__acao">Ver produto</span>
              </span>

              <span className="vitrine-editor__controles">
                <button
                  type="button" className={btControle} title="Mover para a esquerda"
                  aria-label={`Mover ${p.nome} para a esquerda`}
                  disabled={i === 0} onClick={() => mover(i, i - 1)}
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  type="button" className={btControle} title="Mover para a direita"
                  aria-label={`Mover ${p.nome} para a direita`}
                  disabled={i === produtos.length - 1} onClick={() => mover(i, i + 1)}
                >
                  <ChevronRight size={14} />
                </button>
                <button
                  type="button" className={btControle} title="Remover este produto"
                  aria-label={`Remover ${p.nome}`}
                  onClick={() => trocar(produtos.filter((_, j) => j !== i))}
                >
                  <Trash2 size={14} />
                </button>
              </span>
            </span>
          );
        })}
      </div>
    </NodeViewWrapper>
  );
}
