"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import LinkExt from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import { TabelaNode, CabecalhoDeTabela } from "@/lib/editor/TabelaNode";
import { VideoNode } from "@/lib/editor/VideoNode";
import { ProdutoNode } from "@/lib/editor/ProdutoNode";
import { ImagemNode } from "@/lib/editor/ImagemNode";
import { FiguraNode } from "@/lib/editor/FiguraNode";
import { PreviewDeResultado } from "./PreviewDeResultado";
import {
  Plus, Type, Heading2, Heading3, ImageIcon, List, ListOrdered, Quote, Minus,
  Table as TableIcon, Bold, Italic, Link2, Undo2, Redo2, Pencil, Sparkles,
  CirclePlay, ShoppingBag, MessageCircleQuestion, Search, FileText,
  Zap, Check, X, Loader2, AlertTriangle, ShieldCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { paraWebp } from "@/lib/midia/webp";
import { PainelAnalise } from "./PainelAnalise";
import { SeletorProduto } from "./SeletorProduto";
import { SeletorImagem } from "./SeletorImagem";
import { SeletorLink } from "./SeletorLink";
import { Fontes } from "./Fontes";
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

function MenuBlocos({
  aoEscolher, aoFechar,
}: {
  aoEscolher: (tipo: string) => void;
  aoFechar: () => void;
}) {
  const grupos = [
    {
      nome: "Texto",
      itens: [
        { tipo: "paragrafo", label: "Parágrafo", desc: "Texto comum", Icone: Type },
        { tipo: "h2", label: "Título de seção", desc: "H2, divide o conteúdo", Icone: Heading2 },
        { tipo: "h3", label: "Subtítulo", desc: "H3, dentro da seção", Icone: Heading3 },
        { tipo: "citacao", label: "Citação", desc: "Destaque de fala", Icone: Quote },
      ],
    },
    {
      nome: "Estrutura",
      itens: [
        { tipo: "lista", label: "Lista", desc: "Com marcadores", Icone: List },
        { tipo: "listaNum", label: "Lista numerada", desc: "Passo a passo", Icone: ListOrdered },
        { tipo: "tabela", label: "Tabela", desc: "Comparação, a IA extrai muito bem", Icone: TableIcon },
        { tipo: "divisor", label: "Divisor", desc: "Separa assuntos", Icone: Minus },
      ],
    },
    {
      nome: "Mídia e loja",
      itens: [
        { tipo: "imagem", label: "Imagem", desc: "Vira WebP e exige alt", Icone: ImageIcon },
        { tipo: "video", label: "Vídeo do YouTube", desc: "Aumenta tempo na página", Icone: CirclePlay },
        { tipo: "produto", label: "Produto da loja", desc: "Link para a Tray, com UTM", Icone: ShoppingBag },
      ],
    },
  ];

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={aoFechar} aria-hidden />
      <div className="absolute left-0 top-full z-50 mt-2 max-h-[26rem] w-[22rem] overflow-y-auto rounded-[16px] border border-border bg-[#fbf8f2] p-2 shadow-[0_28px_60px_-20px_rgb(75_53_23/0.35)]">
        {grupos.map((g) => (
          <div key={g.nome} className="mb-1 last:mb-0">
            <p className="px-2 py-1.5 text-[0.62rem] font-semibold uppercase tracking-wider text-muted">
              {g.nome}
            </p>
            {g.itens.map(({ tipo, label, desc, Icone }) => (
              <button
                key={tipo}
                type="button"
                onClick={() => aoEscolher(tipo)}
                className="flex w-full items-center gap-3 rounded-[10px] px-2.5 py-2 text-left transition-colors hover:bg-brand/12"
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
      </div>
    </>
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
  clusters,
  capaInicial,
  autores,
  temLinkDeEntrada,
}: {
  inicial: ContentRow;
  comparaveis: PaginaComparavel[];
  fontesIniciais: Fonte[];
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
  const [assistente, setAssistente] = useState(false);
  const [seletorProduto, setSeletorProduto] = useState(false);
  const [seletorImagem, setSeletorImagem] = useState(false);
  const [capa, setCapa] = useState<ImagemDaBiblioteca | null>(capaInicial);
  const [seletorCapa, setSeletorCapa] = useState(false);
  const [seletorLink, setSeletorLink] = useState(false);
  const [salvando, iniciarSalvar] = useTransition();
  const [salvoEm, setSalvoEm] = useState<string | null>(null);
  const [versao, setVersao] = useState(inicial.updated_at);
  const [sujo, setSujo] = useState(false);
  const [conflito, setConflito] = useState(false);
  const [quantasFontes, setQuantasFontes] = useState(fontesIniciais.length);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Placeholder.configure({
        placeholder: "Escreva aqui, ou use o botão Inserir bloco logo abaixo.",
      }),
      LinkExt.configure({ openOnClick: false, HTMLAttributes: { rel: "noopener" } }),
      ImagemNode.configure({ HTMLAttributes: { loading: "lazy" } }),
      FiguraNode,
      VideoNode.configure({ width: 720, height: 405, nocookie: true }),
      ProdutoNode,
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
    const c = editor.chain().focus();
    switch (tipo) {
      case "paragrafo": c.insertContent("<p></p>").run(); break;
      case "h2": c.insertContent("<h2>Título da seção</h2>").run(); break;
      case "h3": c.insertContent("<h3>Subtítulo</h3>").run(); break;
      case "lista": c.toggleBulletList().run(); break;
      case "listaNum": c.toggleOrderedList().run(); break;
      case "citacao": c.toggleBlockquote().run(); break;
      case "divisor": c.setHorizontalRule().run(); break;
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
        c.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
        if (legenda.trim()) {
          editor.chain().focus().updateAttributes("table", { legenda: legenda.trim() }).run();
        }
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
        editor
          .chain()
          .focus()
          .insertContent({
            type: "youtube",
            attrs: { src: url, title: titulo.trim() },
          })
          .run();
        break;
      }
      case "produto": setSeletorProduto(true); break;
    }
    setMenuAberto(false);
  }, [editor]);

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
    editor
      ?.chain()
      .focus()
      .setImage({
        src: img.url,
        alt: img.alt ?? "",
        ...(img.width ? { width: img.width } : {}),
        ...(img.height ? { height: img.height } : {}),
      } as { src: string; alt: string })
      .run();
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
    if (temLegenda) {
      editor
        ?.chain()
        .focus()
        .inserirFigura({
          src: img.url,
          alt: img.alt,
          width: img.width,
          height: img.height,
          legenda: img.caption,
          credito: img.credit,
        })
        .run();
    } else {
      editor?.chain().focus().setImage({
        src: img.url,
        alt: img.alt,
        ...(img.width ? { width: img.width } : {}),
        ...(img.height ? { height: img.height } : {}),
      } as { src: string; alt: string }).run();
    }
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
    <div className="grid gap-8 lg:grid-cols-[1fr_23rem]">
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
        <div className={`glass relative mt-5 rounded-[20px] p-6 sm:p-7 ${menuAberto ? "z-50" : ""}`}>
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

          <div className="rounded-[12px] border border-border/60 bg-white/50 px-4 py-3 transition-colors focus-within:border-brand/50">
            <EditorContent editor={editor} />
          </div>

          <div className="relative mt-4">
            <button
              type="button"
              onClick={() => setMenuAberto((v) => !v)}
              className="flex items-center gap-2 rounded-full border border-dashed border-brand/50 bg-brand/6 px-4 py-2.5 text-sm font-semibold text-brand-nav transition-colors hover:border-brand hover:bg-brand/14"
            >
              <Plus size={16} /> Inserir bloco
            </button>
            {menuAberto ? <MenuBlocos aoEscolher={inserir} aoFechar={() => setMenuAberto(false)} /> : null}
          </div>

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
                editor
                  ?.chain()
                  .focus("end")
                  .insertContent(
                    pareceHtml
                      ? t
                      : t.split("\n").filter(Boolean).map((p) => `<p>${p}</p>`).join(""),
                  )
                  .run();
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
              aoEscolher={(href, rel) =>
                editor?.chain().focus().extendMarkRange("link")
                  .setLink(rel ? { href, rel } : { href }).run()
              }
              aoFechar={() => setSeletorLink(false)}
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
              aoFechar={() => setSeletorProduto(false)}
              aoEscolher={(p, url) => {
                // Preço promocional vence quando existe e é menor.
                const temPromo =
                  p.precoPromocional !== null && p.preco !== null && p.precoPromocional < p.preco;
                editor
                  ?.chain()
                  .focus("end")
                  .insertContent({
                    type: "produto",
                    attrs: {
                      produtoId: p.id,
                      nome: p.nome,
                      url,
                      imagem: p.imagem,
                      preco: String(temPromo ? p.precoPromocional : (p.preco ?? "")),
                      precoAntigo: temPromo ? String(p.preco) : null,
                      disponivel: p.disponivel,
                      prazo: p.prazo,
                    },
                  })
                  .run();
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
              <span className="text-xs font-semibold text-ink">Guia pilar deste assunto</span>
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
            <span className="text-xs font-semibold text-ink">Resumo na lista de guias</span>
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
              <span className={`rounded-full px-2.5 py-1 text-[0.68rem] font-semibold ${quantasFontes > 0 ? "bg-brand/15 text-brand-strong" : "bg-wine/10 text-wine"}`}>
                {quantasFontes > 0 ? `${quantasFontes} registrada${quantasFontes > 1 ? "s" : ""}` : "nenhuma"}
              </span>
            }
          />
          <Fontes contentId={inicial.id} iniciais={fontesIniciais} aoMudar={setQuantasFontes} />
        </div>
      </div>

      <aside className="lg:sticky lg:top-20 lg:h-fit">
        <PainelAnalise
          contentId={inicial.id}
          intencao={intencao}
          aoAplicar={aplicar}
          entrada={{
            titulo, slug, metaTitle, metaDescription, resposta, texto, html, faqs, consultaAlvo,
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
