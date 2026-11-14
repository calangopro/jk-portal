"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Check, Copy, ExternalLink, ImagePlus, Loader2, MessagesSquare, Sparkles, TriangleAlert, X } from "lucide-react";
import type { ResultadoDoTutor } from "@/lib/tutor/perguntar";
import { CHAVE_DO_RASCUNHO } from "@/lib/time/chat";
import { TETO_DA_IMAGEM } from "@/lib/tutor/regras";
import type { EstadoDoTutor } from "./actions";

/**
 * A tela do tutor do vendedor.
 *
 * FEITA PARA O JEITO COMO O VENDEDOR JÁ PERGUNTA: com o print da conversa. No
 * grupo do time, 67 das 272 mensagens do vendedor novo eram imagem, e em
 * várias a pergunta estava só nela. Por isso colar o print (Ctrl+V, ou o botão
 * no celular) é a entrada principal, e escrever é opcional.
 *
 * A imagem é reduzida AQUI, no navegador, antes de subir: print de celular tem
 * 2 a 3 MB, e a ação de servidor aceita 1 MB. Ela vai para o modelo de
 * linguagem ler e não é guardada.
 *
 * O tutor só responde com o que está na Biblioteca JK e no catálogo. Quando
 * não acha, a saída é perguntar no chat do time, e a tela leva até lá com a
 * pergunta já escrita.
 *
 * A ação vem de fora, como propriedade, para a tela poder ser vista sem sessão.
 */

export type PerguntaSemResposta = { id: number; pergunta: string; em: string };
type Perguntar = (duvida: string, imagem: string | null) => Promise<EstadoDoTutor>;

const reais = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const botaoClaro = "painel-toque inline-flex h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-ink/12 bg-white px-3.5 text-xs font-semibold text-ink disabled:opacity-60";
const botaoCheio = "painel-toque painel-aba-ativa inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-full px-5 text-sm font-semibold disabled:opacity-60";

/** Reduz a imagem até caber: primeiro o tamanho, depois a qualidade. Devolve `null` se não der para ler. */
async function reduzir(arquivo: Blob): Promise<string | null> {
  const url = URL.createObjectURL(arquivo);
  try {
    const img = await new Promise<HTMLImageElement>((ok, falha) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = falha;
      i.src = url;
    });
    for (const [lado, qualidade] of [[1600, 0.82], [1600, 0.7], [1280, 0.7], [1024, 0.65]] as const) {
      const escala = Math.min(1, lado / Math.max(img.naturalWidth, img.naturalHeight));
      const tela = document.createElement("canvas");
      tela.width = Math.round(img.naturalWidth * escala);
      tela.height = Math.round(img.naturalHeight * escala);
      const ctx = tela.getContext("2d");
      if (!ctx) return null;
      // Fundo branco: print em PNG com transparência viraria preto no JPEG.
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, tela.width, tela.height);
      ctx.drawImage(img, 0, 0, tela.width, tela.height);
      const dados = tela.toDataURL("image/jpeg", qualidade);
      if (dados.length <= TETO_DA_IMAGEM) return dados;
    }
    return null;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function Copiar({ texto, children }: { texto: string; children: React.ReactNode }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <button
      type="button"
      className={botaoClaro}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto);
          setCopiado(true);
          setTimeout(() => setCopiado(false), 1800);
        } catch {
          // Sem permissão de copiar: o texto continua na tela para selecionar.
        }
      }}
    >
      {copiado ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
      <span aria-live="polite">{copiado ? "Copiado" : children}</span>
    </button>
  );
}

function Resposta({ r }: { r: ResultadoDoTutor }) {
  return (
    <section className="mt-4 space-y-3" aria-label="Resposta do tutor">
      {r.leitura ? (
        <div className="glass rounded-[16px] p-4">
          <p className="text-xs font-semibold text-[var(--setor)]">{r.leitura.eConversa ? "O que o cliente quer saber" : "O que a imagem mostra"}</p>
          <p className="mt-1 break-words text-sm leading-relaxed text-ink">{r.leitura.pergunta}</p>
          {r.leitura.produto || r.leitura.detalhes ? (
            <p className="mt-1 break-words text-xs text-muted">{[r.leitura.produto, r.leitura.detalhes].filter(Boolean).join(". ")}</p>
          ) : null}
        </div>
      ) : null}

      {r.respondeu ? (
        <div className="glass rounded-[16px] p-4">
          {r.temFonteAConfirmar ? (
            <p className="mb-3 flex items-start gap-2 rounded-[10px] bg-[#fcefd9] p-2.5 text-xs leading-relaxed text-[#6d3505]">
              <TriangleAlert size={14} className="mt-px shrink-0" aria-hidden="true" />
              <span>
                <span className="font-bold">A JK ainda não confirmou esta resposta.</span> Ela saiu do que foi dito no grupo do time. Se for prometer prazo, valor ou
                política ao cliente, confirme antes.
              </span>
            </p>
          ) : null}
          <p className="text-xs font-semibold text-[var(--setor)]">Para você</p>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink">{r.paraOVendedor}</p>
          {r.fraseParaOCliente ? (
            <>
              <p className="mt-4 text-xs font-semibold text-[var(--setor)]">Para mandar ao cliente</p>
              <p className="mt-1.5 whitespace-pre-wrap break-words rounded-[12px] border border-ink/10 bg-white p-3 text-sm leading-relaxed text-ink">{r.fraseParaOCliente}</p>
              <div className="mt-2">
                <Copiar texto={r.fraseParaOCliente}>Copiar a mensagem</Copiar>
              </div>
            </>
          ) : null}
        </div>
      ) : (
        <div className="rounded-[16px] bg-[#fcefd9] p-4 text-[#6d3505]">
          <p className="flex items-center gap-2 text-sm font-bold">
            <TriangleAlert size={16} className="shrink-0" aria-hidden="true" /> A Biblioteca JK ainda não tem essa resposta
          </p>
          <p className="mt-1.5 break-words text-sm leading-relaxed">{r.paraOVendedor}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href="/admin/chat?pedir=1"
              // A pergunta vai guardada no navegador, e não pelo endereço: endereço fica em histórico e em registro. O chat lê e apaga.
              onClick={() => {
                try {
                  sessionStorage.setItem(CHAVE_DO_RASCUNHO, r.pergunta);
                } catch {
                  // Sem armazenamento de sessão, a pessoa cola: o botão de copiar está ao lado.
                }
              }}
              className="painel-toque inline-flex h-10 items-center gap-1.5 rounded-full bg-[#6d3505] px-4 text-xs font-semibold text-white"
            >
              <MessagesSquare size={14} aria-hidden="true" /> Perguntar no chat
            </Link>
            <Copiar texto={r.pergunta}>Copiar a pergunta</Copiar>
          </div>
          <p className="mt-2 text-[0.7rem] leading-relaxed">A pergunta já vai escrita no chat, pedindo resposta: é só escolher a sala e enviar. A resposta do time pode virar item da biblioteca.</p>
        </div>
      )}

      {r.produtos.length > 0 ? (
        <div className="glass rounded-[16px] p-4">
          <p className="text-xs font-semibold text-[var(--setor)]">{r.produtos.length === 1 ? "O produto" : "Produtos que batem com o pedido"}</p>
          {r.produtos.length > 1 ? <p className="mt-0.5 text-[0.7rem] text-muted">Confirme com o cliente qual é antes de mandar o link.</p> : null}
          <ul className="mt-1 divide-y divide-ink/[0.07]">
            {r.produtos.map((p) => (
              <li key={p.codigo} className="py-2.5">
                <p className="break-words text-sm font-semibold leading-snug text-ink">{p.nome}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {p.preco !== null ? <span className="numeros font-semibold text-ink">{reais(p.preco)}</span> : "Sem preço"} · Cód. {p.codigo}
                </p>
                {p.prazo ? (
                  <p className="mt-1 text-xs leading-relaxed text-ink">
                    Fechando hoje: {p.prazo.retirada} {p.prazo.correios}
                  </p>
                ) : null}
                {p.url ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Copiar texto={p.url}>Copiar o link</Copiar>
                    <a href={p.url} target="_blank" rel="noreferrer" className={botaoClaro}>
                      <ExternalLink size={14} aria-hidden="true" /> Abrir na loja
                    </a>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {r.fontes.length > 0 ? (
        <div className="glass rounded-[16px] p-4">
          <p className="text-xs font-semibold text-[var(--setor)]">De onde saiu</p>
          <ul className="mt-1.5 space-y-1.5">
            {r.fontes.map((f) => (
              <li key={f.id} className="text-xs leading-relaxed">
                <Link href={`/admin/biblioteca?r=${f.id}`} className="font-semibold text-ink underline decoration-ink/25 underline-offset-2">
                  {f.pergunta}
                </Link>{" "}
                <span className={f.confirmada ? "text-[#046c4e]" : "text-[#9a4a07]"}>({f.confirmada ? "confirmada pela JK" : "a confirmar"})</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

export function TelaDoTutor({ perguntar, semResposta }: { perguntar: Perguntar; /** Só para administrador, dono e GM. */ semResposta: PerguntaSemResposta[] | null }) {
  const [ocupado, comecar] = useTransition();
  const [duvida, setDuvida] = useState("");
  const [imagem, setImagem] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [resposta, setResposta] = useState<ResultadoDoTutor | null>(null);
  const arquivo = useRef<HTMLInputElement>(null);

  const receber = async (blob: Blob | null | undefined) => {
    if (!blob || !blob.type.startsWith("image/")) return;
    setErro(null);
    const dados = await reduzir(blob);
    if (dados) setImagem(dados);
    else setErro("Não deu para usar essa imagem. Tente outro print.");
  };

  // Colar em qualquer lugar da tela: no computador, o print vem do Ctrl+V.
  useEffect(() => {
    const aoColar = (e: ClipboardEvent) => {
      const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith("image/"));
      if (item) {
        e.preventDefault();
        void receber(item.getAsFile());
      }
    };
    window.addEventListener("paste", aoColar);
    return () => window.removeEventListener("paste", aoColar);
  }, []);

  const enviar = () =>
    comecar(async () => {
      setErro(null);
      setResposta(null);
      const r = await perguntar(duvida, imagem);
      if (r.ok) setResposta(r.resposta);
      else setErro(r.erro);
    });

  return (
    <div>
      <header>
        <p className="eyebrow">Time</p>
        <h1 className="font-display mt-2 text-3xl text-ink sm:text-4xl">Tutor</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted sm:text-base">
          Cole o print da conversa ou escreva a dúvida. Ele responde com o que está na Biblioteca JK e no catálogo, e avisa quando a casa ainda não tem a
          resposta.
        </p>
      </header>

      <section className="glass mt-5 rounded-[18px] p-4 sm:p-5" aria-label="Sua pergunta">
        {imagem ? (
          <div className="mb-3 flex items-start gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imagem} alt="O print que vai ser lido" className="h-28 w-auto max-w-[45%] rounded-[10px] border border-ink/10 bg-white object-contain" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-ink">Print pronto para ler</p>
              <p className="mt-0.5 text-[0.7rem] leading-relaxed text-muted">A imagem é lida e não fica guardada.</p>
              <button type="button" onClick={() => setImagem(null)} className={`${botaoClaro} mt-2`}>
                <X size={14} aria-hidden="true" /> Tirar
              </button>
            </div>
          </div>
        ) : null}

        <label className="block">
          <span className="text-xs font-semibold text-ink">{imagem ? "Quer dizer mais alguma coisa? (pode ficar vazio)" : "Qual é a dúvida?"}</span>
          <textarea
            value={duvida}
            onChange={(e) => setDuvida(e.target.value)}
            maxLength={600}
            rows={3}
            placeholder={imagem ? "Ex.: o cliente está em Osasco" : "Ex.: o cliente pode gravar a aliança depois de comprar?"}
            className="mt-1.5 w-full rounded-[12px] border border-ink/15 bg-white px-3 py-2.5 text-base text-ink outline-none placeholder:text-muted focus:border-[var(--setor)]"
          />
        </label>

        <input
          ref={arquivo}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            void receber(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" disabled={ocupado || (!duvida.trim() && !imagem)} onClick={enviar} className={botaoCheio}>
            {ocupado ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Sparkles size={16} aria-hidden="true" />} Perguntar
          </button>
          <button type="button" disabled={ocupado} onClick={() => arquivo.current?.click()} className={`${botaoClaro} h-11`}>
            <ImagePlus size={15} aria-hidden="true" /> {imagem ? "Trocar o print" : "Escolher o print"}
          </button>
          {resposta ? (
            <button
              type="button"
              disabled={ocupado}
              onClick={() => {
                setResposta(null);
                setDuvida("");
                setImagem(null);
              }}
              className={`${botaoClaro} h-11`}
            >
              Nova pergunta
            </button>
          ) : null}
        </div>
        <p className="mt-2 text-[0.7rem] leading-relaxed text-muted">No computador, dá para colar o print direto com Ctrl+V.</p>

        {ocupado ? (
          <p role="status" className="mt-3 text-sm text-muted">
            {imagem ? "Lendo o print e procurando na biblioteca. Costuma levar uns 20 segundos." : "Procurando na biblioteca. Costuma levar uns 10 segundos."}
          </p>
        ) : null}
        {erro ? (
          <p role="alert" className="mt-3 text-sm font-semibold text-[#b01919]">
            {erro}
          </p>
        ) : null}
      </section>

      {resposta ? <Resposta r={resposta} /> : null}

      {semResposta && semResposta.length > 0 ? (
        <section className="glass mt-6 rounded-[18px] p-4 sm:p-5" aria-labelledby="titulo-sem-resposta">
          <h2 id="titulo-sem-resposta" className="text-sm font-semibold text-ink">O que o time perguntou e a biblioteca não tinha</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Só administrador, dono e GM veem esta lista, dos últimos 14 dias. É o que falta escrever na{" "}
            <Link href="/admin/biblioteca" className="font-semibold text-ink underline underline-offset-2">
              Biblioteca JK
            </Link>
            .
          </p>
          <ul className="mt-2 divide-y divide-ink/[0.07]">
            {semResposta.map((p) => (
              <li key={p.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2">
                <span className="min-w-0 break-words text-sm text-ink">{p.pergunta}</span>
                <span className="numeros shrink-0 text-[0.7rem] text-muted">{new Date(p.em).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" })}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="mt-5 max-w-3xl text-[0.7rem] leading-relaxed text-muted">
        O tutor usa um modelo de linguagem para ler o print e escrever a resposta, mas só pode usar o que está na Biblioteca JK e no catálogo: preço, prazo e
        política que não estão lá, ele não inventa. A imagem não é guardada. O que fica registrado é a dúvida em uma frase, para a casa saber o que falta
        responder.
      </p>
    </div>
  );
}
