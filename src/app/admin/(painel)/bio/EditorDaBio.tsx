"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
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
import { Check, ChevronDown, Eye, EyeOff, GripVertical, Plus, RotateCcw, Trash2 } from "lucide-react";
import { valeNoDia } from "@/lib/bio/agenda";
import {
  NOMES_DOS_BLOCOS,
  blocoNovo,
  type Bio,
  type BlocoDaBio,
  type FonteDaVitrine,
} from "@/lib/bio/tipos";
import type { Location } from "@/lib/content/types";
import type { CategoriaDaLoja } from "@/lib/tray/publico";
import { restaurarBio, salvarBio } from "./actions";
import { Data, Selecao, Texto } from "./campos";
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

/** "de 01/10 a 31/10", "a partir de 01/11", "até 30/11" ou nada. */
function agendaLegivel(inicio: string | null, fim: string | null): string | null {
  if (inicio && fim) return `de ${dataCurta(inicio)} a ${dataCurta(fim)}`;
  if (inicio) return `a partir de ${dataCurta(inicio)}`;
  if (fim) return `até ${dataCurta(fim)}`;
  return null;
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

function CartaoDoBloco({
  bloco,
  aberto,
  hoje,
  categorias,
  aoAbrir,
  aoMudar,
  aoRemover,
}: {
  bloco: BlocoDaBio;
  aberto: boolean;
  hoje: string;
  categorias: CategoriaDaLoja[];
  aoAbrir: () => void;
  aoMudar: (novo: BlocoDaBio) => void;
  aoRemover: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: bloco.id });
  const agenda = agendaLegivel(bloco.inicio, bloco.fim);
  const noAr = bloco.visivel && valeNoDia(bloco, hoje);

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

        <button type="button" onClick={aoAbrir} aria-expanded={aberto} className="min-w-0 flex-1 text-left">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-ink">{NOMES_DOS_BLOCOS[bloco.tipo]}</span>
            {agenda ? (
              <span className="rounded-full bg-brand/12 px-2 py-0.5 text-[0.62rem] font-semibold text-brand-strong">
                {agenda}
              </span>
            ) : null}
            {!bloco.visivel ? (
              <span className="rounded-full bg-wine/12 px-2 py-0.5 text-[0.62rem] font-semibold text-wine">oculto</span>
            ) : !noAr ? (
              <span className="rounded-full bg-ink/8 px-2 py-0.5 text-[0.62rem] font-semibold text-muted">
                fora do ar hoje
              </span>
            ) : null}
          </span>
          <span className="mt-0.5 block truncate text-xs text-muted">{resumo(bloco)}</span>
        </button>

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
        <button
          type="button"
          onClick={aoAbrir}
          aria-label={aberto ? "Fechar" : "Editar"}
          className="shrink-0 rounded-full p-1.5 text-muted hover:bg-brand/10 hover:text-brand-nav"
        >
          <ChevronDown size={16} className={`transition-transform ${aberto ? "rotate-180" : ""}`} />
        </button>
      </div>

      {aberto ? (
        <div className="space-y-4 border-t border-border/70 p-5">
          <CamposDoBloco bloco={bloco} aoMudar={aoMudar} categorias={categorias} />

          <fieldset className="space-y-3 border-t border-border/70 pt-4">
            <legend className="float-left mb-1 w-full text-xs font-semibold text-ink">Quando aparece</legend>
            <p className="clear-both text-[0.7rem] leading-snug text-muted">
              Vazio é sempre. Com data, o bloco entra e sai sozinho, à meia-noite de São Paulo.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Data rotulo="A partir de" valor={bloco.inicio} aoMudar={(inicio) => aoMudar({ ...bloco, inicio })} />
              <Data rotulo="Até" valor={bloco.fim} aoMudar={(fim) => aoMudar({ ...bloco, fim })} />
            </div>
          </fieldset>

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

const TIPOS_PARA_ADICIONAR: BlocoDaBio["tipo"][] = ["vitrine", "links", "campanha", "captura", "lojas"];

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
  const [aberto, setAberto] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [enviando, iniciar] = useTransition();

  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const mudou = useMemo(() => JSON.stringify(bio) !== JSON.stringify(publicada), [bio, publicada]);

  function mudar(fn: (b: Bio) => Bio) {
    setBio(fn);
    setSalvo(false);
    setErro(null);
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
    mudar((b) => {
      const de = b.blocos.findIndex((x) => x.id === active.id);
      const para = b.blocos.findIndex((x) => x.id === over.id);
      if (de < 0 || para < 0) return b;
      return { ...b, blocos: arrayMove(b.blocos, de, para) };
    });
  }

  function adicionar(tipo: BlocoDaBio["tipo"]) {
    const id = `${tipo}-${Date.now().toString(36)}`;
    mudar((b) => ({ ...b, blocos: [...b.blocos, blocoNovo(tipo, id)] }));
    setAberto(id);
  }

  function restaurar() {
    if (!window.confirm("Voltar a bio para a versão de fábrica? O que foi publicado aqui será substituído.")) return;
    setErro(null);
    iniciar(async () => {
      const r = await restaurarBio();
      if (r.ok) window.location.reload();
      else setErro(r.erro);
    });
  }

  const campanha = (tema: "esquenta" | "black") => bio.campanhas.find((c) => c.tema === tema);
  function mudarCampanha(tema: "esquenta" | "black", parcial: { inicio?: string | null; fim?: string | null }) {
    mudar((b) => ({
      ...b,
      campanhas: b.campanhas.map((c) =>
        c.tema === tema
          ? { ...c, inicio: parcial.inicio ?? c.inicio, fim: parcial.fim ?? c.fim }
          : c,
      ),
    }));
  }

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

        <section className="glass mb-6 rounded-[18px] p-5">
          <h2 className="font-medium text-ink">Aparência</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Selecao
              rotulo="Tema"
              valor={bio.tema}
              opcoes={[
                ["automatico", "Automático, pela data da campanha"],
                ["padrao", "Sempre o padrão (claro)"],
                ["esquenta", "Sempre o Esquenta"],
                ["black", "Sempre o Black"],
              ]}
              aoMudar={(tema) => mudar((b) => ({ ...b, tema }))}
            />
            <Texto
              rotulo="Frase embaixo do logo"
              valor={bio.cabecalho.frase}
              maximo={60}
              aoMudar={(frase) => mudar((b) => ({ ...b, cabecalho: { ...b.cabecalho, frase } }))}
            />
          </div>
          {bio.tema === "automatico" ? (
            <div className="mt-4 grid gap-4 border-t border-border/70 pt-4 sm:grid-cols-2">
              {(["esquenta", "black"] as const).map((tema) => {
                const c = campanha(tema);
                if (!c) return null;
                return (
                  <div key={tema} className="grid grid-cols-2 gap-2">
                    <Data
                      rotulo={`${tema === "esquenta" ? "Esquenta" : "Black"}: começa`}
                      valor={c.inicio}
                      limpavel={false}
                      aoMudar={(v) => v && mudarCampanha(tema, { inicio: v })}
                    />
                    <Data
                      rotulo="Termina"
                      valor={c.fim}
                      limpavel={false}
                      aoMudar={(v) => v && mudarCampanha(tema, { fim: v })}
                    />
                  </div>
                );
              })}
              <p className="text-[0.7rem] leading-snug text-muted sm:col-span-2">
                Fora dessas datas vale o tema padrão. As cores de cada tema seguem o manual da campanha da loja.
              </p>
            </div>
          ) : null}
        </section>

        <h2 className="mb-3 font-medium text-ink">Blocos, na ordem da página</h2>
        <DndContext sensors={sensores} collisionDetection={closestCenter} onDragEnd={aoSoltar}>
          <SortableContext items={bio.blocos.map((b) => b.id)} strategy={verticalListSortingStrategy}>
            <ul className="space-y-3">
              {bio.blocos.map((b) => (
                <CartaoDoBloco
                  key={b.id}
                  bloco={b}
                  aberto={aberto === b.id}
                  hoje={hoje}
                  categorias={categorias}
                  aoAbrir={() => setAberto((a) => (a === b.id ? null : b.id))}
                  aoMudar={(novo) => mudar((x) => ({ ...x, blocos: x.blocos.map((y) => (y.id === b.id ? novo : y)) }))}
                  aoRemover={() => {
                    if (!window.confirm(`Remover o bloco "${resumo(b)}"? Dá para desfazer saindo sem publicar.`)) return;
                    mudar((x) => ({ ...x, blocos: x.blocos.filter((y) => y.id !== b.id) }));
                  }}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-muted">Adicionar:</span>
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

        <div className="mt-8">
          <LinksParaDivulgar />
        </div>
      </div>

      <aside className="min-w-0 xl:sticky xl:top-20 xl:self-start">
        <Previa bio={bio} lojas={lojas} hoje={hoje} />
      </aside>
    </div>
  );
}
