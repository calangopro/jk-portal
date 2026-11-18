"use client";

import { useEffect, useRef, useState, type ClipboardEvent } from "react";
import Link from "next/link";
import { CircleAlert, CircleCheck, ImagePlus, Lightbulb, Loader2, X } from "lucide-react";
import { comBasePath } from "@/lib/seo/base-path";
import { ENDERECO_DAS_SUGESTOES, ENDERECO_DO_ENVIO, MAXIMO_DE_PRINTS, MINIMO_DO_TEXTO, TETO_DO_TEXTO } from "@/lib/sugestoes/sugestoes";
import { avisarQueAsContagensMudaram } from "../ContagensDoMenu";
import { prepararPrint } from "./prints";

type Print = { id: number; blob: Blob; url: string };
type Envio = (dados: FormData) => Promise<{ ok: boolean; erro?: string }>;

/** O envio de verdade: a rota converte os prints em webp e grava (`/api/painel/sugestoes`). */
const enviarAoServidor: Envio = async (dados) => {
  try {
    // `fetch` escrito por extenso não recebe o prefixo do site sozinho.
    const r = await fetch(comBasePath(ENDERECO_DO_ENVIO), { method: "POST", body: dados, credentials: "same-origin" });
    const corpo = (await r.json().catch(() => ({}))) as { ok?: boolean; erro?: string };
    return r.ok && corpo.ok ? { ok: true } : { ok: false, erro: corpo.erro ?? "Não deu para mandar agora. Tente de novo em alguns segundos." };
  } catch {
    return { ok: false, erro: "Sem conexão. Confira a internet e tente de novo." };
  }
};

/**
 * A janela de sugerir melhoria: o texto, até quatro prints (escolhidos ou
 * colados com Ctrl+V) e a tela de onde a pessoa veio, que vai junto sozinha.
 *
 * É um `<dialog>` nativo aberto com `showModal()`: fica na camada de cima do
 * navegador, então nenhuma pilha da moldura (a animação de entrada das telas,
 * a barra de baixo) passa por cima, e o foco fica preso nela. Com texto
 * escrito, o Esc não fecha: perder uma sugestão longa por uma tecla seria pior
 * do que clicar em Cancelar.
 */
export default function JanelaDeSugestao({
  caminho, telaNome, aoFechar, enviar = enviarAoServidor,
}: {
  caminho: string;
  telaNome: string;
  aoFechar: () => void;
  /** Só para a prévia de desenvolvimento, sem sessão: um envio de mentira. */
  enviar?: Envio;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const campo = useRef<HTMLTextAreaElement>(null);
  const seletor = useRef<HTMLInputElement>(null);
  const proximo = useRef(1);
  const [texto, setTexto] = useState("");
  const [prints, setPrints] = useState<Print[]>([]);
  const [preparando, setPreparando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [enviada, setEnviada] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const d = dialogo.current;
    if (d && !d.open) d.showModal();
    campo.current?.focus();
  }, []);

  // Os endereços das miniaturas ocupam memória até serem soltos.
  const printsAgora = useRef(prints);
  printsAgora.current = prints;
  useEffect(() => () => printsAgora.current.forEach((p) => URL.revokeObjectURL(p.url)), []);

  const adicionar = async (arquivos: Blob[]) => {
    const imagens = arquivos.filter((a) => a.type.startsWith("image/"));
    if (imagens.length === 0) return;
    const cabem = MAXIMO_DE_PRINTS - printsAgora.current.length;
    if (cabem <= 0) {
      setErro(`São até ${MAXIMO_DE_PRINTS} prints por sugestão.`);
      return;
    }
    setErro(null);
    setPreparando(true);
    const novos: Print[] = [];
    let falhou = false;
    for (const imagem of imagens.slice(0, cabem)) {
      const blob = await prepararPrint(imagem);
      if (blob) novos.push({ id: proximo.current++, blob, url: URL.createObjectURL(blob) });
      else falhou = true;
    }
    setPrints((atuais) => [...atuais, ...novos].slice(0, MAXIMO_DE_PRINTS));
    setPreparando(false);
    if (falhou) setErro("Um dos arquivos não deu para usar. Tente outro print.");
    else if (imagens.length > cabem) setErro(`Entraram ${cabem}: são até ${MAXIMO_DE_PRINTS} prints por sugestão.`);
  };

  const tirar = (id: number) =>
    setPrints((atuais) => {
      const sai = atuais.find((p) => p.id === id);
      if (sai) URL.revokeObjectURL(sai.url);
      return atuais.filter((p) => p.id !== id);
    });

  const colar = (e: ClipboardEvent<HTMLDialogElement>) => {
    const imagens = [...e.clipboardData.items]
      .filter((i) => i.kind === "file" && i.type.startsWith("image/"))
      .map((i) => i.getAsFile())
      .filter((f): f is File => f !== null);
    if (imagens.length === 0) return;
    e.preventDefault();
    void adicionar(imagens);
  };

  const mandar = async () => {
    if (enviando || preparando) return;
    if (texto.trim().length < MINIMO_DO_TEXTO) {
      setErro(`Escreva a sugestão com pelo menos ${MINIMO_DO_TEXTO} letras.`);
      campo.current?.focus();
      return;
    }
    setErro(null);
    setEnviando(true);
    const dados = new FormData();
    dados.set("texto", texto.trim());
    dados.set("tela", caminho);
    dados.set("telaNome", telaNome);
    dados.set("aparelho", window.matchMedia("(max-width: 1023px)").matches ? "celular" : "computador");
    dados.set("janela", `${window.innerWidth}x${window.innerHeight}`);
    prints.forEach((p, i) => dados.append("imagem", p.blob, `print-${i + 1}.${p.blob.type === "image/webp" ? "webp" : "jpg"}`));
    const r = await enviar(dados);
    setEnviando(false);
    if (!r.ok) {
      setErro(r.erro ?? "Não deu para mandar agora.");
      return;
    }
    setEnviada(true);
    // Para quem é da diretoria, o número de sugestões novas no menu muda.
    avisarQueAsContagensMudaram();
  };

  const temAlgo = texto.trim().length > 0 || prints.length > 0;

  return (
    <dialog
      ref={dialogo}
      aria-labelledby="sugestao-titulo"
      onClose={aoFechar}
      onCancel={(e) => {
        if (temAlgo && !enviada) e.preventDefault();
      }}
      onPaste={colar}
      className="m-auto w-[calc(100%-1.5rem)] max-w-lg rounded-[20px] border-0 bg-white p-0 text-ink shadow-2xl backdrop:bg-[rgb(23_21_18/0.45)]"
    >
      <div className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-[#fcefd9] text-[#8a5a00]" aria-hidden="true">
            <Lightbulb size={17} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="sugestao-titulo" className="font-display text-xl leading-tight text-ink">Sugerir melhoria</h2>
            <p className="mt-0.5 text-xs text-muted [overflow-wrap:anywhere]">Na tela {telaNome}</p>
          </div>
          <button
            type="button"
            onClick={() => dialogo.current?.close()}
            aria-label="Fechar"
            className="painel-toque -mr-1 -mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted hover:bg-ink/[0.05] hover:text-ink"
          >
            <X size={17} aria-hidden="true" />
          </button>
        </div>

        {enviada ? (
          <div className="mt-5" role="status">
            <p className="flex items-center gap-2 text-base font-semibold text-[#047857]">
              <CircleCheck size={18} aria-hidden="true" /> Sugestão recebida
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">
              Ela entrou no roadmap de melhorias do painel. Você acompanha o andamento e a resposta em Time, Sugestões.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                href={ENDERECO_DAS_SUGESTOES}
                onClick={() => dialogo.current?.close()}
                className="rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-white hover:bg-ink/85"
              >
                Ver minhas sugestões
              </Link>
              <button
                type="button"
                onClick={() => dialogo.current?.close()}
                className="rounded-full border border-ink/15 bg-white px-4 py-2.5 text-sm font-semibold text-ink hover:border-ink/30"
              >
                Fechar
              </button>
            </div>
          </div>
        ) : (
          <form
            className="mt-4"
            onSubmit={(e) => {
              e.preventDefault();
              void mandar();
            }}
          >
            <label htmlFor="sugestao-texto" className="block text-sm font-semibold text-ink">
              O que seria bom ter ou mudar?
            </label>
            <textarea
              id="sugestao-texto"
              ref={campo}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              maxLength={TETO_DO_TEXTO}
              rows={5}
              placeholder="Ex.: na lista de pedidos, um filtro por loja de retirada."
              className="mt-1.5 w-full resize-y rounded-[12px] border border-border bg-white px-3 py-2.5 text-sm leading-relaxed text-ink placeholder:text-muted"
            />

            <div className="mt-4">
              <p className="text-sm font-semibold text-ink">
                Prints <span className="font-normal text-muted">(opcional, até {MAXIMO_DE_PRINTS})</span>
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {prints.map((p, i) => (
                  <div key={p.id} className="relative h-20 w-20 overflow-hidden rounded-[10px] border border-ink/10 bg-ink/[0.03]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt={`Print ${i + 1}`} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => tirar(p.id)}
                      aria-label={`Tirar o print ${i + 1}`}
                      className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-ink/75 text-white hover:bg-ink"
                    >
                      <X size={13} aria-hidden="true" />
                    </button>
                  </div>
                ))}
                {prints.length < MAXIMO_DE_PRINTS ? (
                  <button
                    type="button"
                    onClick={() => seletor.current?.click()}
                    disabled={preparando}
                    className="flex h-20 min-w-20 flex-col items-center justify-center gap-1 rounded-[10px] border border-dashed border-ink/25 px-3 text-xs font-semibold text-ink hover:border-ink/45 disabled:opacity-60"
                  >
                    {preparando ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <ImagePlus size={16} aria-hidden="true" />}
                    {preparando ? "Preparando" : "Anexar print"}
                  </button>
                ) : null}
              </div>
              <input
                ref={seletor}
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
                onChange={(e) => {
                  const lista = [...(e.target.files ?? [])];
                  e.target.value = "";
                  void adicionar(lista);
                }}
              />
              <p className="mt-1.5 hidden text-xs text-muted lg:block">Dá para colar o print direto aqui, com Ctrl+V ou Cmd+V.</p>
            </div>

            {erro ? (
              <p role="alert" className="mt-4 flex items-start gap-2 text-sm text-[#b91c1c]">
                <CircleAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>{erro}</span>
              </p>
            ) : null}

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <button
                type="submit"
                disabled={enviando || preparando}
                className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-ink/85 disabled:opacity-60"
              >
                {enviando ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : null}
                {enviando ? "Enviando" : "Enviar sugestão"}
              </button>
              <button
                type="button"
                onClick={() => dialogo.current?.close()}
                className="rounded-full px-4 py-2.5 text-sm font-semibold text-muted hover:text-ink"
              >
                Cancelar
              </button>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted">
              Vai junto, sozinho, o nome desta tela e se você está no celular ou no computador. Quem cuida do painel lê todas.
            </p>
          </form>
        )}
      </div>
    </dialog>
  );
}
