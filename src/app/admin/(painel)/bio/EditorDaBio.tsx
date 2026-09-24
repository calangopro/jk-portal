"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, ChevronDown, Copy, Eye, EyeOff, GripVertical, Plus, RotateCcw, Trash2 } from "lucide-react";
import { campanhaDoDia, versaoDaCampanha, versaoNormal } from "@/lib/bio/agenda";
import {
  NOMES_DOS_BLOCOS,
  NOMES_DOS_TEMAS,
  TEMAS_DA_BIO,
  blocoNovo,
  type Bio,
  type BlocoDaBio,
  type CampanhaDaBio,
  type FonteDaVitrine,
} from "@/lib/bio/tipos";
import type { Location } from "@/lib/content/types";
import type { CategoriaDaLoja } from "@/lib/tray/publico";
import { restaurarBio, salvarBio } from "./actions";
import { Caixa, Data, Selecao, Texto } from "./campos";
import { CamposDoBloco } from "./CamposDoBloco";
import { LinksParaDivulgar } from "./LinksParaDivulgar";
import { Previa } from "./Previa";

const NOME_DA_FONTE: Record<FonteDaVitrine["tipo"], string> = {
  "mais-vendidos": "mais vendidos",
  categoria: "categoria",
  manual: "escolhidos à mão",
  destaques: "destaques da Tray",
  lancamentos: "lançamentos",
};

function dataCurta(dia: string) {
  const [, m, d] = dia.split("-");
  return `${d}/${m}`;
}

function somarDias(dia: string, n: number): string {
  const t = Date.parse(`${dia}T12:00:00-03:00`) + n * 86_400_000;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(t));
}

/** Código da campanha nos eventos, a partir do nome: "Dia das Mães" vira "dia-das-maes". */
function codigoDoNome(nome: string, ocupados: string[]): string {
  const base =
    nome
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32) || "campanha";
  let codigo = base;
  for (let n = 2; ocupados.includes(codigo); n++) codigo = `${base}-${n}`;
  return codigo;
}

/** O que identifica o bloco na lista fechada, sem precisar abrir. */
function resumo(b: BlocoDaBio): string {
  switch (b.tipo) {
    case "campanha":
      return b.titulo;
    case "captura":
      return b.rotulo;
    case "vitrine":
      return `${b.titulo} (${NOME_DA_FONTE[b.fonte.tipo]}${b.fonte.tipo === "categoria" ? ` /${b.fonte.slug}` : ""})`;
    case "links":
      return b.itens.length === 1 ? "1 link" : `${b.itens.length} links`;
    case "lojas":
      return b.titulo;
  }
}

type Situacao = { texto: string; noAr: boolean };

function situacaoDaCampanha(bio: Bio, c: CampanhaDaBio, hoje: string): Situacao {
  if (!c.ativa) return { texto: "Desligada", noAr: false };
  if (hoje < c.inicio) return { texto: `Começa em ${dataCurta(c.inicio)}`, noAr: false };
  if (hoje > c.fim) return { texto: "Encerrada", noAr: false };
  if (campanhaDoDia(bio, hoje)?.id === c.id) return { texto: "No ar agora", noAr: true };
  return { texto: "Outra campanha vale hoje", noAr: false };
}

function situacaoDaNormal(bio: Bio, hoje: string): Situacao {
  const c = campanhaDoDia(bio, hoje);
  return c ? { texto: `Hoje vale ${c.nome}`, noAr: false } : { texto: "No ar agora", noAr: true };
}

function CartaoDoBloco({
  bloco,
  aberto,
  categorias,
  aoAbrir,
  aoMudar,
  aoRemover,
}: {
  bloco: BlocoDaBio;
  aberto: boolean;
  categorias: CategoriaDaLoja[];
  aoAbrir: () => void;
  aoMudar: (novo: BlocoDaBio) => void;
  aoRemover: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: bloco.id });
  // Links ficam sempre abertos: é o que mais se mexe, e esconder atrás de um
  // clique foi parte do que deixou a primeira versão com cara de bagunça.
  const sempreAberto = bloco.tipo === "links";
  const mostrar = aberto || sempreAberto;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`glass rounded-[18px] ${isDragging ? "z-10 opacity-90 shadow-[var(--jk-sombra-modal)]" : ""}`}
    >
      <div className="flex items-center gap-2 p-4">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Mover ${NOMES_DOS_BLOCOS[bloco.tipo]}. Use as setas depois de ativar.`}
          className="cursor-grab rounded-[8px] p-1 text-muted transition-colors hover:bg-brand/10 hover:text-brand-nav active:cursor-grabbing"
        >
          <GripVertical size={16} />
        </button>

        {sempreAberto ? (
          <div className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-ink">{NOMES_DOS_BLOCOS[bloco.tipo]}</span>
              {!bloco.visivel ? (
                <span className="rounded-full bg-wine/12 px-2 py-0.5 text-[0.62rem] font-semibold text-wine">oculto</span>
              ) : null}
            </span>
            <span className="mt-0.5 block truncate text-xs text-muted">{resumo(bloco)}</span>
          </div>
        ) : (
          <button type="button" onClick={aoAbrir} aria-expanded={aberto} className="min-w-0 flex-1 text-left">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-ink">{NOMES_DOS_BLOCOS[bloco.tipo]}</span>
              {!bloco.visivel ? (
                <span className="rounded-full bg-wine/12 px-2 py-0.5 text-[0.62rem] font-semibold text-wine">oculto</span>
              ) : null}
            </span>
            <span className="mt-0.5 block truncate text-xs text-muted">{resumo(bloco)}</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => aoMudar({ ...bloco, visivel: !bloco.visivel })}
          title={bloco.visivel ? "Ocultar" : "Mostrar"}
          className="shrink-0 rounded-full p-1.5 text-muted transition-colors hover:bg-brand/10 hover:text-brand-nav"
        >
          {bloco.visivel ? <Eye size={15} /> : <EyeOff size={15} />}
          <span className="sr-only">
            {bloco.visivel ? "Ocultar" : "Mostrar"} {NOMES_DOS_BLOCOS[bloco.tipo]}
          </span>
        </button>
        {sempreAberto ? null : (
          <button
            type="button"
            onClick={aoAbrir}
            aria-label={aberto ? "Fechar" : "Editar"}
            className="shrink-0 rounded-full p-1.5 text-muted hover:bg-brand/10 hover:text-brand-nav"
          >
            <ChevronDown size={16} className={`transition-transform ${aberto ? "rotate-180" : ""}`} />
          </button>
        )}
      </div>

      {mostrar ? (
        <div className="space-y-4 border-t border-border/70 p-5">
          <CamposDoBloco bloco={bloco} aoMudar={aoMudar} categorias={categorias} />
          <div className="border-t border-border/70 pt-4">
            <button
              type="button"
              onClick={aoRemover}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted transition-colors hover:text-wine"
            >
              <Trash2 size={13} /> Remover este bloco
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

const TIPOS_PARA_ADICIONAR: BlocoDaBio["tipo"][] = ["links", "vitrine", "campanha", "captura", "lojas"];

export function EditorDaBio({
  inicial,
  lojas,
  categorias,
  hoje,
}: {
  inicial: Bio;
  lojas: Location[];
  categorias: CategoriaDaLoja[];
  hoje: string;
}) {
  const [bio, setBio] = useState<Bio>(inicial);
  const [publicada, setPublicada] = useState<Bio>(inicial);
  // Abre na versão que está no ar hoje: é a que a pessoa mais provavelmente
  // veio mexer.
  const [aba, setAba] = useState<string>(() => campanhaDoDia(inicial, hoje)?.id ?? "normal");
  const [aberto, setAberto] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [enviando, iniciar] = useTransition();
  const abas = useRef<Record<string, HTMLButtonElement | null>>({});

  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const mudou = useMemo(() => JSON.stringify(bio) !== JSON.stringify(publicada), [bio, publicada]);
  const campanha = aba === "normal" ? null : (bio.campanhas.find((c) => c.id === aba) ?? null);
  const blocos = campanha ? campanha.blocos : bio.normal.blocos;
  const ordemDasAbas = ["normal", ...bio.campanhas.map((c) => c.id)];

  function mudar(fn: (b: Bio) => Bio) {
    setBio(fn);
    setSalvo(false);
    setErro(null);
  }

  function mudarBlocos(fn: (lista: BlocoDaBio[]) => BlocoDaBio[]) {
    mudar((b) =>
      aba === "normal"
        ? { ...b, normal: { blocos: fn(b.normal.blocos) } }
        : { ...b, campanhas: b.campanhas.map((c) => (c.id === aba ? { ...c, blocos: fn(c.blocos) } : c)) },
    );
  }

  function mudarCampanha(parcial: Partial<CampanhaDaBio>) {
    if (!campanha) return;
    // Enquanto a campanha nunca foi publicada, o código acompanha o nome. Depois
    // de publicado ele fica fixo, porque já está nos relatórios do GA4.
    const jaPublicada = publicada.campanhas.some((c) => c.id === campanha.id);
    let id = campanha.id;
    if (parcial.nome !== undefined && !jaPublicada) {
      id = codigoDoNome(parcial.nome, bio.campanhas.filter((c) => c.id !== campanha.id).map((c) => c.id));
    }
    mudar((b) => ({
      ...b,
      campanhas: b.campanhas.map((c) => (c.id === campanha.id ? { ...c, ...parcial, id } : c)),
    }));
    if (id !== campanha.id) setAba(id);
  }

  function novaCampanha() {
    const nome = "Nova campanha";
    const id = codigoDoNome(nome, bio.campanhas.map((c) => c.id));
    // Nasce com a cópia da Normal, desligada: a pessoa monta com calma e liga
    // quando estiver pronta, sem risco de entrar no ar pela metade.
    const nova: CampanhaDaBio = {
      id,
      nome,
      tema: "padrao",
      inicio: somarDias(hoje, 7),
      fim: somarDias(hoje, 14),
      ativa: false,
      blocos: structuredClone(bio.normal.blocos),
    };
    mudar((b) => ({ ...b, campanhas: [...b.campanhas, nova] }));
    setAba(id);
    setAberto(null);
  }

  function duplicarCampanha() {
    if (!campanha) return;
    const nome = `Cópia de ${campanha.nome}`.slice(0, 40);
    const id = codigoDoNome(nome, bio.campanhas.map((c) => c.id));
    const copia: CampanhaDaBio = { ...structuredClone(campanha), id, nome, ativa: false };
    mudar((b) => ({ ...b, campanhas: [...b.campanhas, copia] }));
    setAba(id);
    setAberto(null);
  }

  function excluirCampanha() {
    if (!campanha) return;
    if (!window.confirm(`Excluir a campanha ${campanha.nome}? Dá para desfazer saindo sem publicar.`)) return;
    mudar((b) => ({ ...b, campanhas: b.campanhas.filter((c) => c.id !== campanha.id) }));
    setAba("normal");
  }

  const publicar = useCallback(() => {
    setErro(null);
    iniciar(async () => {
      const r = await salvarBio(bio);
      if (r.ok) {
        setPublicada(bio);
        setSalvo(true);
      } else setErro(r.erro);
    });
  }, [bio]);

  // Cmd/Ctrl + S publica, como pede o REGRAS.md para todo editor do painel.
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (mudou && !enviando) publicar();
      }
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [mudou, enviando, publicar]);

  // Sair com mudança não publicada pede confirmação do navegador.
  useEffect(() => {
    if (!mudou) return;
    const aoSair = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", aoSair);
    return () => window.removeEventListener("beforeunload", aoSair);
  }, [mudou]);

  function aoSoltar(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    mudarBlocos((lista) => {
      const de = lista.findIndex((x) => x.id === active.id);
      const para = lista.findIndex((x) => x.id === over.id);
      if (de < 0 || para < 0) return lista;
      return arrayMove(lista, de, para);
    });
  }

  function adicionar(tipo: BlocoDaBio["tipo"]) {
    const id = `${tipo}-${Date.now().toString(36)}`;
    mudarBlocos((lista) => [...lista, blocoNovo(tipo, id)]);
    setAberto(id);
  }

  function restaurar() {
    if (!window.confirm("Voltar a bio para a versão de fábrica? Todas as abas publicadas aqui serão substituídas.")) return;
    setErro(null);
    iniciar(async () => {
      const r = await restaurarBio();
      if (r.ok) window.location.reload();
      else setErro(r.erro);
    });
  }

  function trocarAba(id: string) {
    setAba(id);
    setAberto(null);
  }

  // Setas trocam de aba, como em qualquer lista de abas acessível.
  function aoTeclarNaAba(e: React.KeyboardEvent) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const i = ordemDasAbas.indexOf(aba);
    const j = (i + (e.key === "ArrowRight" ? 1 : -1) + ordemDasAbas.length) % ordemDasAbas.length;
    trocarAba(ordemDasAbas[j]);
    abas.current[ordemDasAbas[j]]?.focus();
  }

  const situacao = campanha ? situacaoDaCampanha(bio, campanha, hoje) : situacaoDaNormal(bio, hoje);
  const versao = campanha ? versaoDaCampanha(campanha) : versaoNormal(bio);

  // Campanha ligada que divide dias com outra: nos dias em comum vale a mais curta.
  const sobreposicoes = campanha?.ativa
    ? bio.campanhas.filter(
        (c) => c.id !== campanha.id && c.ativa && c.inicio <= campanha.fim && campanha.inicio <= c.fim,
      )
    : [];

  const botaoDaAba = (id: string, nome: string, detalhe: string, s: Situacao) => {
    const ativa = aba === id;
    return (
      <button
        key={id}
        ref={(el) => {
          abas.current[id] = el;
        }}
        type="button"
        role="tab"
        id={`aba-${id}`}
        aria-selected={ativa}
        aria-controls="painel-da-aba"
        tabIndex={ativa ? 0 : -1}
        onClick={() => trocarAba(id)}
        onKeyDown={aoTeclarNaAba}
        className={`min-w-[8.5rem] rounded-[14px] border px-4 py-2.5 text-left transition-colors ${
          ativa ? "border-ink bg-ink text-white" : "border-border bg-white/70 text-ink hover:border-brand/50"
        }`}
      >
        <span className="flex items-center gap-2 text-sm font-medium">
          {s.noAr ? <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-hidden /> : null}
          {nome}
        </span>
        <span className={`mt-0.5 block text-[0.68rem] ${ativa ? "text-white/75" : "text-muted"}`}>{detalhe}</span>
        <span className="sr-only">. {s.texto}</span>
      </button>
    );
  };

  return (
    <div data-painel-largo className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_410px]">
      <div className="min-w-0">
        <div className="glass sticky top-20 z-20 mb-6 flex flex-wrap items-center gap-3 rounded-[18px] p-4">
          <button
            type="button"
            onClick={publicar}
            disabled={enviando || !mudou}
            className="rounded-full bg-brand px-5 py-2 text-xs font-semibold text-ink transition-colors hover:bg-brand-light disabled:cursor-not-allowed disabled:opacity-50"
          >
            {enviando ? "Publicando..." : "Publicar"}
          </button>
          <a
            href="https://www.jkaliancas.com.br/bio"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-ink/15 px-4 py-2 text-xs font-semibold text-ink transition-colors hover:border-brand/50 hover:text-brand-nav"
          >
            Ver a bio no ar
          </a>
          <button
            type="button"
            onClick={restaurar}
            disabled={enviando}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted transition-colors hover:text-wine disabled:opacity-50"
          >
            <RotateCcw size={12} /> Voltar à de fábrica
          </button>

          {salvo && !mudou ? (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-brand-strong">
              <Check size={13} /> Publicado. A bio já está no ar com as mudanças.
            </span>
          ) : mudou ? (
            <span className="text-xs text-muted">Mudanças ainda não publicadas.</span>
          ) : null}

          {erro ? (
            <p role="alert" className="w-full rounded-[10px] border border-wine/40 bg-wine/10 px-3 py-2 text-xs leading-relaxed text-wine">
              {erro}
            </p>
          ) : null}
        </div>

        <div className="mb-6 max-w-xl">
          <Texto
            rotulo="Frase embaixo do logo (vale em todas as abas)"
            valor={bio.cabecalho.frase}
            maximo={60}
            aoMudar={(frase) => mudar((b) => ({ ...b, cabecalho: { ...b.cabecalho, frase } }))}
          />
        </div>

        <div role="tablist" aria-label="Versões da bio" className="mb-4 flex flex-wrap gap-2">
          {botaoDaAba("normal", "Normal", "Todo dia fora das campanhas", situacaoDaNormal(bio, hoje))}
          {bio.campanhas.map((c) =>
            botaoDaAba(
              c.id,
              c.nome,
              `${dataCurta(c.inicio)} a ${dataCurta(c.fim)}${c.ativa ? "" : ", desligada"}`,
              situacaoDaCampanha(bio, c, hoje),
            ),
          )}
          <button
            type="button"
            onClick={novaCampanha}
            className="inline-flex min-w-[8.5rem] items-center justify-center gap-1.5 rounded-[14px] border border-dashed border-ink/25 px-4 py-2.5 text-sm font-medium text-muted transition-colors hover:border-brand/60 hover:text-brand-nav"
          >
            <Plus size={14} /> Nova campanha
          </button>
        </div>

        <div role="tabpanel" id="painel-da-aba" aria-labelledby={`aba-${aba}`}>
          {campanha ? (
            <section className="glass mb-5 rounded-[18px] p-5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-medium text-ink">Campanha {campanha.nome}</h2>
                <span
                  className={`rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${
                    situacao.noAr ? "bg-emerald-500/15 text-emerald-800" : "bg-ink/8 text-muted"
                  }`}
                >
                  {situacao.texto}
                </span>
                <span className="flex-1" />
                <button
                  type="button"
                  onClick={duplicarCampanha}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-brand-nav"
                >
                  <Copy size={12} /> Duplicar
                </button>
                <button
                  type="button"
                  onClick={excluirCampanha}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-wine"
                >
                  <Trash2 size={12} /> Excluir
                </button>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Texto rotulo="Nome" valor={campanha.nome} maximo={40} aoMudar={(nome) => mudarCampanha({ nome })} />
                <Selecao
                  rotulo="Visual"
                  valor={campanha.tema}
                  opcoes={TEMAS_DA_BIO.map((t) => [t, NOMES_DOS_TEMAS[t]] as const)}
                  aoMudar={(tema) => mudarCampanha({ tema })}
                />
                <Data
                  rotulo="Começa em"
                  valor={campanha.inicio}
                  limpavel={false}
                  aoMudar={(v) => v && mudarCampanha({ inicio: v })}
                />
                <Data
                  rotulo="Termina em"
                  valor={campanha.fim}
                  limpavel={false}
                  aoMudar={(v) => v && mudarCampanha({ fim: v })}
                />
              </div>
              <div className="mt-4">
                <Caixa
                  rotulo="Campanha ligada"
                  ajuda="Desligada, ela não entra no ar nem na data. Serve para montar com calma e ligar quando estiver pronta."
                  marcado={campanha.ativa}
                  aoMudar={(ativa) => mudarCampanha({ ativa })}
                />
              </div>
              {sobreposicoes.length > 0 ? (
                <p className="mt-3 rounded-[10px] bg-brand/10 px-3 py-2 text-[0.72rem] leading-snug text-brand-strong">
                  Divide dias com {sobreposicoes.map((c) => c.nome).join(", ")}. Nos dias em comum vale a campanha mais
                  curta.
                </p>
              ) : null}
            </section>
          ) : (
            <p className="mb-5 text-sm leading-relaxed text-muted">
              A bio de todo dia. Ela vale sempre que nenhuma campanha está no ar, e volta sozinha quando a campanha
              termina.
            </p>
          )}

          <DndContext sensors={sensores} collisionDetection={closestCenter} onDragEnd={aoSoltar}>
            <SortableContext items={blocos.map((b) => b.id)} strategy={verticalListSortingStrategy}>
              <ul className="space-y-3">
                {blocos.map((b) => (
                  <CartaoDoBloco
                    key={`${aba}-${b.id}`}
                    bloco={b}
                    aberto={aberto === b.id}
                    categorias={categorias}
                    aoAbrir={() => setAberto((a) => (a === b.id ? null : b.id))}
                    aoMudar={(novo) => mudarBlocos((lista) => lista.map((y) => (y.id === b.id ? novo : y)))}
                    aoRemover={() => {
                      if (!window.confirm(`Remover o bloco "${resumo(b)}"? Dá para desfazer saindo sem publicar.`)) return;
                      mudarBlocos((lista) => lista.filter((y) => y.id !== b.id));
                    }}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-muted">Adicionar nesta aba:</span>
            {TIPOS_PARA_ADICIONAR.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => adicionar(t)}
                className="inline-flex items-center gap-1 rounded-full border border-ink/15 px-3 py-1.5 text-xs font-semibold text-ink hover:border-brand/50 hover:text-brand-nav"
              >
                <Plus size={12} /> {NOMES_DOS_BLOCOS[t]}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-10">
          <LinksParaDivulgar />
        </div>
      </div>

      <aside className="min-w-0 xl:sticky xl:top-20 xl:self-start">
        <Previa
          cabecalho={bio.cabecalho}
          versao={versao}
          lojas={lojas}
          legenda={`${campanha ? campanha.nome : "Normal"}: ${situacao.texto.toLowerCase()}`}
        />
      </aside>
    </div>
  );
}
