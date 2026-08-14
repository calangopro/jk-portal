"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useEditor, EditorContent, ReactNodeViewRenderer, type Editor as EditorTipTap } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import LinkExt from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import { TabelaNode, CabecalhoDeTabela } from "@/lib/editor/TabelaNode";
import { VideoNode } from "@/lib/editor/VideoNode";
import { VitrineNode, type ProdutoDoBloco } from "@/lib/editor/VitrineNode";
import { VitrineView } from "@/lib/editor/VitrineView";
import { ImagemNode } from "@/lib/editor/ImagemNode";
import { FiguraNode } from "@/lib/editor/FiguraNode";
import { PreviewDeResultado } from "./PreviewDeResultado";
import {
  Plus, Type, Heading2, Heading3, ImageIcon, List, ListOrdered, Quote, Minus,
  Table as TableIcon, Bold, Italic, Link2, Undo2, Redo2, Pencil, Sparkles,
  CirclePlay, ShoppingBag, MessageCircleQuestion, Search, FileText,
  Zap, Check, X, Loader2, AlertTriangle, ShieldCheck, Lightbulb, Footprints, MousePointerClick,
  CalendarClock, Quote as QuoteIcon, Wrench,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { paraWebp } from "@/lib/midia/webp";
import { BotaoPrompt } from "./BotaoPrompt";
import { PainelAnalise } from "./PainelAnalise";
import { SeletorProduto } from "./SeletorProduto";
import { SeletorImagem } from "./SeletorImagem";
import { SeletorLink } from "./SeletorLink";
import { MARCA_PENDENTE } from "@/lib/editor/modelos";
import { FaqNode } from "@/lib/editor/FaqNode";
import { ChamadaNode } from "@/lib/editor/ChamadaNode";
import { FonteNode } from "@/lib/editor/FonteNode";
import { FerramentaNode } from "@/lib/editor/FerramentaNode";
import { FERRAMENTAS } from "@/lib/ferramentas/registro";
import { DestaqueNode } from "@/lib/editor/DestaqueNode";
import { ListaDePassos } from "@/lib/editor/PassosNode";
import { Fontes } from "./Fontes";
import { PainelFatos } from "./PainelFatos";
import { SeletorDeFonte } from "./SeletorDeFonte";
import { Historico } from "./Historico";
import { Agendamento } from "./Agendamento";
import type { Fato } from "@/lib/content/fatos";
import { faqsDoHtml, faqsUnidas } from "@/lib/content/faq-html";
import { acharChoques, type PaginaComparavel } from "@/lib/analyzer/canibalizacao";
import {
  salvarConteudo, publicarConteudo, voltarParaRascunho, ajudarAEscrever, linkDePreview, vincularImagem,
  definirCapa, removerCapa,
} from "./actions";
import type { ContentRow, OpcaoDeAutor } from "@/lib/data/admin-contents";
import type { Fonte, ImagemDaBiblioteca } from "./actions";

type Faq = { question: string; answer: string };

const campo =
  "w-full rounded-[12px] border border-border bg-white/80 px-4 py-3 text-ink outline-none transition-colors placeholder:text-muted/50 hover:border-brand/40 focus:border-brand";

/** Cabeçalho de seção: diz o que é aquela área e por que ela importa. */
function Secao({
  Icone, titulo, ajuda, acao,
}: {
  Icone: typeof Type;
  titulo: string;
  ajuda?: string;
  acao?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] border border-brand/30 bg-brand/10 text-brand-nav">
          <Icone size={14} />
        </span>
        <div>
          <p className="text-sm font-semibold text-ink">{titulo}</p>
          {ajuda ? <p className="mt-0.5 text-xs leading-relaxed text-muted">{ajuda}</p> : null}
        </div>
      </div>
      {acao}
    </div>
  );
}

type ItemDeBloco = {
  tipo: string;
  label: string;
  desc: string;
  Icone: typeof Type;
  /** Palavras extras que o filtro do "/" aceita, além do próprio rótulo. */
  termos: string;
};

const GRUPOS_DE_BLOCO: { nome: string; itens: ItemDeBloco[] }[] = [
  {
    nome: "Texto",
    itens: [
      { tipo: "paragrafo", label: "Parágrafo", desc: "Texto comum", Icone: Type, termos: "texto p linha" },
      { tipo: "h2", label: "Título de seção", desc: "H2, divide o conteúdo", Icone: Heading2, termos: "h2 titulo cabecalho secao" },
      { tipo: "h3", label: "Subtítulo", desc: "H3, dentro da seção", Icone: Heading3, termos: "h3 subtitulo" },
      { tipo: "citacao", label: "Citação", desc: "Destaque de fala", Icone: Quote, termos: "aspas quote destaque" },
      { tipo: "destaque", label: "Resumo em destaque", desc: "Trecho que a IA cita", Icone: Lightbulb, termos: "resumo caixa aviso importante nota" },
      { tipo: "fonte", label: "Trecho com fonte", desc: "Mostra a origem para quem lê", Icone: QuoteIcon, termos: "fonte evidencia origem citacao prova referencia" },
    ],
  },
  {
    nome: "Estrutura",
    itens: [
      { tipo: "lista", label: "Lista", desc: "Com marcadores", Icone: List, termos: "bullet marcador topicos" },
      { tipo: "listaNum", label: "Lista numerada", desc: "Sequência simples", Icone: ListOrdered, termos: "numero ordenada" },
      { tipo: "passos", label: "Passo a passo", desc: "Vira HowTo no schema", Icone: Footprints, termos: "howto tutorial como fazer etapas passos" },
      { tipo: "tabela", label: "Tabela", desc: "Comparação, a IA extrai muito bem", Icone: TableIcon, termos: "comparacao grade colunas" },
      { tipo: "faq", label: "Perguntas frequentes", desc: "No meio do texto, e vai para o schema", Icone: MessageCircleQuestion, termos: "faq duvida pergunta resposta" },
      { tipo: "divisor", label: "Divisor", desc: "Separa assuntos", Icone: Minus, termos: "linha separador hr" },
    ],
  },
  {
    nome: "Ferramentas",
    // Gerado do registro. Ferramenta nova aparece aqui sozinha, sem ninguém
    // precisar lembrar de voltar neste arquivo.
    itens: FERRAMENTAS.map((f) => ({
      tipo: `ferramenta:${f.slug}`,
      label: f.nome,
      desc: f.chamada,
      Icone: Wrench,
      termos: f.termos,
    })),
  },
  {
    nome: "Mídia e loja",
    itens: [
      { tipo: "imagem", label: "Imagem", desc: "Vira WebP e exige alt", Icone: ImageIcon, termos: "foto figura png jpg" },
      { tipo: "video", label: "Vídeo do YouTube", desc: "Aumenta tempo na página", Icone: CirclePlay, termos: "youtube filme embed" },
      { tipo: "produto", label: "Produto da loja", desc: "Link para a Tray, com UTM", Icone: ShoppingBag, termos: "alianca loja tray comprar" },
      { tipo: "chamada", label: "Chamada para ação", desc: "Saída medida para loja, unidade ou guia", Icone: MousePointerClick, termos: "cta botao acao proximo passo convite" },
    ],
  },
];

/** Tira acento e caixa, para "/titulo" achar "Título de seção". */
function simplificar(t: string): string {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function filtrarBlocos(termo: string) {
  const t = simplificar(termo.trim());
  if (!t) return GRUPOS_DE_BLOCO;
  return GRUPOS_DE_BLOCO
    .map((g) => ({
      nome: g.nome,
      itens: g.itens.filter((i) => simplificar(`${i.label} ${i.desc} ${i.termos}`).includes(t)),
    }))
    .filter((g) => g.itens.length > 0);
}

/**
 * Onde o bloco novo entra.
 *
 * Regra: se a linha em que o cursor está estiver vazia, o bloco novo toma o
 * lugar dela; se tiver texto, entra logo depois dela. Inserir no meio exato do
 * cursor foi descartado porque partiria a frase ao meio, que não é o que quem
 * escreve quer ao clicar no meio de um parágrafo para colocar uma imagem.
 *
 * Sempre trabalha no nível 1 do documento (o bloco de topo), então estando
 * dentro de uma célula de tabela ou de um item de lista o bloco entra depois da
 * tabela ou da lista inteira, e não encravado nela.
 */
function pontoDeInsercao(editor: EditorTipTap): { from: number; to: number } {
  const sel = editor.state.selection;
  const $de = sel.$from;

  // Seleção de nó no topo (uma imagem clicada, por exemplo): entra depois dele.
  if ($de.depth === 0) return { from: sel.to, to: sel.to };

  const bloco = $de.node(1);
  const inicio = $de.before(1);
  if (bloco.isTextblock && bloco.content.size === 0) {
    return { from: inicio, to: inicio + bloco.nodeSize };
  }
  const fim = $de.after(1);
  return { from: fim, to: fim };
}

/**
 * Garante uma linha de texto no fim do documento.
 *
 * Bloco atômico (imagem, vídeo, produto, divisor) no fim prende o cursor: não
 * existe linha depois dele para continuar escrevendo, e o único jeito de sair
 * seria apagar o bloco que acabou de ser inserido.
 */
function garantirLinhaNoFim(editor: EditorTipTap, moverCursor: boolean) {
  const doc = editor.state.doc;
  if (doc.lastChild?.isTextblock) return;
  const c = editor
    .chain()
    .insertContentAt(doc.content.size, { type: "paragraph" }, { updateSelection: moverCursor });
  if (moverCursor) c.focus();
  c.run();
}

/** Insere no ponto calculado, rola até lá e devolve o foco ao texto. */
function inserirNoPonto(
  editor: EditorTipTap,
  ponto: { from: number; to: number },
  conteudo: Record<string, unknown>,
) {
  const tamanhoAntes = editor.state.doc.content.size;
  editor.chain().focus().insertContentAt(ponto, conteudo).scrollIntoView().run();
  garantirLinhaNoFim(editor, ponto.from >= tamanhoAntes);
}

/** Cria uma linha vazia no ponto e deixa o cursor dentro dela. */
function abrirLinhaNoPonto(editor: EditorTipTap, ponto: { from: number; to: number }) {
  editor.chain().focus().insertContentAt(ponto, { type: "paragraph" }).scrollIntoView().run();
}

function MenuBlocos({
  grupos, ativo, aoEscolher, aoPassar, estilo,
}: {
  grupos: { nome: string; itens: ItemDeBloco[] }[];
  ativo: number;
  aoEscolher: (tipo: string) => void;
  aoPassar: (indice: number) => void;
  estilo: React.CSSProperties;
}) {
  // Índice corrido, para as setas do teclado andarem por cima dos grupos.
  let corrido = -1;
  const numerados = grupos.map((g) => ({
    nome: g.nome,
    itens: g.itens.map((i) => {
      corrido += 1;
      return { ...i, indice: corrido };
    }),
  }));

  return (
    <div
      id="jk-menu-blocos"
      role="listbox"
      aria-label="Blocos para inserir"
      style={estilo}
      className="absolute z-50 max-h-[22rem] w-[21rem] overflow-y-auto rounded-[16px] border border-border bg-[#fbf8f2] p-2 shadow-[var(--jk-sombra-menu)]"
    >
      {numerados.map((g) => (
        <div key={g.nome} className="mb-1 last:mb-0">
          <p className="px-2 py-1.5 text-[0.62rem] font-semibold uppercase tracking-wider text-muted">
            {g.nome}
          </p>
          {g.itens.map(({ tipo, label, desc, Icone, indice }) => (
            <button
              key={tipo}
              type="button"
              role="option"
              aria-selected={indice === ativo}
              data-ativo={indice === ativo ? "sim" : undefined}
              // Sem isto o clique tira o foco do texto antes de inserir, e a
              // posição do cursor (que é onde o bloco vai entrar) se perde.
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => aoPassar(indice)}
              onClick={() => aoEscolher(tipo)}
              className={`flex w-full items-center gap-3 rounded-[10px] px-2.5 py-2 text-left transition-colors ${
                indice === ativo ? "bg-brand/14" : "hover:bg-brand/10"
              }`}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] border border-border bg-white text-brand-nav">
                <Icone size={15} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-ink">{label}</span>
                <span className="block truncate text-xs text-muted">{desc}</span>
              </span>
            </button>
          ))}
        </div>
      ))}
      <p className="border-t border-border/60 px-2.5 pb-1 pt-2 text-[0.65rem] leading-relaxed text-muted">
        Setas para navegar, Enter para escolher, Esc para fechar.
      </p>
    </div>
  );
}

/** Assistente de escrita: pede um trecho para a IA com base no conteúdo. */
function AssistenteEscrita({
  ctx, aoInserir, aoFechar,
}: {
  ctx: { titulo: string; consultaAlvo: string; resposta: string; texto: string; metaDescription: string };
  aoInserir: (texto: string) => void;
  aoFechar: () => void;
}) {
  const [pedido, setPedido] = useState("");
  const [res, setRes] = useState<{ sugestao: string; explicacao: string } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, iniciar] = useTransition();

  const atalhos = [
    "Escreva a seção sobre como medir o aro",
    "Explique a diferença entre prata 925 e 950",
    "Escreva um parágrafo de abertura",
    "Crie uma tabela comparando larguras de 2mm a 5mm",
  ];

  const pedir = (texto: string) => {
    setErro(null);
    setRes(null);
    iniciar(async () => {
      const r = await ajudarAEscrever(texto, ctx);
      if (r.ok) setRes({ sugestao: r.sugestao, explicacao: r.explicacao });
      else setErro(r.erro);
    });
  };

  return (
    <div className="mt-4 rounded-[14px] border border-brand/30 bg-brand/6 p-4">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <Sparkles size={14} className="text-brand-nav" />
          Escrever com IA
        </p>
        <button type="button" onClick={aoFechar} className="text-muted hover:text-ink">
          <X size={15} />
        </button>
      </div>

      <p className="mt-1 text-xs text-muted">
        A IA lê o que você já escreveu e escreve no tom da marca. Você revisa antes de inserir.
      </p>

      <div className="mt-3 flex gap-2">
        <input
          value={pedido}
          onChange={(e) => setPedido(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && pedido.trim()) pedir(pedido); }}
          placeholder="O que você quer escrever?"
          className="flex-1 rounded-[10px] border border-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand"
        />
        <button
          type="button"
          onClick={() => pedido.trim() && pedir(pedido)}
          disabled={carregando || !pedido.trim()}
          className="flex items-center gap-1.5 rounded-[10px] bg-ink px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
        >
          {carregando ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
          Gerar
        </button>
      </div>

      {!res && !carregando ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {atalhos.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => { setPedido(a); pedir(a); }}
              className="rounded-full border border-border bg-white/70 px-3 py-1 text-[0.7rem] text-muted transition-colors hover:border-brand/50 hover:text-brand-nav"
            >
              {a}
            </button>
          ))}
        </div>
      ) : null}

      {erro ? <p className="mt-3 text-xs text-wine">{erro}</p> : null}

      {res ? (
        <div className="mt-3 rounded-[10px] border border-border bg-white p-3">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{res.sugestao}</p>
          <p className="mt-2 text-xs text-muted">{res.explicacao}</p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => { aoInserir(res.sugestao); aoFechar(); }}
              className="flex items-center gap-1.5 rounded-full bg-brand px-4 py-1.5 text-xs font-semibold text-ink hover:bg-brand-light"
            >
              <Check size={12} /> Inserir no texto
            </button>
            <button
              type="button"
              onClick={() => pedir(pedido)}
              className="rounded-full border border-ink/15 px-4 py-1.5 text-xs font-semibold text-ink hover:border-brand/50"
            >
              Gerar outra
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function Editor({
  inicial,
  comparaveis,
  fontesIniciais,
  fatosAprovados,
  clusters,
  capaInicial,
  autores,
  temLinkDeEntrada,
}: {
  inicial: ContentRow;
  comparaveis: PaginaComparavel[];
  fontesIniciais: Fonte[];
  fatosAprovados: Fato[];
  clusters: string[];
  capaInicial: ImagemDaBiblioteca | null;
  autores: OpcaoDeAutor[];
  /** Se alguma página publicada já aponta para esta (regra de página órfã). */
  temLinkDeEntrada: boolean;
}) {
  const [titulo, setTitulo] = useState(inicial.title ?? "");
  const [slug, setSlug] = useState(inicial.slug ?? "");
  const [consultaAlvo, setConsultaAlvo] = useState(inicial.target_query ?? "");
  const [intencao, setIntencao] = useState(inicial.search_intent ?? "");
  const [cluster, setCluster] = useState(inicial.cluster ?? "");
  const [pilarId, setPilarId] = useState(inicial.pillar_id ?? "");
  const [resposta, setResposta] = useState(inicial.answer ?? "");
  const [resumo, setResumo] = useState(inicial.excerpt ?? "");
  const [metaTitle, setMetaTitle] = useState(inicial.meta_title ?? "");
  const [metaDescription, setMetaDescription] = useState(inicial.meta_description ?? "");
  const [autor, setAutor] = useState(inicial.author_name ?? "");
  const [revisor, setRevisor] = useState(inicial.reviewer_name ?? "");
  const [autorId, setAutorId] = useState(inicial.author_id ?? "");
  const [revisorId, setRevisorId] = useState(inicial.reviewer_id ?? "");
  const [faqs, setFaqs] = useState<Faq[]>(inicial.faqs ?? []);
  const [status, setStatus] = useState(inicial.status);

  const [html, setHtml] = useState(inicial.body_html ?? "");
  const [texto, setTexto] = useState("");
  const [menuAberto, setMenuAberto] = useState(false);
  /** Linha em que o cursor está, para o botão "+" acompanhar. */
  const [linha, setLinha] = useState<{ topo: number; naTela: number } | null>(null);
  /** Comando por barra: onde o "/" começa e o que já foi digitado depois dele. */
  const [barra, setBarra] = useState<{ de: number; termo: string } | null>(null);
  const [ativo, setAtivo] = useState(0);
  const corpoRef = useRef<HTMLDivElement>(null);
  /**
   * Ponto de inserção congelado no instante da escolha.
   *
   * Imagem e produto abrem uma janela por cima do editor, e a janela tira o
   * foco do texto. Sem guardar a posição aqui, o bloco caía onde o editor
   * achasse que o cursor estava depois de tudo isso.
   */
  const pontoRef = useRef<{ from: number; to: number } | null>(null);
  /** Posição de uma barra já fechada no Esc, para ela não reabrir sozinha. */
  const dispensadaRef = useRef<number | null>(null);
  /**
   * Quem está esperando o produto escolhido.
   *
   * A mesma janela de busca serve para dois pedidos: inserir uma vitrine nova
   * no texto, ou acrescentar um produto numa vitrine que já existe. Quando o
   * pedido vem de dentro do bloco, ele deixa aqui a função que recebe o
   * resultado, e o editor não insere nada novo.
   */
  const pedidoDaVitrine = useRef<((p: ProdutoDoBloco) => void) | null>(null);
  const [assistente, setAssistente] = useState(false);
  const [seletorProduto, setSeletorProduto] = useState(false);
  const [seletorImagem, setSeletorImagem] = useState(false);
  const [capa, setCapa] = useState<ImagemDaBiblioteca | null>(capaInicial);
  const [seletorCapa, setSeletorCapa] = useState(false);
  const [seletorLink, setSeletorLink] = useState(false);
  const [seletorFonte, setSeletorFonte] = useState(false);
  // Quando ligado, o seletor de link está escolhendo o destino de uma chamada,
  // e não aplicando link ao texto selecionado.
  const [destinoDaChamada, setDestinoDaChamada] = useState<null | { texto: string; botao: string }>(null);
  const [salvando, iniciarSalvar] = useTransition();
  const [salvoEm, setSalvoEm] = useState<string | null>(null);
  const [versao, setVersao] = useState(inicial.updated_at);
  const [sujo, setSujo] = useState(false);
  const [conflito, setConflito] = useState(false);
  const [fontes, setFontes] = useState<Fonte[]>(fontesIniciais);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      // orderedList desligado aqui porque `ListaDePassos` assume o mesmo nó,
      // acrescentando a marca `data-passos` que deixa a página emitir HowTo.
      StarterKit.configure({ heading: { levels: [2, 3] }, orderedList: false }),
      Placeholder.configure({
        placeholder: "Escreva aqui, ou digite / para inserir um bloco.",
      }),
      LinkExt.configure({ openOnClick: false, HTMLAttributes: { rel: "noopener" } }),
      ImagemNode.configure({ HTMLAttributes: { loading: "lazy" } }),
      FiguraNode,
      VideoNode.configure({ width: 720, height: 405, nocookie: true }),
      VitrineNode.configure({
        aoPedirProduto: (aceitar) => {
          pedidoDaVitrine.current = aceitar;
          setSeletorProduto(true);
        },
      }).extend({
        addNodeView() {
          return ReactNodeViewRenderer(VitrineView);
        },
      }),
      ListaDePassos,
      DestaqueNode,
      FaqNode,
      ChamadaNode,
      FonteNode,
      FerramentaNode,
      TabelaNode.configure({ resizable: false }),
      TableRow, CabecalhoDeTabela, TableCell,
    ],
    content: inicial.body_html ?? "",
    editorProps: { attributes: { class: "conteudo-rico min-h-[20rem] focus:outline-none" } },
    onUpdate: ({ editor }) => {
      setHtml(editor.getHTML());
      setTexto(editor.getText());
    },
  });

  useEffect(() => { if (editor) setTexto(editor.getText()); }, [editor]);

  const ctx = { titulo, consultaAlvo, resposta, texto, metaDescription };

  /* ------------------------------------------------------------- blocos */

  const inserir = useCallback((tipo: string) => {
    if (!editor) return;
    const ponto = pontoDeInsercao(editor);
    pontoRef.current = ponto;
    setMenuAberto(false);
    setBarra(null);

    // Ferramenta traz o slug no próprio tipo, então é tratada antes do switch.
    if (tipo.startsWith("ferramenta:")) {
      inserirNoPonto(editor, ponto, {
        type: "ferramenta",
        attrs: { slug: tipo.slice("ferramenta:".length) },
      });
      return;
    }

    switch (tipo) {
      case "paragrafo": abrirLinhaNoPonto(editor, ponto); break;
      case "h2":
      case "h3": {
        const nivel = tipo === "h2" ? 2 : 3;
        const exemplo = nivel === 2 ? "Título da seção" : "Subtítulo";
        inserirNoPonto(editor, ponto, {
          type: "heading",
          attrs: { level: nivel },
          content: [{ type: "text", text: exemplo }],
        });
        // Deixa o texto de exemplo selecionado: quem digita já substitui, em
        // vez de ter que apagar palavra por palavra antes de escrever.
        editor.chain().focus().setTextSelection({
          from: ponto.from + 1,
          to: ponto.from + 1 + exemplo.length,
        }).run();
        break;
      }
      case "lista":
        abrirLinhaNoPonto(editor, ponto);
        editor.chain().focus().toggleBulletList().run();
        break;
      case "listaNum":
        abrirLinhaNoPonto(editor, ponto);
        editor.chain().focus().toggleOrderedList().run();
        break;
      case "citacao":
        abrirLinhaNoPonto(editor, ponto);
        editor.chain().focus().toggleBlockquote().run();
        break;
      case "passos":
        abrirLinhaNoPonto(editor, ponto);
        // Liga a lista e marca a sequência como procedimento. A marca é o que
        // deixa a página emitir HowTo sem redigitar os passos noutro campo.
        editor.chain().focus().toggleOrderedList().updateAttributes("orderedList", { passos: true }).run();
        break;
      case "destaque": {
        const rotulo = window.prompt(
          "Rótulo do destaque, curto. Ex.: Em resumo, Atenção, Da fábrica.\nDeixe vazio para o bloco sair sem rótulo.",
          "Em resumo",
        );
        // Cancelar no prompt (null) desiste; string vazia é escolha de não ter rótulo.
        if (rotulo === null) break;
        inserirNoPonto(editor, ponto, {
          type: "destaque",
          attrs: { rotulo: rotulo.trim() },
          content: [{ type: "paragraph" }],
        });
        // O cursor entra dentro do bloco: quem inseriu quer escrever ali.
        editor.chain().focus().setTextSelection(ponto.from + 2).run();
        break;
      }
      case "faq":
        inserirNoPonto(editor, ponto, {
          type: "faq",
          content: [
            {
              type: "heading",
              attrs: { level: 3 },
              content: [{ type: "text", text: `${MARCA_PENDENTE} a pergunta exata que as pessoas digitam.` }],
            },
            {
              type: "paragraph",
              content: [{ type: "text", text: `${MARCA_PENDENTE} a resposta em 2 ou 3 frases, completa sem depender do resto da página.` }],
            },
          ],
        });
        break;
      case "divisor":
        inserirNoPonto(editor, ponto, { type: "horizontalRule" });
        break;
      case "tabela": {
        // Legenda antes da tabela: é o que diz o que a tabela compara. Sem ela
        // nem o leitor de tela nem a IA sabem o que estão lendo, e a tabela é
        // justamente o formato que a IA extrai melhor.
        const legenda = window.prompt(
          "O que esta tabela compara? Vira a legenda da tabela.",
          "Comparação",
        );
        if (legenda === null) break;
        // insertTable é o único caminho que monta a linha de cabeçalho como
        // <th> de verdade. Inserir a tabela por HTML cru parecia mais direto,
        // mas o parser juntava as três células de cabeçalho numa só.
        //
        // Ele insere onde o cursor está, então a linha vazia vem primeiro para
        // levar o cursor até o ponto certo. A tabela toma o lugar dela.
        abrirLinhaNoPonto(editor, ponto);
        editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
        if (legenda.trim()) {
          editor.chain().focus().updateAttributes("table", { legenda: legenda.trim() }).run();
        }
        garantirLinhaNoFim(editor, false);
        break;
      }
      case "imagem": setSeletorImagem(true); break;
      case "video": {
        const url = window.prompt("Cole o endereço do vídeo no YouTube:");
        if (!url) break;
        // Valida antes de inserir. Antes qualquer texto colado virava iframe,
        // e só se descobria vendo a página quebrada.
        if (!/(youtube\.com|youtu\.be)/i.test(url)) {
          setErro("Este endereço não é do YouTube. Copie o link direto do vídeo.");
          break;
        }
        // Título obrigatório: sem ele o leitor de tela anuncia apenas um quadro
        // sem nome, e é o texto que explica o vídeo para a busca.
        const titulo = window.prompt("Qual o título do vídeo? Aparece para leitores de tela.");
        if (!titulo || !titulo.trim()) {
          setErro("O vídeo não foi inserido porque ficou sem título.");
          break;
        }
        inserirNoPonto(editor, ponto, {
          type: "youtube",
          attrs: { src: url, title: titulo.trim() },
        });
        break;
      }
      case "fonte": setSeletorFonte(true); break;
      case "produto": setSeletorProduto(true); break;
      case "chamada": {
        const texto = window.prompt(
          "O que a chamada diz, em uma frase. Ex.: Experimente as alianças na loja mais perto de você.",
          "",
        );
        if (texto === null) break;
        const botao = window.prompt("Texto do botão, curto e concreto.", "Ver as lojas");
        if (botao === null) break;
        // O destino sai do mesmo seletor do link comum, então a chamada também
        // entra no grafo de links internos em vez de virar URL digitada à mão.
        setDestinoDaChamada({ texto: texto.trim(), botao: botao.trim() || "Ver mais" });
        setSeletorLink(true);
        break;
      }
    }
  }, [editor]);

  /**
   * Ponto guardado, conferido contra o documento de agora.
   *
   * Entre escolher "imagem" e a imagem entrar passam um envio de arquivo e uma
   * conversão para WebP. Se o documento tiver encolhido nesse meio tempo, uma
   * posição velha faria o TipTap recusar a inserção inteira.
   */
  const pontoSalvo = useCallback((): { from: number; to: number } => {
    if (!editor) return { from: 0, to: 0 };
    const tamanho = editor.state.doc.content.size;
    const p = pontoRef.current;
    if (!p) return pontoDeInsercao(editor);
    return { from: Math.min(p.from, tamanho), to: Math.min(p.to, tamanho) };
  }, [editor]);

  /* ---------------------------------------- menu que acompanha o cursor */

  const grupos = useMemo(() => filtrarBlocos(barra?.termo ?? ""), [barra]);
  const menuVisivel = (menuAberto || barra !== null) && grupos.length > 0;

  /** Escolha vinda do menu: apaga a barra digitada antes de inserir o bloco. */
  const escolherDoMenu = useCallback(
    (tipo: string) => {
      if (!editor) return;
      if (barra) {
        editor
          .chain()
          .focus()
          .deleteRange({ from: barra.de, to: editor.state.selection.from })
          .run();
      }
      inserir(tipo);
    },
    [editor, barra, inserir],
  );

  useEffect(() => {
    if (!editor) return;

    const sincronizar = () => {
      const raiz = corpoRef.current;
      if (!raiz) return;
      const sel = editor.state.selection;

      // 1. Onde desenhar o "+": no bloco de topo em que o cursor está.
      try {
        const posicao = sel.$from.depth > 0 ? sel.$from.before(1) : sel.$from.pos;
        const no = editor.view.nodeDOM(posicao);
        const el =
          no instanceof HTMLElement ? no : no instanceof Text ? no.parentElement : null;
        if (!el) {
          setLinha(null);
        } else {
          const r = el.getBoundingClientRect();
          const rr = raiz.getBoundingClientRect();
          const estilo = window.getComputedStyle(el);
          const alturaDaLinha =
            parseFloat(estilo.lineHeight) || parseFloat(estilo.fontSize) * 1.6 || 24;
          // Centraliza na primeira linha do bloco, não no bloco inteiro: num
          // parágrafo de seis linhas o "+" tem que ficar lá em cima.
          const folga = Math.max(0, (Math.min(alturaDaLinha, r.height) - 28) / 2);
          setLinha({ topo: r.top - rr.top + folga, naTela: r.top });
        }
      } catch {
        setLinha(null);
      }

      // 2. Comando por barra.
      if (!sel.empty || !sel.$from.parent.isTextblock) {
        setBarra(null);
        return;
      }
      const antes = sel.$from.parent.textBetween(
        0, sel.$from.parentOffset, undefined, "￼",
      );
      // A barra só vale no começo da linha ou depois de um espaço, senão
      // "https://" abriria o menu no meio de um endereço colado.
      const achado = /(?:^|\s)\/([\p{L}\p{N}]{0,20})$/u.exec(antes);
      if (!achado) {
        dispensadaRef.current = null;
        setBarra(null);
        return;
      }
      const de = sel.$from.start() + achado.index + (achado[0].startsWith("/") ? 0 : 1);
      if (de === dispensadaRef.current) {
        setBarra(null);
        return;
      }
      setBarra({ de, termo: achado[1] });
    };

    sincronizar();
    editor.on("selectionUpdate", sincronizar);
    editor.on("update", sincronizar);
    editor.on("focus", sincronizar);
    window.addEventListener("resize", sincronizar);
    return () => {
      editor.off("selectionUpdate", sincronizar);
      editor.off("update", sincronizar);
      editor.off("focus", sincronizar);
      window.removeEventListener("resize", sincronizar);
    };
  }, [editor]);

  // Filtro novo recomeça a seleção no primeiro item.
  useEffect(() => { setAtivo(0); }, [barra?.termo, menuAberto]);

  // Setas, Enter e Esc com o foco ainda no texto: é isso que faz o "/" valer a
  // pena. O listener vai no DOM do editor, em captura, para chegar antes do
  // ProseMirror mover o cursor.
  useEffect(() => {
    if (!editor || !menuVisivel) return;
    const planos = grupos.flatMap((g) => g.itens);
    if (planos.length === 0) return;

    const teclado = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setAtivo((i) => (i + 1) % planos.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setAtivo((i) => (i - 1 + planos.length) % planos.length);
      } else if (e.key === "Enter" || e.key === "Tab") {
        const item = planos[ativo];
        if (!item) return;
        e.preventDefault();
        escolherDoMenu(item.tipo);
      } else if (e.key === "Escape") {
        e.preventDefault();
        dispensadaRef.current = barra?.de ?? null;
        setMenuAberto(false);
        setBarra(null);
      }
    };

    const alvo = editor.view.dom;
    alvo.addEventListener("keydown", teclado, true);
    return () => alvo.removeEventListener("keydown", teclado, true);
  }, [editor, menuVisivel, grupos, ativo, barra, escolherDoMenu]);

  // Clique fora fecha. Sem overlay por cima da página, para o clique chegar ao
  // texto e já posicionar o cursor onde a pessoa clicou.
  useEffect(() => {
    if (!menuVisivel) return;
    const fora = (e: MouseEvent) => {
      const alvo = e.target as Node;
      if (document.getElementById("jk-menu-blocos")?.contains(alvo)) return;
      if (document.getElementById("jk-botao-inserir")?.contains(alvo)) return;
      setMenuAberto(false);
      setBarra(null);
    };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [menuVisivel]);

  // Mantém o item marcado à vista quando a navegação passa do fim da lista.
  useEffect(() => {
    if (!menuVisivel) return;
    document
      .querySelector('#jk-menu-blocos [data-ativo="sim"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [ativo, menuVisivel]);

  /** O menu abre para baixo, e para cima quando não cabe até o fim da tela. */
  const estiloMenu: React.CSSProperties = linha
    ? linha.naTela + 384 > (typeof window === "undefined" ? 99999 : window.innerHeight)
      ? { left: 6, top: Math.max(6, linha.topo - 366) }
      : { left: 6, top: linha.topo + 34 }
    : { left: 6, top: 6 };

  /**
   * Upload: converte para WebP, registra dimensão e exige alt.
   *
   * Devolve o registro criado para quem chamou decidir o destino (corpo do
   * texto ou capa), em vez de assumir que toda imagem enviada vai para o corpo.
   */
  const subirImagem = async (original: File): Promise<ImagemDaBiblioteca | null> => {
    setErro(null);
    setAviso(null);

    const alt = window.prompt(
      "Descreva a imagem (texto alternativo). É obrigatório para acessibilidade e para SEO.",
    );
    if (!alt || !alt.trim()) {
      setErro("A imagem não foi enviada porque ficou sem texto alternativo.");
      return null;
    }

    const conv = await paraWebp(original);
    const arquivo = conv.arquivo;

    const supabase = createClient();
    const base = arquivo.name
      .replace(/\.[^.]+$/, "").toLowerCase().normalize("NFD")
      .replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "").slice(0, 60);
    const ext = arquivo.name.split(".").pop()?.toLowerCase() ?? "webp";
    const nome = `${base || slug || "imagem"}-${Date.now()}.${ext}`;

    const { error: upErro } = await supabase.storage
      .from("media").upload(nome, arquivo, { cacheControl: "31536000", upsert: false });
    if (upErro) { setErro(`Falha ao enviar: ${upErro.message}`); return null; }

    const { data } = supabase.storage.from("media").getPublicUrl(nome);

    const { data: registro } = await supabase.from("media").insert({
      bucket: "media", storage_path: nome, url: data.publicUrl, alt: alt.trim(),
      mime: arquivo.type, bytes: arquivo.size,
      width: conv.largura || null, height: conv.altura || null,
    }).select("id").maybeSingle();

    if (!registro?.id) {
      setErro("A imagem subiu, mas não foi registrada na biblioteca. Confira em Mídia.");
      return null;
    }

    if (conv.convertida) {
      setAviso(`Imagem convertida para WebP, ${Math.round(conv.reducao * 100)}% menor.`);
    }

    return {
      id: registro.id,
      url: data.publicUrl,
      alt: alt.trim(),
      caption: null,
      credit: null,
      width: conv.largura || null,
      height: conv.altura || null,
    };
  };

  /** Envia e insere no corpo do texto. */
  const enviarImagem = async (original: File) => {
    const img = await subirImagem(original);
    if (!img) return;

    await vincularImagem(inicial.id, img.id);

    // Largura e altura vão para a tag, para o navegador reservar o espaço.
    if (!editor) return;
    inserirNoPonto(editor, pontoSalvo(), {
      type: "image",
      attrs: {
        src: img.url,
        alt: img.alt ?? "",
        width: img.width ?? null,
        height: img.height ?? null,
      },
    });
  };

  /** Insere uma imagem que já está na biblioteca. */
  const usarDaBiblioteca = (img: ImagemDaBiblioteca) => {
    if (!img.alt?.trim()) {
      setErro("Esta imagem está sem texto alternativo. Corrija em Mídia antes de usar no conteúdo.");
      return;
    }
    vincularImagem(inicial.id, img.id);

    // Com legenda ou crédito cadastrados, entra como <figure> com <figcaption>.
    // Esses dois campos eram preenchidos na biblioteca e nunca chegavam à
    // página, e legenda é sinal de contexto tanto para o leitor quanto para a
    // busca por imagem.
    const temLegenda = Boolean(img.caption?.trim() || img.credit?.trim());
    if (!editor) return;
    inserirNoPonto(
      editor,
      pontoSalvo(),
      temLegenda
        ? {
            type: "figura",
            attrs: {
              src: img.url,
              alt: img.alt,
              width: img.width ?? null,
              height: img.height ?? null,
              legenda: img.caption ?? "",
              credito: img.credit ?? "",
            },
          }
        : {
            type: "image",
            attrs: {
              src: img.url,
              alt: img.alt,
              width: img.width ?? null,
              height: img.height ?? null,
            },
          },
    );
    setAviso(
      temLegenda
        ? "Imagem inserida com a legenda cadastrada na biblioteca."
        : "Imagem da biblioteca inserida. Nenhum arquivo novo foi enviado.",
    );
  };

  /**
   * Escolhe a capa do artigo.
   *
   * A capa é a imagem que representa a página inteira (topo do artigo, card de
   * listagem, miniatura em "continue lendo"), então ela exige alt e dimensão.
   * Quem valida é o servidor, porque a trava não pode depender do navegador.
   */
  const escolherCapa = async (img: ImagemDaBiblioteca) => {
    setErro(null);
    setAviso(null);
    const r = await definirCapa(inicial.id, img.id);
    if (!r.ok) {
      setErro(r.erro ?? "Não foi possível definir a capa.");
      return;
    }
    setCapa(img);
    setSeletorCapa(false);
    setAviso("Capa definida. Ela aparece no topo do artigo e nos cards de listagem.");
  };

  const tirarCapa = async () => {
    await removerCapa(inicial.id);
    setCapa(null);
    setAviso("Capa removida. O cabeçalho do artigo continua funcionando sem ela.");
  };

  /**
   * Coloca um texto no ponto do cursor, como parágrafo.
   *
   * Usado pela base de fatos. Vai no cursor, e não no fim do artigo, porque o
   * fato só faz sentido onde a frase está sendo escrita.
   */
  const inserirTexto = useCallback(
    (texto: string) => {
      if (!editor) return;
      const ponto = pontoDeInsercao(editor);
      inserirNoPonto(editor, ponto, {
        type: "paragraph",
        content: [{ type: "text", text: texto }],
      });
    },
    [editor],
  );

  /** Aplica uma sugestão da IA no campo certo. */
  const aplicar = useCallback((id: string, texto: string) => {
    switch (id) {
      case "titulo": setTitulo(texto); break;
      case "meta": setMetaDescription(texto); break;
      case "resposta": setResposta(texto); break;
      case "slug": setSlug(texto.toLowerCase().replace(/\s+/g, "-")); break;
      case "alvo": setConsultaAlvo(texto); break;
      default:
        editor?.chain().focus("end").insertContent(
          texto.split("\n").filter(Boolean).map((p) => `<p>${p}</p>`).join(""),
        ).run();
    }
    setAviso("Sugestão aplicada. Revise antes de salvar.");
  }, [editor]);

  /* ------------------------------------------------------------- salvar */

  const salvar = useCallback(
    (aoTerminar?: () => void, opcoes?: { automatico?: boolean; forcar?: boolean }) => {
      if (!opcoes?.automatico) setErro(null);
      iniciarSalvar(async () => {
        const r = await salvarConteudo({
          id: inicial.id, versao, automatico: opcoes?.automatico, forcar: opcoes?.forcar,
          title: titulo, slug, targetQuery: consultaAlvo,
          searchIntent: intencao, cluster, pilarId, excerpt: resumo, answer: resposta, bodyHtml: html,
          metaTitle, metaDescription, authorName: autor, reviewerName: revisor,
          authorId: autorId, reviewerId: revisorId, faqs,
        });
        if (r.ok) {
          setSalvoEm(r.salvoEm ?? null);
          setSujo(false);
          setConflito(false);
          if (r.versao) setVersao(r.versao);
          if (r.slug && r.slug !== slug) setSlug(r.slug);
          aoTerminar?.();
        } else if (r.conflito) {
          setConflito(true);
        } else setErro(r.erro ?? "Não foi possível salvar.");
      });
    },
    [inicial.id, versao, titulo, slug, consultaAlvo, intencao, cluster, pilarId, resumo, resposta, html, metaTitle, metaDescription, autor, revisor, faqs],
  );

  /** Publica de verdade. Se o servidor recusar, o estado não pode mentir. */
  const publicar = useCallback(() => {
    publicarConteudo(inicial.id).then((r) => {
      if (r.ok) { setStatus("published"); setAviso("Publicado. A página já está no ar."); }
      else setErro(r.erro ?? "Não foi possível publicar.");
    });
  }, [inicial.id]);

  /* ------------------------------------------------- salvamento automático */

  // Qualquer alteração marca o conteúdo como sujo. O primeiro render não conta,
  // senão o editor já abriria pedindo para salvar sem ninguém ter digitado.
  const primeiroRender = useRef(true);
  useEffect(() => {
    if (primeiroRender.current) { primeiroRender.current = false; return; }
    setSujo(true);
  }, [titulo, slug, consultaAlvo, intencao, cluster, pilarId, resumo, resposta, html, metaTitle, metaDescription, autor, revisor, faqs]);

  // Salva sozinho depois de cinco segundos parado. Cinco porque salvar a cada
  // tecla gera requisição demais, e esperar mais que isso já é tempo suficiente
  // para perder trabalho se a aba fechar.
  const salvarRef = useRef(salvar);
  salvarRef.current = salvar;
  useEffect(() => {
    if (!sujo || conflito || salvando) return;
    const t = setTimeout(() => salvarRef.current(undefined, { automatico: true }), 5000);
    return () => clearTimeout(t);
  }, [sujo, conflito, salvando, titulo, slug, consultaAlvo, intencao, cluster, pilarId, resumo, resposta, html, metaTitle, metaDescription, autor, revisor, faqs]);

  // Rede de segurança: fechar a aba com alteração pendente pede confirmação.
  useEffect(() => {
    if (!sujo) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [sujo]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); salvar(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [salvar]);

  // Roda no navegador a cada tecla: é comparação de texto, custa nada, e o
  // alerta precisa aparecer no momento em que a consulta alvo é escolhida.
  const choques = useMemo(
    () => acharChoques({ titulo, consultaAlvo }, comparaveis),
    [titulo, consultaAlvo, comparaveis],
  );

  // Sem corte por caractere aqui: quem corta é o preview, por largura em pixel,
  // que é como o Google decide.
  const tituloBusca = metaTitle || titulo || "Sem título";

  /**
   * A capa serve ao Discover, não só ao artigo.
   *
   * A documentação do Discover pede imagem com pelo menos 1200px de largura e
   * proporção próxima de 16:9. Capa fora disso continua funcionando na página,
   * mas tira o conteúdo de uma fonte de tráfego inteira, e não havia nada no
   * admin dizendo isso na hora de escolher.
   */
  const avisoDaCapa = (() => {
    if (!capa?.width || !capa?.height) return null;
    const proporcao = capa.width / capa.height;
    const problemas: string[] = [];
    if (capa.width < 1200) {
      problemas.push(`tem ${capa.width}px de largura (o Discover pede 1200px)`);
    }
    if (proporcao < 1.5 || proporcao > 2.0) {
      const formatada = proporcao.toFixed(2).replace(".", ",");
      problemas.push(`está em ${formatada}:1 (o formato do Discover é próximo de 1,78:1)`);
    }
    if (!problemas.length) return null;
    return `Esta capa ${problemas.join(" e ")}. A página continua certa, mas fica fora do Google Discover.`;
  })();
  const btBarra = "flex h-8 w-8 items-center justify-center rounded-[8px] text-ink/70 transition-colors hover:bg-brand/12 hover:text-brand-nav";

  return (
    <div data-painel-largo className="grid gap-8 lg:grid-cols-[1fr_23rem]">
      <div className="min-w-0">
        {/* Barra de ações */}
        <div className="glass sticky top-20 z-30 mb-6 flex flex-wrap items-center justify-between gap-3 rounded-[16px] px-4 py-3">
          <div className="flex items-center gap-3 text-xs">
            <Link href="/admin/conteudos" className="text-muted hover:text-brand-nav">← Conteúdos</Link>
            <span className={`rounded-full px-2.5 py-1 font-semibold ${status === "published" ? "bg-brand/15 text-brand-strong" : "bg-ink/10 text-ink/70"}`}>
              {status === "published" ? "Publicado" : status === "archived" ? "Arquivado" : status === "in_review" ? "Em revisão" : "Rascunho"}
            </span>
            {salvando ? (
              <span className="flex items-center gap-1.5 text-muted"><Loader2 size={12} className="animate-spin" /> Salvando</span>
            ) : sujo ? (
              <span className="flex items-center gap-1.5 text-muted">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-brand" /> Alteração não salva
              </span>
            ) : salvoEm ? (
              <span className="flex items-center gap-1.5 text-muted"><Check size={12} /> Salvo às {salvoEm}</span>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            {status === "published" ? (
              <>
                <Link href={`/guia/${slug}`} target="_blank" className="rounded-full border border-ink/15 px-4 py-2 text-xs font-semibold text-ink hover:border-brand/50 hover:text-brand-nav">Ver no site ↗</Link>
                <button type="button" onClick={() => salvar(() => voltarParaRascunho(inicial.id).then(() => setStatus("draft")))} className="rounded-full border border-ink/15 px-4 py-2 text-xs font-semibold text-ink hover:border-wine/50 hover:text-wine">Despublicar</button>
              </>
            ) : null}
            <button
              type="button"
              onClick={() => salvar(() => linkDePreview(inicial.id).then((l) => window.open(l, "_blank", "noopener")))}
              disabled={salvando}
              title="Salva e abre a página como ela vai ao ar"
              className="rounded-full border border-ink/15 px-4 py-2 text-xs font-semibold text-ink transition-colors hover:border-brand/50 hover:text-brand-nav disabled:opacity-60"
            >
              Ver preview
            </button>
            <button type="button" onClick={() => salvar()} disabled={salvando} className="rounded-full border border-ink/20 px-5 py-2 text-xs font-semibold text-ink transition-colors hover:border-brand hover:text-brand-nav disabled:opacity-60">Salvar rascunho</button>
            <button type="button" onClick={() => salvar(publicar)} disabled={salvando} className="rounded-full bg-brand px-5 py-2 text-xs font-semibold text-ink transition-colors hover:bg-brand-light disabled:opacity-60">
              {status === "published" ? "Atualizar no ar" : "Publicar"}
            </button>
          </div>
        </div>

        {conflito ? (
          <div role="alert" className="mb-5 rounded-[12px] border border-wine/30 bg-wine/5 px-4 py-3 text-sm text-wine">
            <p className="font-semibold">Esta página foi salva em outro lugar depois que você abriu o editor.</p>
            <p className="mt-1 text-wine/85">
              Pode ser outra aba sua. Se salvar agora, o que está aqui substitui o que foi gravado lá.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => window.location.reload()} className="rounded-full bg-wine px-4 py-1.5 text-xs font-semibold text-white">
                Recarregar e perder o que digitei aqui
              </button>
              <button type="button" onClick={() => salvar(undefined, { forcar: true })} className="rounded-full border border-wine/40 px-4 py-1.5 text-xs font-semibold text-wine">
                Salvar por cima mesmo assim
              </button>
            </div>
          </div>
        ) : null}

        {erro ? <p role="alert" className="mb-5 rounded-[12px] border border-wine/25 bg-wine/5 px-4 py-3 text-sm text-wine">{erro}</p> : null}
        {aviso ? <p className="mb-5 rounded-[12px] border border-brand/30 bg-brand/8 px-4 py-3 text-sm text-brand-strong">{aviso}</p> : null}

        {/* Título */}
        <div className="glass rounded-[20px] p-6 sm:p-7">
          <Secao Icone={Pencil} titulo="Título da página" ajuda="É o H1 e o que aparece maior na busca. Até 60 caracteres." />
          <div className="group relative">
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Clique aqui e escreva o título"
              className="font-display w-full rounded-[12px] border border-transparent bg-white/50 px-4 py-3 text-3xl text-ink outline-none transition-colors placeholder:text-muted/40 hover:border-brand/30 focus:border-brand focus:bg-white/80"
            />
            <Pencil size={15} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted/40 transition-colors group-focus-within:text-brand" />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted">
            <span className="flex items-center gap-1.5"><Link2 size={12} /> guia.jkaliancas.com.br/guia/</span>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="endereco-da-pagina"
              className="min-w-40 flex-1 rounded-full border border-border bg-white/70 px-3 py-1.5 text-ink outline-none hover:border-brand/40 focus:border-brand"
            />
          </div>
        </div>

        {/* Resposta rápida */}
        <div className="glass mt-5 rounded-[20px] p-6 sm:p-7">
          <Secao Icone={Zap} titulo="Resposta rápida" ajuda="O bloco que a IA cita e que aparece no topo da página. Responda a dúvida em 2 a 4 frases." />
          <textarea
            value={resposta}
            onChange={(e) => setResposta(e.target.value)}
            rows={3}
            placeholder="Ex.: Para escolher a aliança de namoro, defina primeiro o material, depois a largura, e meça o aro no fim do dia."
            className={`${campo} resize-y`}
          />
        </div>

        {/* Capa */}
        <div className="glass mt-5 rounded-[20px] p-6 sm:p-7">
          <Secao
            Icone={ImageIcon}
            titulo="Capa"
            ajuda="A imagem que abre o artigo e representa ele nos cards e no compartilhamento. Opcional: sem capa, o cabeçalho continua funcionando."
            acao={
              capa ? (
                <button
                  type="button"
                  onClick={tirarCapa}
                  className="shrink-0 rounded-full border border-border px-3.5 py-2 text-xs font-semibold text-muted transition-colors hover:border-wine/40 hover:text-wine"
                >
                  Remover
                </button>
              ) : undefined
            }
          />

          {capa ? (
            <div className="flex flex-col gap-4 sm:flex-row">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={capa.url}
                alt={capa.alt ?? ""}
                className="h-32 w-full rounded-[12px] object-cover sm:w-56"
              />
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-medium text-ink">{capa.alt}</p>
                {capa.credit ? (
                  <p className="mt-1 text-xs text-muted">Crédito: {capa.credit}</p>
                ) : null}
                {capa.width && capa.height ? (
                  <p className="mt-1 text-xs text-muted">
                    {capa.width} por {capa.height} pixels
                  </p>
                ) : null}
                {avisoDaCapa ? (
                  <p className="mt-2 rounded-[10px] border border-brand/40 bg-brand/10 px-3 py-2 text-xs text-ink">
                    {avisoDaCapa}
                  </p>
                ) : null}
                <button
                  type="button"
                  onClick={() => setSeletorCapa(true)}
                  className="mt-3 rounded-full border border-brand/40 bg-brand/8 px-3.5 py-2 text-xs font-semibold text-brand-nav transition-colors hover:bg-brand/16"
                >
                  Trocar capa
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setSeletorCapa(true)}
              className="flex w-full items-center justify-center gap-2 rounded-[12px] border border-dashed border-brand/40 bg-brand/5 px-4 py-8 text-sm font-semibold text-brand-nav transition-colors hover:border-brand hover:bg-brand/12"
            >
              <ImageIcon size={16} /> Escolher capa da biblioteca
            </button>
          )}

          {seletorCapa ? (
            <SeletorImagem
              aoEscolher={escolherCapa}
              aoEnviar={async (arquivo) => {
                const img = await subirImagem(arquivo);
                if (img) await escolherCapa(img);
              }}
              aoFechar={() => setSeletorCapa(false)}
            />
          ) : null}
        </div>

        {/* Corpo */}
        <div className={`glass relative mt-5 rounded-[20px] p-6 sm:p-7 ${menuVisivel ? "z-50" : ""}`}>
          <Secao
            Icone={FileText}
            titulo="Conteúdo"
            ajuda="Use títulos de seção para quebrar o texto. Tabelas e listas são bem extraídas por IA."
            acao={
              <button
                type="button"
                onClick={() => setAssistente((v) => !v)}
                className="flex shrink-0 items-center gap-1.5 rounded-full border border-brand/40 bg-brand/8 px-3.5 py-2 text-xs font-semibold text-brand-nav transition-colors hover:bg-brand/16"
              >
                <Sparkles size={13} /> Escrever com IA
              </button>
            }
          />

          <div className="mb-3 flex flex-wrap items-center gap-1 rounded-[10px] border border-border/70 bg-white/50 px-2 py-1.5">
            <button type="button" onClick={() => editor?.chain().focus().toggleBold().run()} className={btBarra} title="Negrito"><Bold size={15} /></button>
            <button type="button" onClick={() => editor?.chain().focus().toggleItalic().run()} className={btBarra} title="Itálico"><Italic size={15} /></button>
            <button
              type="button"
              onClick={() => {
                setSeletorLink(true);
              }}
              className={btBarra} title="Link"
            ><Link2 size={15} /></button>
            <span className="mx-1 h-5 w-px bg-border" />
            <button type="button" onClick={() => editor?.chain().focus().undo().run()} className={btBarra} title="Desfazer"><Undo2 size={15} /></button>
            <button type="button" onClick={() => editor?.chain().focus().redo().run()} className={btBarra} title="Refazer"><Redo2 size={15} /></button>
          </div>

          <div
            ref={corpoRef}
            className="relative rounded-[12px] border border-border/60 bg-white/50 py-3 pl-10 pr-4 transition-colors focus-within:border-brand/50 sm:pl-12"
          >
            {linha ? (
              <button
                id="jk-botao-inserir"
                type="button"
                // preventDefault mantém o cursor onde está. É a posição do
                // cursor que decide em qual linha o bloco vai entrar, então
                // perder o foco aqui seria perder o ponto de inserção.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { setBarra(null); setMenuAberto((v) => !v); }}
                style={{ top: linha.topo }}
                aria-expanded={menuVisivel}
                aria-haspopup="listbox"
                title="Inserir bloco nesta linha"
                aria-label="Inserir bloco nesta linha"
                className="absolute left-1.5 z-10 flex h-7 w-7 sm:left-2.5 items-center justify-center rounded-full border border-brand/40 bg-white text-brand-nav transition-colors hover:border-brand hover:bg-brand/16"
              >
                <Plus size={15} />
              </button>
            ) : null}

            <EditorContent editor={editor} />

            {menuVisivel ? (
              <MenuBlocos
                grupos={grupos}
                ativo={ativo}
                aoEscolher={escolherDoMenu}
                aoPassar={setAtivo}
                estilo={estiloMenu}
              />
            ) : null}
          </div>

          <p className="mt-2.5 text-xs leading-relaxed text-muted">
            O <strong className="font-semibold text-ink">+</strong> acompanha a linha em que você
            está, e o bloco entra ali. Digite{" "}
            <strong className="font-semibold text-ink">/</strong> no texto para abrir a mesma lista
            sem tirar a mão do teclado.
          </p>

          {assistente ? (
            <AssistenteEscrita
              ctx={ctx}
              aoFechar={() => setAssistente(false)}
              aoInserir={(t) => {
                // A IA devolve HTML simples (parágrafo, lista, tabela). Antes
                // tudo era quebrado por linha e embrulhado em <p>, então o
                // atalho "crie uma tabela comparando larguras" entregava uma
                // tabela desmontada em parágrafos soltos.
                const pareceHtml = /<(p|h3|ul|ol|table|li)\b/i.test(t);
                if (!editor) return;
                const corpo = pareceHtml
                  ? t
                  : t.split("\n").filter(Boolean).map((p) => `<p>${p}</p>`).join("");
                // Entra onde o cursor parou, não no fim do artigo: quem pede um
                // trecho à IA quase sempre quer ele na seção que está escrevendo.
                const onde = pontoDeInsercao(editor);
                editor.chain().focus().insertContentAt(onde, corpo).scrollIntoView().run();
                garantirLinhaNoFim(editor, false);
              }}
            />
          ) : null}

          {seletorLink ? (
            <SeletorLink
              contentId={inicial.id}
              textoSelecionado={
                editor
                  ? editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, " ")
                  : ""
              }
              aoEscolher={(href, rel) => {
                if (destinoDaChamada) {
                  const externo = /^https?:\/\//i.test(href);
                  if (editor) {
                    inserirNoPonto(editor, pontoSalvo(), {
                      type: "chamada",
                      attrs: {
                        ...destinoDaChamada,
                        href,
                        externo,
                        // O relatório precisa distinguir a saída: loja oficial,
                        // unidade física ou outro guia.
                        evento: externo ? "clique_produto" : href.startsWith("/lojas") ? "clique_loja" : "clique_guia",
                      },
                    });
                  }
                  setDestinoDaChamada(null);
                  return;
                }
                editor?.chain().focus().extendMarkRange("link")
                  .setLink(rel ? { href, rel } : { href }).run();
              }}
              aoFechar={() => { setSeletorLink(false); setDestinoDaChamada(null); }}
            />
          ) : null}

          {seletorFonte ? (
            <SeletorDeFonte
              fontes={fontes}
              aoFechar={() => setSeletorFonte(false)}
              aoEscolher={(f) => {
                setSeletorFonte(false);
                if (!editor) return;
                const ponto = pontoSalvo();
                inserirNoPonto(editor, ponto, {
                  type: "fonte",
                  attrs: {
                    fonteId: f.id,
                    // O nome curto de quem afirma sai do domínio da fonte. Sem
                    // link é registro interno, e o bloco diz isso em vez de
                    // fingir que existe um endereço para conferir.
                    origem: f.source_url ? new URL(f.source_url).hostname.replace(/^www\./, "") : "",
                    url: f.source_url ?? "",
                    conferidoEm: f.captured_at ?? "",
                  },
                  content: [{ type: "paragraph" }],
                });
                // Cursor dentro do bloco: quem inseriu quer escrever a frase.
                editor.chain().focus().setTextSelection(ponto.from + 2).run();
              }}
            />
          ) : null}

          {seletorImagem ? (

            <SeletorImagem

              aoEscolher={usarDaBiblioteca}

              aoEnviar={enviarImagem}

              aoFechar={() => setSeletorImagem(false)}

            />

          ) : null}


          {seletorProduto ? (
            <SeletorProduto
              contentId={inicial.id}
              aoFechar={() => {
                // Fechar sem escolher precisa limpar o pedido, senão o próximo
                // produto inserido no texto iria parar na vitrine antiga.
                pedidoDaVitrine.current = null;
                setSeletorProduto(false);
              }}
              aoEscolher={(p, url) => {
                // Preço promocional vence quando existe e é menor.
                const temPromo =
                  p.precoPromocional !== null && p.preco !== null && p.precoPromocional < p.preco;
                const novo: ProdutoDoBloco = {
                  id: p.id,
                  nome: p.nome,
                  url,
                  imagem: p.imagem,
                  preco: temPromo
                    ? String(p.precoPromocional)
                    : p.preco !== null
                      ? String(p.preco)
                      : null,
                  precoAntigo: temPromo ? String(p.preco) : null,
                  disponivel: p.disponivel,
                  prazo: p.prazo,
                };

                const aceitar = pedidoDaVitrine.current;
                pedidoDaVitrine.current = null;
                if (aceitar) {
                  aceitar(novo);
                  return;
                }

                if (!editor) return;
                inserirNoPonto(editor, pontoSalvo(), {
                  type: "vitrine",
                  attrs: { formato: "vertical", produtos: [novo] },
                });
              }}
            />
          ) : null}
        </div>

        {/* FAQ */}
        <div className="glass mt-5 rounded-[20px] p-6 sm:p-7">
          <Secao
            Icone={MessageCircleQuestion}
            titulo="Perguntas frequentes"
            ajuda="Vira schema FAQPage e é muito citada por IA. Duas ou três já ajudam."
            acao={
              <button
                type="button"
                onClick={() => setFaqs((f) => [...f, { question: "", answer: "" }])}
                className="flex shrink-0 items-center gap-1.5 rounded-full border border-brand/40 px-3.5 py-2 text-xs font-semibold text-brand-nav hover:bg-brand/10"
              >
                <Plus size={13} /> Adicionar
              </button>
            }
          />
          <div className="space-y-4">
            {faqs.map((f, i) => (
              <div key={i} className="rounded-[14px] border border-border/70 bg-white/60 p-4">
                <input
                  value={f.question}
                  onChange={(e) => setFaqs((a) => a.map((x, j) => (j === i ? { ...x, question: e.target.value } : x)))}
                  placeholder="Pergunta que o cliente faz"
                  className="w-full bg-transparent font-medium text-ink outline-none placeholder:text-muted/50"
                />
                <textarea
                  value={f.answer}
                  onChange={(e) => setFaqs((a) => a.map((x, j) => (j === i ? { ...x, answer: e.target.value } : x)))}
                  rows={2}
                  placeholder="Resposta objetiva"
                  className="mt-2 w-full resize-y bg-transparent text-sm text-muted outline-none placeholder:text-muted/50"
                />
                <button type="button" onClick={() => setFaqs((a) => a.filter((_, j) => j !== i))} className="mt-2 text-xs text-wine hover:underline">Remover</button>
              </div>
            ))}
            {faqs.length === 0 ? <p className="text-sm text-muted">Nenhuma pergunta ainda.</p> : null}
          </div>
        </div>

        {/* Busca */}
        <div className="glass mt-5 rounded-[20px] p-6 sm:p-7">
          <Secao Icone={Search} titulo="Como aparece na busca" ajuda="Isto é o que a pessoa vê no Google e no card de compartilhamento antes de clicar." />

          <PreviewDeResultado
            titulo={tituloBusca}
            descricao={metaDescription}
            slug={slug}
            atualizadoEm={inicial.updated_at}
            capaUrl={capa?.url ?? null}
          />

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold text-ink">Consulta principal</span>
              <input value={consultaAlvo} onChange={(e) => setConsultaAlvo(e.target.value)} placeholder="aliança de namoro" className={`${campo} mt-1.5`} />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-ink">Intenção de busca</span>
              <input value={intencao} onChange={(e) => setIntencao(e.target.value)} placeholder="informacional" className={`${campo} mt-1.5`} />
            </label>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold text-ink">Assunto (cluster)</span>
              <input
                value={cluster}
                onChange={(e) => setCluster(e.target.value)}
                list="clusters-existentes"
                placeholder="aliança de namoro"
                className={`${campo} mt-1.5`}
              />
              <datalist id="clusters-existentes">
                {clusters.map((c) => <option key={c} value={c} />)}
              </datalist>
              <span className="mt-1 block text-xs text-muted">
                Reaproveite o nome exato de um assunto já usado. É o que junta as páginas num
                conjunto só aos olhos do Google.
              </span>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-ink">Post pilar deste assunto</span>
              <select
                value={pilarId}
                onChange={(e) => setPilarId(e.target.value)}
                className={`${campo} mt-1.5`}
              >
                <option value="">Esta página é o pilar</option>
                {comparaveis.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}{c.status === "published" ? "" : " (rascunho)"}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs text-muted">
                A página central do assunto, que recebe o link de todas as outras.
              </span>
            </label>
          </div>

          {choques.length > 0 ? (
            <div className="mt-4 rounded-[12px] border border-wine/25 bg-wine/5 p-4">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-wine">
                <AlertTriangle size={13} /> Outra página já disputa esta busca
              </p>
              <ul className="mt-2.5 space-y-2">
                {choques.map((c) => (
                  <li key={c.id} className="text-xs leading-relaxed">
                    <Link href={`/admin/conteudos/${c.id}`} className="font-semibold text-ink hover:text-brand-nav">
                      {c.title}
                    </Link>
                    <span className="ml-1.5 rounded-full bg-ink/8 px-1.5 py-0.5 text-[0.62rem] text-muted">
                      {c.status === "published" ? "no ar" : "rascunho"}
                    </span>
                    <span className="block text-muted">{c.explicacao}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <label className="mt-4 block">
            <span className="text-xs font-semibold text-ink">Título na busca</span>
            <input value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} placeholder="Deixe vazio para usar o título da página" className={`${campo} mt-1.5`} />
            <span className="mt-1 block text-xs text-muted">{(metaTitle || titulo).length} de 60</span>
          </label>

          <label className="mt-4 block">
            <span className="text-xs font-semibold text-ink">Meta description</span>
            <textarea value={metaDescription} onChange={(e) => setMetaDescription(e.target.value)} rows={2} className={`${campo} mt-1.5 resize-y`} />
            <span className="mt-1 block text-xs text-muted">{metaDescription.length} caracteres, ideal entre 140 e 160</span>
          </label>

          <label className="mt-4 block">
            <span className="text-xs font-semibold text-ink">Resumo na lista de posts</span>
            <textarea value={resumo} onChange={(e) => setResumo(e.target.value)} rows={2} className={`${campo} mt-1.5 resize-y`} />
          </label>

          {/* Autoria.

              Pessoa cadastrada tem prioridade: a assinatura vira link para
              /autor/[slug] e o JSON-LD ganha author.url, que é o que o Google
              procura para saber quem escreveu. O texto livre continua ali como
              sobra, para colaborador eventual que não vale cadastrar. */}
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block">
                <span className="text-xs font-semibold text-ink">Autor</span>
                <select
                  value={autorId}
                  onChange={(e) => setAutorId(e.target.value)}
                  className={`${campo} mt-1.5`}
                >
                  <option value="">Escrever o nome à mão</option>
                  {autores.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </label>
              {!autorId ? (
                <input
                  value={autor}
                  onChange={(e) => setAutor(e.target.value)}
                  placeholder="Nome de quem assina"
                  className={`${campo} mt-2`}
                />
              ) : null}
            </div>

            <div>
              <label className="block">
                <span className="text-xs font-semibold text-ink">Revisor</span>
                <select
                  value={revisorId}
                  onChange={(e) => setRevisorId(e.target.value)}
                  className={`${campo} mt-1.5`}
                >
                  <option value="">Escrever o nome à mão</option>
                  {autores.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </label>
              {!revisorId ? (
                <input
                  value={revisor}
                  onChange={(e) => setRevisor(e.target.value)}
                  placeholder="Nome de quem revisou"
                  className={`${campo} mt-2`}
                />
              ) : null}
            </div>
          </div>
          {autores.length === 0 ? (
            <p className="mt-2 text-xs text-muted">
              Nenhuma pessoa cadastrada ainda. Cadastre em Autores para a
              assinatura virar link e ganhar página própria.
            </p>
          ) : null}
        </div>

        {/* Fontes */}
        <div className="glass mt-5 rounded-[20px] p-6 sm:p-7">
          <Secao
            Icone={ShieldCheck}
            titulo="Fontes"
            ajuda="De onde veio cada afirmação factual do texto. Sem pelo menos uma, a publicação não passa."
            acao={
              <span className={`rounded-full px-2.5 py-1 text-[0.68rem] font-semibold ${fontes.length > 0 ? "bg-brand/15 text-brand-strong" : "bg-wine/10 text-wine"}`}>
                {fontes.length > 0 ? `${fontes.length} registrada${fontes.length > 1 ? "s" : ""}` : "nenhuma"}
              </span>
            }
          />
          <PainelFatos
            contentId={inicial.id}
            fatos={fatosAprovados}
            aoInserirTexto={inserirTexto}
            aoRegistrarFonte={(f) => setFontes((antes) => [...antes, f])}
          />
          <Fontes contentId={inicial.id} fontes={fontes} aoMudar={setFontes} />
        </div>

        {/* Agendamento */}
        <div className="glass mt-5 rounded-[20px] p-6 sm:p-7">
          <Secao
            Icone={CalendarClock}
            titulo="Publicar em outra hora"
            ajuda="Escreva agora e deixe entrar no ar no dia certo. Sempre no horário de São Paulo."
          />
          <Agendamento
            contentId={inicial.id}
            publicado={inicial.status === "published"}
            agendadoPara={inicial.scheduled_at}
            erroDoAgendamento={inicial.scheduled_error}
          />
        </div>

        {/* Histórico. Fica no fim porque é rede de segurança, não etapa do
            trabalho: quem precisa dele sabe que está aqui. */}
        <div className="glass mt-5 rounded-[20px] p-6 sm:p-7">
          <Historico contentId={inicial.id} />
        </div>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-20 lg:h-fit">
        <BotaoPrompt
          publicados={comparaveis.map((c) => c.title)}
          consultaAlvo={consultaAlvo}
        />

        <PainelAnalise
          contentId={inicial.id}
          intencao={intencao}
          aoAplicar={aplicar}
          entrada={{
            titulo, slug, metaTitle, metaDescription, resposta, texto, html, consultaAlvo,
            // O bloco de FAQ escreve no corpo. Sem somar aqui, o analisador
            // diria "menos de 2 perguntas" num texto cheio delas.
            faqs: faqsUnidas(faqsDoHtml(html), faqs),
            // A pessoa cadastrada conta como autoria preenchida: o nome vem dela,
            // não do campo de texto livre.
            autor: autorId ? "cadastrado" : autor,
            revisor: revisorId ? "cadastrado" : revisor,
            outrasPaginas: comparaveis.map((c) => ({
              titulo: c.metaTitle?.trim() || c.title,
              metaDescription: c.metaDescription ?? "",
            })),
            temLinkDeEntrada,
          }}
        />
      </aside>
    </div>
  );
}
