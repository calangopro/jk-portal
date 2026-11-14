"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, ChevronUp, ExternalLink, ImagePlus, Loader2, RotateCcw, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { FotoDoProduto, ItemDoCatalogo } from "@/lib/catalogo/fotos";
import {
  COR,
  EXPLICACAO,
  ROTULO,
  ROTULO_DA_FOTO,
  ROTULO_DO_TIPO,
  TIPOS_DE_FOTO,
  type EstadoDoProduto,
  type TipoDeFoto,
} from "@/lib/catalogo/estados";
import { nomeDeArquivo, paraJpeg } from "@/lib/catalogo/jpeg-no-navegador";
import { decidir, devolver, dispensar, gravarNaLoja, lerNaLoja, lerProduto, levarFotosDoProduto, preverFotosDoProduto, preverNaLoja, registrarFoto } from "./actions";
import { EditarNaLoja } from "./EditarNaLoja";
import { FotosNaLoja } from "./FotosNaLoja";
import { digitando, reais, type MargemNaLista } from "./util";
import { MargemNaGaveta } from "./MargemNaGaveta";

/** Motivos que mais aparecem, para quem revisa não precisar digitar. */
const MOTIVOS = [
  "A pedra mudou",
  "A largura mudou",
  "A cor do metal mudou",
  "A peça entortou",
  "Fundo fora do padrão",
  "Reflexo estranho",
];

const quando = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Sao_Paulo",
      })
    : "";

/** O mesmo critério do gatilho do banco (0047), para a lista mudar na hora. */
function estadoPelasFotos(fotos: FotoDoProduto[], anterior: EstadoDoProduto): EstadoDoProduto {
  const tem = (s: FotoDoProduto["status"]) => fotos.some((f) => f.status === s);
  if (tem("aguardando")) return "aguardando";
  if (tem("aprovada")) return "aprovada";
  if (tem("na_loja")) return "na_loja";
  if (tem("recusada")) return "refazer";
  return anterior;
}

/** As abas da gaveta. Só aparece a que a pessoa pode usar. */
export type AbaDaGaveta = "dados" | "fotos" | "custo";

const NOME_DA_ABA: Record<AbaDaGaveta, string> = { dados: "Dados", fotos: "Fotos", custo: "Custo" };

export function Gaveta({
  produto,
  posicao,
  onFechar,
  onAndar,
  onEstado,
  margem,
  loja = null,
  aba,
  onAba,
}: {
  produto: ItemDoCatalogo;
  /** A aba aberta. Mora em quem chama, para continuar a mesma ao passar de um produto para outro. */
  aba: AbaDaGaveta;
  onAba: (a: AbaDaGaveta) => void;
  /** Quem pode alterar a loja pelo painel. Nulo esconde a seção. */
  loja?: { podePreco: boolean } | null;
  /** Só para administrador; undefined esconde a seção. */
  margem?: MargemNaLista | null;
  posicao: { i: number; de: number };
  onFechar: () => void;
  onAndar: (passo: 1 | -1) => void;
  onEstado: (e: EstadoDoProduto) => void;
}) {
  const router = useRouter();
  const [fotos, setFotos] = useState<FotoDoProduto[] | null>(null);
  const [padrao, setPadrao] = useState<{ texto: string; daCategoria: boolean } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [recusando, setRecusando] = useState<string | null>(null);
  const [nota, setNota] = useState("");
  const [tipo, setTipo] = useState<TipoDeFoto>("produto");
  const [enviando, setEnviando] = useState(false);
  const [dispensando, setDispensando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [pendente, comecar] = useTransition();
  const painel = useRef<HTMLDivElement>(null);

  // Dados só para quem altera a loja; custo só para quem vê a margem.
  const abas: AbaDaGaveta[] = [...(loja ? (["dados"] as const) : []), "fotos", ...(margem !== undefined ? (["custo"] as const) : [])];
  const abaAtual: AbaDaGaveta = abas.includes(aba) ? aba : "fotos";
  const nasFotos = abaAtual === "fotos";
  const campoDaNota = useRef<HTMLTextAreaElement>(null);
  const arquivo = useRef<HTMLInputElement>(null);

  const carregar = useCallback(async () => {
    const r = await lerProduto(produto.id, produto.categoriaId);
    if (!r.ok) {
      setErro(r.erro);
      return null;
    }
    setFotos(r.fotos);
    setPadrao({ texto: r.padrao, daCategoria: r.padraoDaCategoria });
    return r.fotos;
  }, [produto.id, produto.categoriaId]);

  useEffect(() => {
    carregar();
    painel.current?.focus();
  }, [carregar]);

  /** Depois de qualquer ação: fotos de novo, lista ajustada na hora, servidor em seguida. */
  const depois = useCallback(
    async (estadoForcado?: EstadoDoProduto) => {
      const novas = await carregar();
      if (estadoForcado) onEstado(estadoForcado);
      else if (novas) onEstado(estadoPelasFotos(novas, "falta"));
      router.refresh();
    },
    [carregar, onEstado, router],
  );

  const ativas = (fotos ?? []).filter((f) => f.status !== "substituida");
  const historico = (fotos ?? []).filter((f) => f.status === "substituida");
  const paraOlhar = ativas.find((f) => f.status === "aguardando") ?? null;
  const destaque = paraOlhar ?? ativas.find((f) => f.status === "aprovada") ?? ativas[0] ?? null;

  const aprovar = useCallback(
    (f: FotoDoProduto) =>
      comecar(async () => {
        setErro(null);
        const r = await decidir({ fotoId: f.id, aprovar: true });
        if (!r.ok) setErro(r.erro);
        await depois();
      }),
    [depois],
  );

  const recusar = (f: FotoDoProduto) =>
    comecar(async () => {
      setErro(null);
      const r = await decidir({ fotoId: f.id, aprovar: false, nota });
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      setRecusando(null);
      setNota("");
      await depois();
    });

  const enviar = async (lista: FileList | null) => {
    const original = lista?.[0];
    if (!original) return;
    setErro(null);
    setEnviando(true);
    try {
      const jpeg = await paraJpeg(original);
      const caminho = `produtos/${produto.trayId}/${nomeDeArquivo(produto.nome)}-${tipo}-${Date.now()}.jpg`;
      const up = await createClient()
        .storage.from("media")
        .upload(caminho, jpeg.arquivo, { contentType: "image/jpeg", cacheControl: "31536000", upsert: false });
      if (up.error) throw new Error(up.error.message);
      const r = await registrarFoto({
        productId: produto.id,
        caminho,
        largura: jpeg.largura,
        altura: jpeg.altura,
        bytes: jpeg.arquivo.size,
        tipo,
      });
      if (!r.ok) throw new Error(r.erro);
      await depois();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não deu para enviar.");
    } finally {
      setEnviando(false);
      if (arquivo.current) arquivo.current.value = "";
    }
  };

  // Atalhos: J e K andam, A aprova, R pede para refazer, Esc fecha.
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Escape") {
        if (recusando) setRecusando(null);
        else onFechar();
        return;
      }
      if (digitando(e)) return;
      const k = e.key.toLowerCase();
      if (k === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        onAndar(1);
      } else if (k === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        onAndar(-1);
      } else if (!nasFotos) {
        // Fora da aba de fotos, A e R não fazem nada: aprovar uma foto que
        // não está na tela seria aprovar sem olhar.
        return;
      } else if (k === "a" && paraOlhar && !pendente) {
        e.preventDefault();
        aprovar(paraOlhar);
      } else if (k === "r" && paraOlhar) {
        e.preventDefault();
        setRecusando(paraOlhar.id);
        requestAnimationFrame(() => campoDaNota.current?.focus());
      }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [onFechar, onAndar, aprovar, paraOlhar, pendente, recusando, nasFotos]);

  return (
    <div
      ref={painel}
      tabIndex={-1}
      role="dialog"
      aria-labelledby="gaveta-titulo"
      // z-50: acima do cabeçalho e da barra de baixo do painel, que são z-40.
      className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[38rem] flex-col border-l border-border bg-[var(--color-surface-alt)] shadow-[0_0_60px_rgba(23,21,18,0.18)] outline-none"
    >
      {/* Topo */}
      <div className="flex items-center gap-2 border-b border-border px-5 py-3">
        <button type="button" onClick={() => onAndar(-1)} className="rounded-full p-2 text-ink hover:bg-ink/5" aria-label="Produto anterior (K)">
          <ChevronUp size={18} />
        </button>
        <button type="button" onClick={() => onAndar(1)} className="rounded-full p-2 text-ink hover:bg-ink/5" aria-label="Próximo produto (J)">
          <ChevronDown size={18} />
        </button>
        <span className="text-xs text-muted">
          {posicao.i + 1} de {posicao.de}
          <span className="ml-2 hidden sm:inline">{nasFotos ? "J e K andam, A aprova, R pede para refazer" : "J e K andam entre os produtos"}</span>
        </span>
        <button
          type="button"
          onClick={onFechar}
          className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-white px-3.5 py-2 text-xs font-semibold text-ink hover:border-ink/40"
          aria-label="Fechar (Esc)"
        >
          <X size={15} aria-hidden /> Fechar
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-10 pt-5">
        {/* Produto */}
        <p className="text-xs text-muted">
          {produto.categoria} · Cód. {produto.trayId}
          {produto.vendidos ? ` · ${produto.vendidos.toLocaleString("pt-BR")} vendidos` : ""}
        </p>
        <h2 id="gaveta-titulo" className="font-display mt-1 text-2xl leading-tight text-ink">
          {produto.nome}
        </h2>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <span>
            {produto.precoAntes ? <span className="mr-1.5 text-muted line-through">{reais(produto.precoAntes)}</span> : null}
            <span className="font-semibold text-ink">{reais(produto.preco)}</span>
          </span>
          {!produto.disponivel ? <span className="text-xs font-semibold text-wine">Indisponível na loja</span> : null}
          {produto.url ? (
            <a
              href={produto.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-semibold text-brand-nav hover:underline"
            >
              Ver na loja <ExternalLink size={11} />
            </a>
          ) : null}
        </div>

        {erro ? (
          <p role="alert" className="mt-4 rounded-[12px] bg-wine/10 px-4 py-3 text-sm text-wine">
            {erro}
          </p>
        ) : null}


        {/* As abas. Com uma só (quem não altera a loja nem vê custo), a fileira nem aparece. */}
        {abas.length > 1 ? (
          <div role="tablist" aria-label="Partes do produto" className="mt-5 flex gap-1 rounded-[12px] bg-ink/[0.05] p-1">
            {abas.map((a) => (
              <button
                key={a}
                type="button"
                role="tab"
                id={`aba-${a}`}
                aria-selected={abaAtual === a}
                aria-controls={`painel-${a}`}
                onClick={() => onAba(a)}
                className={`flex-1 rounded-[9px] px-3 py-2 text-sm font-semibold transition-colors ${
                  abaAtual === a ? "bg-white text-ink shadow-sm" : "text-ink/60 hover:text-ink"
                }`}
              >
                {NOME_DA_ABA[a]}
                {a === "fotos" && produto.estado === "aguardando" ? <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-wine align-middle" aria-label="tem foto para aprovar" /> : null}
              </button>
            ))}
          </div>
        ) : null}

        {abaAtual === "dados" && loja ? (
          <div role="tabpanel" id="painel-dados" aria-labelledby="aba-dados">
            <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 rounded-[14px] border border-border bg-white/70 p-4 sm:grid-cols-3">
              <Dado rotulo="Preço na loja">
                {produto.precoAntes ? <span className="mr-1.5 text-xs text-muted line-through">{reais(produto.precoAntes)}</span> : null}
                {reais(produto.preco)}
              </Dado>
              <Dado rotulo="Situação">{produto.disponivel ? "Disponível" : "Indisponível"}</Dado>
              <Dado rotulo="Vendidos">{produto.vendidos.toLocaleString("pt-BR")}</Dado>
              <Dado rotulo="Código">{produto.trayId}</Dado>
              <div className="col-span-2 min-w-0">
                <dt className="text-[0.68rem] font-semibold uppercase tracking-wider text-muted">Categoria</dt>
                <dd className="mt-0.5 break-words text-sm font-semibold text-ink">{produto.categoria}</dd>
              </div>
            </dl>
            <p className="mt-2 text-[0.7rem] text-muted">Como o painel leu da loja na última sincronização. O formulário abaixo lê de novo, na hora.</p>
            <EditarNaLoja
              key={`loja-${produto.id}`}
              trayId={produto.trayId}
              podePreco={loja.podePreco}
              acoes={{ ler: lerNaLoja, prever: preverNaLoja, gravar: gravarNaLoja }}
              abrirSozinho
            />
          </div>
        ) : null}

        {abaAtual === "custo" && margem !== undefined ? (
          <div role="tabpanel" id="painel-custo" aria-labelledby="aba-custo">
            <MargemNaGaveta key={produto.id} productId={produto.id} margem={margem} />
          </div>
        ) : null}

        {nasFotos ? (
          <div role="tabpanel" id="painel-fotos" aria-labelledby="aba-fotos">
          <div className="mt-4 flex items-start gap-3 rounded-[14px] border border-border bg-white/70 px-4 py-3">
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${COR[produto.estado]}`}>
              {ROTULO[produto.estado]}
            </span>
            <p className="text-sm text-muted">
              {EXPLICACAO[produto.estado]}
              {produto.nota && (produto.estado === "refazer" || produto.estado === "dispensada") ? (
                <span className="mt-1 block text-ink">“{produto.nota}”</span>
              ) : null}
            </p>
          </div>


          {/* Antes e depois, do mesmo tamanho: é aqui que se vê se a IA mudou a peça. */}
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Quadro rotulo="Na loja agora" url={produto.imagem} />
            {fotos === null ? (
              <div className="flex aspect-square items-center justify-center rounded-[14px] border border-border bg-white">
                <Loader2 size={18} className="animate-spin text-brand-nav" />
              </div>
            ) : (
              <Quadro
                rotulo={destaque ? `Nova · ${ROTULO_DO_TIPO[destaque.tipo]} · ${ROTULO_DA_FOTO[destaque.status]}` : "Foto nova"}
                url={destaque?.url ?? null}
                vazio="Ainda não chegou foto nova."
              />
            )}
          </div>

          {/* Decisão sobre a foto em destaque */}
          {paraOlhar ? (
            <div className="mt-4 rounded-[14px] border border-brand/40 bg-brand/[0.06] p-4">
              <p className="text-sm text-ink">
                A peça é a mesma? Confira pedra, largura, cor do metal e acabamento.
              </p>
              {recusando === paraOlhar.id ? (
                <div className="mt-3">
                  <div className="flex flex-wrap gap-1.5">
                    {MOTIVOS.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setNota((n) => (n ? `${n}. ${m}` : m))}
                        className="rounded-full border border-border bg-white px-2.5 py-1 text-xs text-ink hover:border-wine"
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                  <label className="mt-3 block text-xs font-semibold text-ink" htmlFor="nota-recusa">
                    O que refazer (o Claude lê isto na próxima foto)
                  </label>
                  <textarea
                    id="nota-recusa"
                    ref={campoDaNota}
                    value={nota}
                    onChange={(e) => setNota(e.target.value)}
                    rows={3}
                    maxLength={500}
                    className="mt-1 w-full rounded-[10px] border border-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-wine"
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      disabled={pendente || nota.trim().length < 3}
                      onClick={() => recusar(paraOlhar)}
                      className="rounded-full bg-wine px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      Pedir para refazer
                    </button>
                    <button type="button" onClick={() => setRecusando(null)} className="rounded-full px-3 py-2 text-sm text-muted">
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={pendente}
                    onClick={() => aprovar(paraOlhar)}
                    className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2 text-sm font-semibold text-ink hover:bg-brand-light disabled:opacity-60"
                  >
                    {pendente ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Aprovar
                    <kbd className="text-xs text-ink/60">A</kbd>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRecusando(paraOlhar.id);
                      requestAnimationFrame(() => campoDaNota.current?.focus());
                    }}
                    className="inline-flex items-center gap-2 rounded-full border border-wine/40 px-4 py-2 text-sm font-semibold text-wine hover:bg-wine/5"
                  >
                    Refazer <kbd className="text-xs text-wine/60">R</kbd>
                  </button>
                </div>
              )}
            </div>
          ) : null}

          {/* Todas as fotos novas */}
          {ativas.length > 0 ? (
            <section className="mt-6">
              <p className="eyebrow">Fotos novas deste produto</p>
              <ul className="mt-3 space-y-3">
                {ativas.map((f) => (
                  <CartaoDaFoto key={f.id} f={f} destaque={f.id === destaque?.id} onAprovar={aprovar} pendente={pendente} />
                ))}
              </ul>
            </section>
          ) : null}

          {/* Só aparece para quem altera a loja, e só quando há foto aprovada esperando. */}
          {loja && ativas.some((f) => f.status === "aprovada") ? (
            <FotosNaLoja
              key={`fotos-${produto.id}`}
              productId={produto.id}
              acoes={{ prever: preverFotosDoProduto, levar: levarFotosDoProduto }}
              onFeito={() => void depois()}
            />
          ) : null}

          {historico.length > 0 ? (
            <details className="mt-4">
              <summary className="cursor-pointer text-xs font-semibold text-muted">
                Versões substituídas ({historico.length})
              </summary>
              <ul className="mt-3 grid grid-cols-3 gap-2">
                {historico.map((f) => (
                  <li key={f.id}>
                    <a href={f.url} target="_blank" rel="noopener noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={f.url} alt="" className="aspect-square w-full rounded-[10px] border border-border bg-white object-contain" loading="lazy" />
                    </a>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}

          {/* Envio feito fora do Claude */}
          <section className="mt-6 rounded-[14px] border border-dashed border-border bg-white/60 p-4">
            <p className="text-sm font-semibold text-ink">Enviar foto daqui</p>
            <p className="mt-1 text-xs text-muted">
              Para foto gerada no site do Magnific ou feita à mão. Vira JPEG de até 2000 px e entra para aprovação.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <div className="flex rounded-full border border-border bg-white p-0.5" role="radiogroup" aria-label="Tipo da foto">
                {TIPOS_DE_FOTO.map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="radio"
                    aria-checked={tipo === t}
                    onClick={() => setTipo(t)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold ${tipo === t ? "bg-ink text-white" : "text-ink"}`}
                  >
                    {ROTULO_DO_TIPO[t]}
                  </button>
                ))}
              </div>
              <label
                className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-charcoal"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  enviar(e.dataTransfer.files);
                }}
              >
                {enviando ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
                {enviando ? "Enviando…" : "Escolher ou arrastar"}
                <input
                  ref={arquivo}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  disabled={enviando}
                  onChange={(e) => enviar(e.target.files)}
                />
              </label>
            </div>
          </section>

          {padrao ? (
            <details className="mt-4 rounded-[14px] border border-border bg-white/60 p-4">
              <summary className="cursor-pointer text-sm font-semibold text-ink">
                Padrão de foto {padrao.daCategoria ? "desta categoria" : "(geral)"}
              </summary>
              <p className="mt-3 whitespace-pre-line text-xs leading-relaxed text-muted">{padrao.texto}</p>
            </details>
          ) : null}

          {/* Dispensar */}
          <div className="mt-6 border-t border-border pt-4">
            {produto.estado === "dispensada" ? (
              <button
                type="button"
                disabled={pendente}
                onClick={() =>
                  comecar(async () => {
                    const r = await devolver(produto.id);
                    if (!r.ok) setErro(r.erro);
                    else await depois(estadoPelasFotos(fotos ?? [], "falta"));
                  })
                }
                className="inline-flex items-center gap-2 text-sm font-semibold text-brand-nav hover:underline"
              >
                <RotateCcw size={14} /> Voltar para a fila de fotos
              </button>
            ) : dispensando ? (
              <div>
                <label htmlFor="motivo" className="text-xs font-semibold text-ink">
                  Por que não precisa de foto nova?
                </label>
                <input
                  id="motivo"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Ex.: vai sair de linha, a foto atual já está boa"
                  className="mt-1 h-10 w-full rounded-[10px] border border-border bg-white px-3 text-sm outline-none focus:border-brand"
                />
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    disabled={pendente}
                    onClick={() =>
                      comecar(async () => {
                        const r = await dispensar({ productId: produto.id, motivo });
                        if (!r.ok) setErro(r.erro);
                        else {
                          setDispensando(false);
                          await depois("dispensada");
                        }
                      })
                    }
                    className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    Dispensar
                  </button>
                  <button type="button" onClick={() => setDispensando(false)} className="px-3 text-sm text-muted">
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setDispensando(true)} className="text-sm text-muted hover:text-ink hover:underline">
                Este produto não precisa de foto nova
              </button>
            )}
          </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Dado({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[0.68rem] font-semibold uppercase tracking-wider text-muted">{rotulo}</dt>
      <dd className="numeros mt-0.5 text-sm font-semibold text-ink">{children}</dd>
    </div>
  );
}

function Quadro({ rotulo, url, vazio = "Sem imagem." }: { rotulo: string; url: string | null; vazio?: string }) {
  return (
    <figure>
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" title="Abrir em tamanho real">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="" className="aspect-square w-full rounded-[14px] border border-border bg-white object-contain" />
        </a>
      ) : (
        <div className="flex aspect-square items-center justify-center rounded-[14px] border border-dashed border-border bg-white/50 px-4 text-center text-xs text-muted">
          {vazio}
        </div>
      )}
      <figcaption className="mt-1.5 text-xs text-muted">{rotulo}</figcaption>
    </figure>
  );
}

function CartaoDaFoto({
  f,
  destaque,
  onAprovar,
  pendente,
}: {
  f: FotoDoProduto;
  destaque: boolean;
  onAprovar: (f: FotoDoProduto) => void;
  pendente: boolean;
}) {
  const corDoStatus =
    f.status === "aprovada"
      ? "bg-brand-strong text-white"
      : f.status === "na_loja"
        ? "bg-emerald-100 text-emerald-800"
        : f.status === "recusada"
          ? "bg-wine/10 text-wine"
          : "bg-brand/25 text-brand-strong";
  return (
    <li className={`flex gap-3 rounded-[14px] border bg-white/70 p-3 ${destaque ? "border-brand" : "border-border"}`}>
      <a href={f.url} target="_blank" rel="noopener noreferrer" className="shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={f.url} alt="" loading="lazy" className="h-20 w-20 rounded-[10px] border border-border bg-white object-contain" />
      </a>
      <div className="min-w-0 flex-1 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`rounded-full px-2 py-0.5 font-semibold ${corDoStatus}`}>{ROTULO_DA_FOTO[f.status]}</span>
          <span className="rounded-full bg-ink/[0.06] px-2 py-0.5 font-semibold text-ink">{ROTULO_DO_TIPO[f.tipo]}</span>
          {f.largura ? (
            <span className="text-muted">
              {f.largura} x {f.altura}
            </span>
          ) : null}
        </div>
        <p className="mt-1.5 text-muted">
          {f.origem === "conector" ? "Pelo Claude" : "Pelo painel"}
          {f.enviadaPor ? `, ${f.enviadaPor}` : ""}, {quando(f.criadaEm)}
          {f.revisadaPor ? `. Decidida por ${f.revisadaPor} em ${quando(f.revisadaEm)}` : ""}
          {f.exportadaEm && f.status === "aprovada" ? `. Saiu na planilha em ${quando(f.exportadaEm)}` : ""}
          {f.naLojaEm ? `. Na loja desde ${quando(f.naLojaEm)}` : ""}.
        </p>
        {f.nota ? <p className="mt-1 text-wine">“{f.nota}”</p> : null}
        {f.comoFoiFeita ? (
          <details className="mt-1">
            <summary className="cursor-pointer text-muted">Como foi feita</summary>
            <p className="mt-1 whitespace-pre-line text-muted">{f.comoFoiFeita}</p>
          </details>
        ) : null}
        {f.status === "aguardando" && !destaque ? (
          <button
            type="button"
            disabled={pendente}
            onClick={() => onAprovar(f)}
            className="mt-2 rounded-full border border-brand px-3 py-1 font-semibold text-brand-strong hover:bg-brand/10 disabled:opacity-60"
          >
            Aprovar esta
          </button>
        ) : null}
      </div>
    </li>
  );
}
