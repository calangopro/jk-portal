"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, CalendarClock, CircleAlert, CircleCheck, Film, ImagePlus, LoaderCircle, Send, Trash2, X } from "lucide-react";
import { SeloDaRede } from "@/components/redes/Selo";
import { NOME_DO_FORMATO, nomeDaRede, nomeDoFormatoNaRede, type Formato, type RedeId } from "@/lib/redes/redes";
import { FORMATOS_PUBLICAVEIS, LIMITES, temTravessao, validarPeca } from "@/lib/redes/regras";
import type { DadosDoPost, PostNaTela } from "@/lib/redes/posts";
import type { Midia } from "@/lib/redes/tipos";
import type { Resposta } from "./actions";
import type { EnvioPreparado } from "@/lib/redes/armazenamento";
import { faixaEmPalavra, proximosHorarios, type HorariosDaRede } from "@/lib/redes/horarios";
import { duracaoEmPalavra, horaDeSaoPaulo, medirVideo, paraCampoDeHora, prepararImagem, subir, tamanhoEmPalavra } from "./midia";

/**
 * O compositor: montar um post, escolher para onde vai e quando sai.
 *
 * Uma tela só, de cima para baixo, na ordem em que a pessoa pensa: o que é,
 * a mídia, o texto, para onde, quando. Em cada rede escolhida a tela diz na
 * hora o que não cabe (as regras são as mesmas do servidor, `lib/redes/regras`),
 * e nada sai sem a confirmação do último passo, que repete por escrito para
 * onde vai e quando.
 *
 * A mídia sobe do navegador direto para o armazenamento, com barra de
 * progresso, e a imagem é convertida para JPEG antes (o Instagram só aceita
 * JPEG). O servidor só recebe o endereço.
 */

export type ContaDoCompositor = { id: string; rede: RedeId; nome: string; ativa: boolean; podePublicar: boolean };

export type AcoesDoCompositor = {
  prepararSubida: (arquivo: { mime: string; tamanho: number }) => Promise<Resposta<{ envio: EnvioPreparado }>>;
  confirmarSubida: (url: string) => Promise<Resposta<{ tamanho: number }>>;
  salvarRascunho: (id: string | null, dados: DadosDoPost) => Promise<Resposta<{ id: string }>>;
  salvarELiberar: (id: string | null, dados: DadosDoPost, quando: string | null) => Promise<{ ok: true; id: string; quando: string; contas: string[] } | { ok: false; erro: string; id?: string }>;
};

type Item = {
  chave: string;
  tipo: "imagem" | "video";
  nome: string;
  /** Endereço para a miniatura: o arquivo local enquanto sobe, o público depois. */
  previa: string;
  estado: "preparando" | "subindo" | "pronto" | "erro";
  progresso: number;
  erro?: string;
  midia?: Midia;
};

/**
 * Os botões de "O que é". Post e carrossel são UM botão: uma foto é post,
 * duas ou mais viram carrossel sozinhas. Quem cuida das redes pensa em "post",
 * e não em escolher o nome técnico antes de pôr as fotos.
 */
const FORMATOS: Formato[] = ["post", "video_curto", "story", "video", "texto"];
const NOME_DO_BOTAO: Partial<Record<Formato, string>> = { post: "Post", video_curto: "Reels e Shorts", story: "Story", video: "Vídeo longo", texto: "Só texto" };
const ativoNoBotao = (botao: Formato, formato: Formato) => botao === formato || (botao === "post" && formato === "carrossel");

/** "Hoje 19h", "Amanhã 13h", "Sáb 19h". */
function chipDeHora(iso: string, agora: number): string {
  const dia = (t: number) => new Date(t).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const t = Date.parse(iso);
  const hora = new Date(t).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).replace(/^0/, "").replace(":00", "h").replace(":", "h");
  if (dia(t) === dia(agora)) return `Hoje ${hora}`;
  if (dia(t) === dia(agora + 86_400_000)) return `Amanhã ${hora}`;
  const semana = new Date(t).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short" }).replace(".", "");
  return `${semana.charAt(0).toUpperCase()}${semana.slice(1)} ${hora}`;
}
const campo = "w-full rounded-[12px] border border-border bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition-colors focus:border-[var(--setor)]";
const rotulo = "text-xs font-semibold text-ink";
const COR = { ruim: "#b01919", fundoRuim: "#fde8e8", bom: "#046c4e", fundoBom: "#e3f4ec", atencao: "#9a4a07", fundoAtencao: "#fcefd9" };

let contador = 0;
const novaChave = () => `m${Date.now().toString(36)}${(contador++).toString(36)}`;

const quando = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).replace(":", "h");

function juntar(nomes: string[]): string {
  return nomes.length <= 1 ? nomes.join("") : `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
}

export function Compositor({
  post, formatoInicial, quandoInicial, horarios = [], contas, limite, acoes,
}: {
  post: PostNaTela | null;
  /** O formato com que o compositor em branco abre ("Novo story" já abre em story). */
  formatoInicial?: Formato;
  /** Dia e hora vindos do calendário ("AAAA-MM-DDTHH:mm", horário de Brasília): abre já agendando. */
  quandoInicial?: string;
  /** Os melhores horários de cada rede, pelo histórico da conta. Vira sugestão em "Quando sai". */
  horarios?: HorariosDaRede[];
  contas: ContaDoCompositor[];
  /** O maior arquivo que o armazenamento aceita hoje, em bytes. */
  limite: number;
  acoes: AcoesDoCompositor;
}) {
  const router = useRouter();
  const [id, setId] = useState<string | null>(post?.id ?? null);
  const [formato, setFormato] = useState<Formato>(post?.formato ?? formatoInicial ?? "post");
  const [legenda, setLegenda] = useState(post?.legenda ?? "");
  const [titulo, setTitulo] = useState(post?.titulo ?? "");
  const [primeiroComentario, setPrimeiroComentario] = useState(String(post?.opcoes?.primeiro_comentario ?? ""));
  const [visibilidade, setVisibilidade] = useState(String(post?.opcoes?.visibilidade ?? "publico"));
  const [itens, setItens] = useState<Item[]>(() =>
    (post?.midias ?? []).map((m) => ({ chave: novaChave(), tipo: m.tipo, nome: m.caminho?.split("/").pop() ?? "", previa: m.url, estado: "pronto" as const, progresso: 1, midia: m })),
  );
  const [escolhidas, setEscolhidas] = useState<string[]>(() => {
    const doPost = (post?.envios ?? []).filter((e) => e.status !== "publicado").map((e) => e.contaId);
    return doPost.length ? doPost : [];
  });
  const [modo, setModo] = useState<"agora" | "agendar">((post?.agendadoPara && post.status === "agendado") || quandoInicial ? "agendar" : "agora");
  const [hora, setHora] = useState(() => {
    if (post?.agendadoPara && Date.parse(post.agendadoPara) > Date.now()) return paraCampoDeHora(post.agendadoPara);
    if (quandoInicial) return quandoInicial;
    // A próxima hora cheia depois de daqui a uma hora: nunca um horário que já passou.
    const d = new Date(Date.now() + 2 * 3_600_000);
    d.setMinutes(0, 0, 0);
    return paraCampoDeHora(d);
  });
  const [confirmando, setConfirmando] = useState(false);
  const [ocupado, setOcupado] = useState<null | "rascunho" | "liberar">(null);
  const [aviso, setAviso] = useState<{ tom: "bom" | "ruim"; texto: string } | null>(null);
  const arquivo = useRef<HTMLInputElement>(null);
  const locais = useRef<string[]>([]);

  // Os endereços locais das miniaturas ocupam memória até serem soltos.
  useEffect(() => () => locais.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const mudarItem = useCallback((chave: string, mudanca: Partial<Item>) => setItens((l) => l.map((i) => (i.chave === chave ? { ...i, ...mudanca } : i))), []);

  const adicionar = useCallback(
    async (arquivos: File[]) => {
      setAviso(null);
      for (const f of arquivos) {
        const ehVideo = f.type === "video/mp4" || f.type === "video/quicktime";
        const ehImagem = f.type.startsWith("image/");
        const chave = novaChave();
        const local = URL.createObjectURL(f);
        locais.current.push(local);
        if (!ehVideo && !ehImagem) {
          setItens((l) => [...l, { chave, tipo: "imagem", nome: f.name, previa: "", estado: "erro", progresso: 0, erro: "Tipo de arquivo não aceito. Use JPEG ou PNG para imagem e MP4 ou MOV para vídeo." }]);
          continue;
        }
        const tipo = ehVideo ? "video" : "imagem";
        setItens((l) => [...l, { chave, tipo, nome: f.name, previa: local, estado: "preparando", progresso: 0 }]);
        // O formato acompanha o que a pessoa pôs: segunda mídia vira carrossel, vídeo vira vídeo curto.
        setFormato((atual) => {
          if (tipo === "video" && (atual === "post" || atual === "texto")) return "video_curto";
          if (tipo === "imagem" && atual === "texto") return "post";
          return atual;
        });

        try {
          let corpo: Blob = f;
          let mime = f.type;
          let largura: number | undefined;
          let altura: number | undefined;
          let duracao: number | undefined;
          if (tipo === "imagem") {
            const pronta = await prepararImagem(f);
            corpo = pronta.blob;
            mime = pronta.mime;
            largura = pronta.largura;
            altura = pronta.altura;
          } else {
            const medido = await medirVideo(f);
            largura = medido?.largura;
            altura = medido?.altura;
            duracao = medido?.duracao;
          }
          if (corpo.size > limite) throw new Error(`O arquivo tem ${tamanhoEmPalavra(corpo.size)} e o armazenamento aceita até ${tamanhoEmPalavra(limite)}.`);

          const preparado = await acoes.prepararSubida({ mime, tamanho: corpo.size });
          if (!preparado.ok) throw new Error(preparado.erro);
          mudarItem(chave, { estado: "subindo" });
          await subir(preparado.envio.urlDeEnvio, preparado.envio.cabecalhos, corpo, (p) => mudarItem(chave, { progresso: p }));
          const conferido = await acoes.confirmarSubida(preparado.envio.urlPublica);
          if (!conferido.ok) throw new Error(conferido.erro);
          mudarItem(chave, {
            estado: "pronto",
            progresso: 1,
            midia: { tipo, url: preparado.envio.urlPublica, caminho: preparado.envio.caminho, mime, largura, altura, duracao, tamanho: conferido.tamanho || corpo.size },
          });
        } catch (e) {
          mudarItem(chave, { estado: "erro", erro: e instanceof Error ? e.message : "O envio falhou." });
        }
      }
    },
    [acoes, limite, mudarItem],
  );

  // Segunda mídia num post de foto: é carrossel. Voltou a uma só: é post de novo.
  useEffect(() => {
    const vivos = itens.filter((i) => i.estado !== "erro").length;
    if (formato === "post" && vivos > 1) setFormato("carrossel");
    if (formato === "carrossel" && vivos === 1) setFormato("post");
  }, [itens, formato]);

  const mover = (chave: string, passo: -1 | 1) =>
    setItens((l) => {
      const i = l.findIndex((x) => x.chave === chave);
      const j = i + passo;
      if (i < 0 || j < 0 || j >= l.length) return l;
      const copia = [...l];
      [copia[i], copia[j]] = [copia[j], copia[i]];
      return copia;
    });
  const tirar = (chave: string) => setItens((l) => l.filter((x) => x.chave !== chave));
  const escreverAlt = (chave: string, alt: string) => setItens((l) => l.map((i) => (i.chave === chave && i.midia ? { ...i, midia: { ...i.midia, alt } } : i)));

  const midias = useMemo(() => itens.filter((i) => i.estado === "pronto" && i.midia).map((i) => i.midia as Midia), [itens]);
  const subindo = itens.some((i) => i.estado === "preparando" || i.estado === "subindo");
  const semMidia = formato === "texto";

  const redesEscolhidas = useMemo(() => contas.filter((c) => escolhidas.includes(c.id)), [contas, escolhidas]);
  const temYouTube = redesEscolhidas.some((c) => c.rede === "youtube");
  const temInstagram = redesEscolhidas.some((c) => c.rede === "instagram");

  const opcoes = useMemo(() => {
    const o: Record<string, unknown> = {};
    if (primeiroComentario.trim() && formato !== "story") o.primeiro_comentario = primeiroComentario.trim();
    if (temYouTube && visibilidade !== "publico") o.visibilidade = visibilidade;
    return o;
  }, [primeiroComentario, formato, temYouTube, visibilidade]);

  const dados: DadosDoPost = useMemo(
    () => ({ titulo: titulo.trim() || null, legenda, formato, midias: semMidia ? [] : midias, opcoes, contas: escolhidas }),
    [titulo, legenda, formato, midias, semMidia, opcoes, escolhidas],
  );

  /** O problema de cada conta com esta peça, pelas mesmas regras do servidor. Nulo: cabe. */
  const problemaDa = useCallback(
    (c: ContaDoCompositor): string | null => {
      if (!c.ativa) return "Precisa ser ligada de novo.";
      if (!c.podePublicar) return "Ligada sem a permissão de publicar.";
      if (!(FORMATOS_PUBLICAVEIS[c.rede] ?? []).includes(formato)) return `${nomeDaRede(c.rede)} não publica ${NOME_DO_FORMATO[formato].toLowerCase()}.`;
      return validarPeca(c.rede, { formato, legenda, titulo: titulo.trim() || null, midias: semMidia ? [] : midias, opcoes });
    },
    [formato, legenda, titulo, midias, semMidia, opcoes],
  );

  const problemas = useMemo(() => {
    const lista: string[] = [];
    if (temTravessao(legenda) || temTravessao(titulo) || temTravessao(primeiroComentario)) lista.push("Troque o travessão por vírgula ou ponto: a casa não usa travessão.");
    if (subindo) lista.push("Espere o envio das mídias terminar.");
    if (escolhidas.length === 0) lista.push("Escolha pelo menos uma rede.");
    for (const c of redesEscolhidas) {
      const p = problemaDa(c);
      if (p) lista.push(`${nomeDaRede(c.rede)}: ${p}`);
    }
    let horaMarcada: string | null = null;
    if (modo === "agendar") {
      horaMarcada = horaDeSaoPaulo(hora);
      if (!horaMarcada) lista.push("Escolha o dia e a hora.");
      else if (Date.parse(horaMarcada) < Date.now() + 60_000) lista.push("A hora marcada já passou.");
    }
    return { lista: [...new Set(lista)], horaMarcada };
  }, [legenda, titulo, primeiroComentario, subindo, escolhidas, redesEscolhidas, problemaDa, modo, hora]);

  // Os melhores horários das redes escolhidas (de todas, se nenhuma foi escolhida ainda). Story fica de fora da conta.
  const motivos = useMemo(() => {
    const redes = new Set(redesEscolhidas.map((c) => c.rede));
    return horarios.filter((h) => h.melhor && (redes.size === 0 || redes.has(h.rede)));
  }, [horarios, redesEscolhidas]);
  const sugestoes = useMemo(() => proximosHorarios(motivos.map((h) => h.melhor!.inicio), Date.now(), 3), [motivos]);

  const limiteDaLegenda = useMemo(() => {
    const limites = redesEscolhidas.filter((c) => c.rede !== "youtube").map((c) => LIMITES[c.rede]?.legenda).filter((n): n is number => typeof n === "number");
    return limites.length ? Math.min(...limites) : null;
  }, [redesEscolhidas]);

  const trocarConta = (contaId: string) => {
    setConfirmando(false);
    setEscolhidas((l) => (l.includes(contaId) ? l.filter((x) => x !== contaId) : [...l, contaId]));
  };

  async function salvarRascunho() {
    setOcupado("rascunho");
    setAviso(null);
    const r = await acoes.salvarRascunho(id, dados);
    setOcupado(null);
    if (!r.ok) return setAviso({ tom: "ruim", texto: r.erro });
    if (!id) {
      setId(r.id);
      // O endereço passa a ser o do rascunho: recarregar a página não perde o trabalho.
      window.history.replaceState(null, "", window.location.pathname.replace(/\/novo$/, `/${r.id}`));
    }
    setAviso({ tom: "bom", texto: "Rascunho salvo." });
  }

  async function liberar() {
    setOcupado("liberar");
    setAviso(null);
    const r = await acoes.salvarELiberar(id, dados, modo === "agendar" ? problemas.horaMarcada : null);
    setOcupado(null);
    if (!r.ok) {
      setConfirmando(false);
      // O rascunho pode ter sido criado antes da recusa: guarda o id, para a próxima tentativa salvar NELE.
      if (r.id && !id) {
        setId(r.id);
        window.history.replaceState(null, "", window.location.pathname.replace(/\/novo$/, `/${r.id}`));
      }
      return setAviso({ tom: "ruim", texto: r.erro });
    }
    router.push(`/admin/redes/publicar?aba=fila&saiu=${modo === "agendar" ? "agendado" : "agora"}`);
  }

  const podeLiberar = problemas.lista.length === 0 && ocupado === null;
  const nomesDasEscolhidas = redesEscolhidas.map((c) => `${nomeDaRede(c.rede)} ${c.nome}`.trim());

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
      <div className="min-w-0 space-y-4">
        {/* 1. O formato */}
        <section className="glass rounded-[18px] p-4 sm:p-5" aria-labelledby="t-formato">
          <h2 id="t-formato" className="text-sm font-semibold text-ink">
            O que é
          </h2>
          <div role="radiogroup" aria-labelledby="t-formato" className="-mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {FORMATOS.map((f) => (
              <button
                key={f}
                type="button"
                role="radio"
                aria-checked={ativoNoBotao(f, formato)}
                onClick={() => {
                  // "Post" com duas fotos ou mais continua carrossel.
                  setFormato(f === "post" && itens.filter((i) => i.estado !== "erro").length > 1 ? "carrossel" : f);
                  setConfirmando(false);
                }}
                className={"painel-toque shrink-0 whitespace-nowrap rounded-full border px-3.5 py-2 text-xs font-semibold " + (ativoNoBotao(f, formato) ? "painel-aba-ativa border-transparent" : "border-ink/12 bg-white text-ink")}
              >
                {NOME_DO_BOTAO[f] ?? NOME_DO_FORMATO[f]}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[0.7rem] leading-relaxed text-muted">
            {formato === "video_curto"
              ? "Vídeo em pé: sai como Reels no Instagram e no Facebook, e como Shorts no YouTube."
              : formato === "story"
                ? "Uma imagem ou um vídeo de até 60 segundos, em pé. Sai sem figurinha de link: a rede não deixa pôr pela API."
                : formato === "carrossel"
                  ? "Carrossel: de 2 a 20 fotos, na ordem da lista (o Instagram aceita vídeo no meio; o Facebook, só foto)."
                  : formato === "texto"
                    ? "Só o texto, sem mídia. Hoje só o Facebook publica assim."
                    : formato === "video"
                      ? "Vídeo deitado ou longo: sai como vídeo no YouTube e no Facebook."
                      : "Uma foto, com legenda. Pondo duas ou mais, vira carrossel sozinho."}
          </p>
        </section>

        {/* 2. A mídia */}
        {semMidia ? null : (
          <section className="glass rounded-[18px] p-4 sm:p-5" aria-labelledby="t-midia">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="t-midia" className="text-sm font-semibold text-ink">
                Mídia
              </h2>
              <p className="text-[0.7rem] text-muted">Até {tamanhoEmPalavra(limite)} por arquivo</p>
            </div>

            {itens.length ? (
              <ul className="mt-3 space-y-2.5">
                {itens.map((i, n) => (
                  <li key={i.chave} className="flex gap-3 rounded-[12px] border border-ink/[0.08] bg-white p-2.5">
                    <span className="relative grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-[9px] bg-ink/[0.06] text-muted">
                      {i.tipo === "video" ? (
                        i.previa ? <video src={i.previa} muted playsInline preload="metadata" className="h-full w-full object-cover" /> : <Film size={20} aria-hidden="true" />
                      ) : i.previa ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={i.previa} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <ImagePlus size={20} aria-hidden="true" />
                      )}
                      {i.tipo === "video" ? (
                        <span className="absolute bottom-0.5 right-0.5 rounded bg-ink/80 px-1 text-[0.6rem] font-semibold text-white">{i.midia?.duracao ? duracaoEmPalavra(i.midia.duracao) : "vídeo"}</span>
                      ) : null}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-xs font-semibold leading-snug text-ink">
                        {n + 1}. {i.tipo === "video" ? "Vídeo" : "Imagem"}
                        {i.midia?.largura && i.midia.altura ? <span className="font-normal text-muted"> · {i.midia.largura} × {i.midia.altura}</span> : null}
                        {i.midia?.tamanho ? <span className="font-normal text-muted"> · {tamanhoEmPalavra(i.midia.tamanho)}</span> : null}
                      </p>
                      {i.estado === "erro" ? (
                        <p role="alert" className="mt-1 break-words text-xs" style={{ color: COR.ruim }}>
                          {i.erro}
                        </p>
                      ) : i.estado !== "pronto" ? (
                        <div className="mt-2">
                          <div className="h-1.5 rounded-full bg-ink/[0.08]">
                            <div className="painel-ponto h-1.5 rounded-full transition-[width]" style={{ width: `${Math.round((i.estado === "preparando" ? 0.03 : i.progresso) * 100)}%` }} />
                          </div>
                          <p role="status" className="mt-1 text-[0.7rem] text-muted">
                            {i.estado === "preparando" ? "Preparando…" : `Enviando, ${Math.round(i.progresso * 100)}%`}
                          </p>
                        </div>
                      ) : i.tipo === "imagem" ? (
                        <label className="mt-1.5 block">
                          <span className="sr-only">Descrição da imagem {n + 1}, para quem não enxerga</span>
                          <input
                            value={i.midia?.alt ?? ""}
                            onChange={(e) => escreverAlt(i.chave, e.target.value)}
                            maxLength={1000}
                            placeholder="Descreva a imagem para quem não enxerga"
                            className="w-full rounded-[8px] border border-border bg-white px-2.5 py-1.5 text-xs text-ink outline-none focus:border-[var(--setor)]"
                          />
                        </label>
                      ) : (
                        <p className="mt-1 text-[0.7rem] text-muted">Pronto para sair.</p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col justify-between">
                      <button type="button" onClick={() => tirar(i.chave)} aria-label={`Tirar a mídia ${n + 1}`} className="painel-toque grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-ink/[0.06] hover:text-ink">
                        <X size={15} aria-hidden="true" />
                      </button>
                      {itens.length > 1 ? (
                        <div className="flex">
                          <button type="button" onClick={() => mover(i.chave, -1)} disabled={n === 0} aria-label={`Subir a mídia ${n + 1}`} className="grid h-7 w-7 place-items-center rounded-full text-muted hover:text-ink disabled:opacity-30">
                            <ArrowUp size={14} aria-hidden="true" />
                          </button>
                          <button type="button" onClick={() => mover(i.chave, 1)} disabled={n === itens.length - 1} aria-label={`Descer a mídia ${n + 1}`} className="grid h-7 w-7 place-items-center rounded-full text-muted hover:text-ink disabled:opacity-30">
                            <ArrowDown size={14} aria-hidden="true" />
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}

            <input
              ref={arquivo}
              type="file"
              accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
              multiple={formato === "carrossel" || formato === "post"}
              className="sr-only"
              aria-label="Escolher arquivos de mídia"
              onChange={(e) => {
                const lista = [...(e.target.files ?? [])];
                e.target.value = "";
                if (lista.length) void adicionar(lista);
              }}
            />
            <button
              type="button"
              onClick={() => arquivo.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const lista = [...e.dataTransfer.files];
                if (lista.length) void adicionar(lista);
              }}
              className="painel-toque mt-3 flex w-full items-center justify-center gap-2 rounded-[12px] border border-dashed border-ink/25 bg-white/60 px-4 py-4 text-sm font-semibold text-ink hover:border-[var(--setor)]"
            >
              <ImagePlus size={17} aria-hidden="true" />
              {itens.length ? "Adicionar outra" : "Escolher foto ou vídeo"}
            </button>
            <p className="mt-2 text-[0.7rem] leading-relaxed text-muted">
              Imagem em JPEG ou PNG (vira JPEG, que é o que o Instagram aceita). Vídeo em MP4 ou MOV. A capa do vídeo curto é uma imagem posta junto do vídeo.
            </p>
          </section>
        )}

        {/* 3. O texto */}
        <section className="glass rounded-[18px] p-4 sm:p-5" aria-labelledby="t-texto">
          <h2 id="t-texto" className="text-sm font-semibold text-ink">
            Texto
          </h2>
          {temYouTube || formato === "video" ? (
            <label className="mt-3 block">
              <span className={rotulo}>Título do vídeo</span>
              <input value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={100} placeholder="Aparece como nome do vídeo no YouTube" className={`${campo} mt-1`} />
              <span className="mt-1 block text-right text-[0.68rem] text-muted">{titulo.length} de 100</span>
            </label>
          ) : null}
          <label className="mt-3 block">
            <span className={rotulo}>{formato === "story" ? "Anotação (o story sai sem legenda)" : temYouTube && !temInstagram ? "Descrição" : "Legenda"}</span>
            <textarea value={legenda} onChange={(e) => setLegenda(e.target.value)} rows={6} maxLength={12000} placeholder={formato === "story" ? "Só para achar o story na lista do painel" : "O que vai escrito junto do post"} className={`${campo} mt-1 resize-y leading-relaxed`} />
            <span className="mt-1 flex justify-between gap-3 text-[0.68rem] text-muted">
              <span>{(legenda.match(/#[\p{L}\p{N}_]+/gu) ?? []).length} hashtags</span>
              <span style={limiteDaLegenda && legenda.length > limiteDaLegenda ? { color: COR.ruim, fontWeight: 700 } : undefined}>
                {legenda.length.toLocaleString("pt-BR")}
                {limiteDaLegenda ? ` de ${limiteDaLegenda.toLocaleString("pt-BR")}` : ""}
              </span>
            </span>
          </label>
          {temInstagram && formato !== "story" ? (
            <label className="mt-3 block">
              <span className={rotulo}>Primeiro comentário no Instagram (opcional)</span>
              <textarea value={primeiroComentario} onChange={(e) => setPrimeiroComentario(e.target.value)} rows={2} maxLength={2200} placeholder="Sai do próprio perfil, logo depois do post. Bom lugar para as hashtags." className={`${campo} mt-1 resize-y`} />
            </label>
          ) : null}
          {temYouTube ? (
            <label className="mt-3 block">
              <span className={rotulo}>Quem vê o vídeo no YouTube</span>
              <select value={visibilidade} onChange={(e) => setVisibilidade(e.target.value)} className={`${campo} mt-1`}>
                <option value="publico">Público</option>
                <option value="nao_listado">Não listado (só quem tem o link)</option>
                <option value="privado">Privado</option>
              </select>
            </label>
          ) : null}
        </section>

        {/* 4. Para onde */}
        <section className="glass rounded-[18px] p-4 sm:p-5" aria-labelledby="t-onde">
          <h2 id="t-onde" className="text-sm font-semibold text-ink">
            Para onde vai
          </h2>
          {contas.length === 0 ? (
            <p className="mt-2 text-sm leading-relaxed text-muted">Nenhuma rede ligada ainda. Dá para montar e salvar o rascunho; para publicar, uma rede precisa ser ligada em Integrações.</p>
          ) : (
            <ul className="mt-2 divide-y divide-ink/[0.07]">
              {contas.map((c) => {
                const marcada = escolhidas.includes(c.id);
                const problema = problemaDa(c);
                const travada = !c.ativa || !c.podePublicar || !(FORMATOS_PUBLICAVEIS[c.rede] ?? []).includes(formato);
                return (
                  <li key={c.id} className="py-2.5">
                    <label className={"flex items-center gap-3 " + (travada ? "opacity-60" : "cursor-pointer")}>
                      <input type="checkbox" checked={marcada && !travada} disabled={travada} onChange={() => trocarConta(c.id)} className="h-5 w-5 shrink-0 accent-[var(--setor)]" />
                      <SeloDaRede id={c.rede} tamanho={30} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-ink">{nomeDaRede(c.rede)}</span>
                        <span className="block truncate text-xs text-muted">
                          {c.nome} · {nomeDoFormatoNaRede(formato, c.rede)}
                        </span>
                      </span>
                    </label>
                    {(marcada || travada) && problema ? (
                      <p className="mt-1.5 flex items-start gap-1.5 pl-8 text-xs leading-snug" style={{ color: travada ? "var(--color-muted)" : COR.ruim }}>
                        <CircleAlert size={13} className="mt-0.5 shrink-0" aria-hidden="true" /> {problema}
                      </p>
                    ) : marcada ? (
                      <p className="mt-1.5 flex items-center gap-1.5 pl-8 text-xs" style={{ color: COR.bom }}>
                        <CircleCheck size={13} aria-hidden="true" /> Cabe nas regras da rede.
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* 5. Quando */}
        <section className="glass rounded-[18px] p-4 sm:p-5" aria-labelledby="t-quando">
          <h2 id="t-quando" className="text-sm font-semibold text-ink">
            Quando sai
          </h2>
          <div role="radiogroup" aria-labelledby="t-quando" className="mt-3 grid grid-cols-2 gap-2">
            {(["agora", "agendar"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={modo === m}
                onClick={() => {
                  setModo(m);
                  setConfirmando(false);
                }}
                className={"painel-toque flex items-center justify-center gap-2 rounded-[12px] border px-3 py-3 text-sm font-semibold " + (modo === m ? "painel-aba-ativa border-transparent" : "border-ink/12 bg-white text-ink")}
              >
                {m === "agora" ? <Send size={15} aria-hidden="true" /> : <CalendarClock size={15} aria-hidden="true" />}
                {m === "agora" ? "Agora" : "Agendar"}
              </button>
            ))}
          </div>
          {modo === "agendar" && sugestoes.length ? (
            <div className="mt-3">
              <p className={rotulo}>Sugestões pelo histórico</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {sugestoes.map((iso) => {
                  const campo = paraCampoDeHora(iso);
                  return (
                    <button
                      key={iso}
                      type="button"
                      onClick={() => {
                        setHora(campo);
                        setConfirmando(false);
                      }}
                      aria-pressed={hora === campo}
                      className={"painel-toque rounded-full border px-3 py-1.5 text-xs font-semibold " + (hora === campo ? "painel-aba-ativa border-transparent" : "border-ink/12 bg-white text-ink")}
                    >
                      {chipDeHora(iso, Date.now())}
                    </button>
                  );
                })}
              </div>
              {motivos.length ? (
                <p className="mt-1.5 text-[0.68rem] leading-relaxed text-muted">
                  Melhor faixa pelo histórico:{" "}
                  {motivos.map((h, i) => (
                    <span key={h.rede}>
                      {i ? ", " : ""}
                      {nomeDaRede(h.rede)} {faixaEmPalavra(h.melhor!.inicio)} ({h.melhor!.mediana.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}× o normal, {h.melhor!.posts} posts)
                    </span>
                  ))}
                  . É o que rendeu mais até aqui, não uma regra.
                </p>
              ) : null}
            </div>
          ) : null}
          {modo === "agendar" ? (
            <label className="mt-3 block">
              <span className={rotulo}>Dia e hora, no horário de Brasília</span>
              <input type="datetime-local" value={hora} min={paraCampoDeHora(new Date())} onChange={(e) => { setHora(e.target.value); setConfirmando(false); }} className={`${campo} mt-1`} />
              <span className="mt-1 block text-[0.7rem] leading-relaxed text-muted">O painel publica sozinho na hora marcada, com até um minuto de diferença. Dá para mudar ou cancelar até lá.</span>
            </label>
          ) : null}
        </section>

        {/* O que falta e os botões */}
        <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 lg:bottom-4">
          <div className="rounded-[18px] border border-ink/10 bg-white p-3 shadow-lg sm:p-4">
            {aviso ? (
              <p role={aviso.tom === "ruim" ? "alert" : "status"} className="mb-3 break-words rounded-[10px] px-3 py-2 text-xs font-semibold leading-relaxed" style={aviso.tom === "ruim" ? { color: COR.ruim, background: COR.fundoRuim } : { color: COR.bom, background: COR.fundoBom }}>
                {aviso.texto}
              </p>
            ) : null}

            {confirmando ? (
              <div>
                <p className="text-sm font-semibold text-ink">{modo === "agora" ? "Publicar agora?" : "Agendar?"}</p>
                <p className="mt-1 break-words text-xs leading-relaxed text-ink">
                  Vai sair {modo === "agora" ? "agora" : problemas.horaMarcada ? `${quando(problemas.horaMarcada)}, horário de Brasília` : ""}, em <strong>{juntar(nomesDasEscolhidas)}</strong>. É público e sai no nome da JK.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={liberar} disabled={!podeLiberar} className="painel-toque inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                    {ocupado === "liberar" ? <LoaderCircle size={15} className="animate-spin" aria-hidden="true" /> : modo === "agora" ? <Send size={15} aria-hidden="true" /> : <CalendarClock size={15} aria-hidden="true" />}
                    {ocupado === "liberar" ? "Mandando…" : modo === "agora" ? "Sim, publicar agora" : "Sim, agendar"}
                  </button>
                  <button type="button" onClick={() => setConfirmando(false)} disabled={ocupado !== null} className="rounded-full px-4 py-2.5 text-sm font-semibold text-muted hover:text-ink">
                    Voltar
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* No celular a barra fica por cima do formulário: mostra UM problema por vez, e os botões lado a lado. */}
                {problemas.lista.length ? (
                  <ul className="mb-2.5 space-y-1" aria-label="O que falta para publicar">
                    {problemas.lista.slice(0, 4).map((p, i) => (
                      <li key={p} className={"items-start gap-1.5 text-xs leading-snug " + (i === 0 ? "flex" : "hidden sm:flex")} style={{ color: COR.atencao }}>
                        <CircleAlert size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
                        <span className="min-w-0 break-words">
                          {p}
                          {i === 0 && problemas.lista.length > 1 ? <span className="sm:hidden"> (e mais {problemas.lista.length - 1})</span> : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setConfirmando(true)} disabled={!podeLiberar} className="painel-toque inline-flex min-w-0 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40 sm:flex-none sm:px-5">
                    {modo === "agora" ? <Send size={15} aria-hidden="true" /> : <CalendarClock size={15} aria-hidden="true" />}
                    {modo === "agora" ? "Publicar agora" : "Agendar"}
                  </button>
                  <button type="button" onClick={salvarRascunho} disabled={ocupado !== null || subindo} className="painel-toque inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-ink/15 bg-white px-3.5 py-2.5 text-sm font-semibold text-ink disabled:opacity-50 sm:px-4">
                    {ocupado === "rascunho" ? <LoaderCircle size={15} className="animate-spin" aria-hidden="true" /> : null}
                    {ocupado === "rascunho" ? "Salvando…" : "Salvar rascunho"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* A prévia, só no computador: no celular a pessoa já está vendo a mídia e o texto, um embaixo do outro. */}
      <aside className="sticky top-[calc(var(--painel-topo,4rem)+1rem)] hidden lg:block" aria-label="Prévia">
        <p className="eyebrow">Prévia</p>
        <div className="mt-2 overflow-hidden rounded-[18px] border border-ink/10 bg-white">
          <div className="grid aspect-[4/5] place-items-center bg-ink/[0.05] text-muted">
            {itens[0]?.previa && !semMidia ? (
              itens[0].tipo === "video" ? (
                <video src={itens[0].previa} muted playsInline controls preload="metadata" className="h-full w-full object-contain" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={itens[0].previa} alt="" className="h-full w-full object-contain" />
              )
            ) : (
              <span className="px-6 text-center text-xs">{semMidia ? "Post só de texto" : "A primeira mídia aparece aqui"}</span>
            )}
          </div>
          <div className="p-3.5">
            {titulo.trim() && (temYouTube || formato === "video") ? <p className="mb-1 break-words text-sm font-semibold text-ink">{titulo}</p> : null}
            <p className="line-clamp-6 whitespace-pre-line break-words text-xs leading-relaxed text-ink">{legenda || <span className="text-muted">A legenda aparece aqui.</span>}</p>
            {itens.length > 1 && !semMidia ? <p className="mt-2 text-[0.7rem] text-muted">{itens.length} mídias</p> : null}
          </div>
        </div>
        <p className="mt-2 text-[0.68rem] leading-relaxed text-muted">É um rascunho da peça, não a tela da rede: cada rede corta e enquadra do seu jeito.</p>
        {itens.length > 0 && !semMidia ? (
          <button type="button" onClick={() => setItens([])} className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-ink">
            <Trash2 size={13} aria-hidden="true" /> Tirar todas as mídias
          </button>
        ) : null}
      </aside>
    </div>
  );
}
