"use client";

import { useMemo, useState, useTransition } from "react";
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
import { Check, Eye, EyeOff, GripVertical, Lock, RotateCcw } from "lucide-react";
import { BLOCOS, type Campo } from "@/lib/blocos/campos";
import type { Bloco, Layout } from "@/lib/blocos/tipos";
import { restaurarHome, salvarHome } from "./actions";

const campoBase =
  "w-full rounded-[10px] border border-border bg-white/80 px-3 py-2 text-sm text-ink outline-none transition-colors hover:border-brand/40 focus:border-brand";

function valorTexto(props: Record<string, unknown>, nome: string): string {
  const v = props[nome];
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.filter((i) => typeof i === "string").join("\n");
  if (typeof v === "number") return String(v);
  return "";
}

function CampoDoBloco({
  campo,
  valor,
  aoMudar,
}: {
  campo: Campo;
  valor: string;
  aoMudar: (v: unknown) => void;
}) {
  const excedeu = campo.maximo !== undefined && valor.length > campo.maximo;
  const temTravessao = /[—–]/.test(valor);

  return (
    <div>
      <label className="block text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted">
        {campo.rotulo}
      </label>
      {campo.ajuda ? <p className="mt-0.5 text-[0.68rem] text-muted">{campo.ajuda}</p> : null}

      <div className="mt-1.5">
        {campo.tipo === "textoLongo" || campo.tipo === "listaDeTexto" ? (
          <textarea
            value={valor}
            rows={campo.tipo === "listaDeTexto" ? 4 : 3}
            onChange={(e) =>
              aoMudar(
                campo.tipo === "listaDeTexto"
                  ? e.target.value.split("\n").map((l) => l.trim()).filter(Boolean)
                  : e.target.value,
              )
            }
            className={`${campoBase} resize-y leading-relaxed ${
              excedeu || temTravessao ? "border-wine focus:border-wine" : ""
            }`}
          />
        ) : (
          <input
            value={valor}
            type={campo.tipo === "numero" ? "number" : "text"}
            min={campo.tipo === "numero" ? 1 : undefined}
            max={campo.tipo === "numero" ? 12 : undefined}
            onChange={(e) =>
              aoMudar(campo.tipo === "numero" ? Number(e.target.value) || 1 : e.target.value)
            }
            className={`${campoBase} ${excedeu || temTravessao ? "border-wine focus:border-wine" : ""}`}
          />
        )}
      </div>

      <div className="mt-1 flex flex-wrap gap-x-3 text-[0.66rem]">
        {campo.maximo !== undefined ? (
          <span className={excedeu ? "font-semibold text-wine" : "text-muted"}>
            {valor.length}/{campo.maximo}
            {excedeu ? " (vai cortar na tela)" : ""}
          </span>
        ) : null}
        {temTravessao ? (
          <span className="font-semibold text-wine">
            Travessão não entra. Use vírgula, dois pontos ou parênteses.
          </span>
        ) : null}
      </div>
    </div>
  );
}

function BlocoArrastavel({
  bloco,
  aoMudarProp,
  aoAlternarVisivel,
}: {
  bloco: Bloco;
  aoMudarProp: (nome: string, valor: unknown) => void;
  aoAlternarVisivel: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: bloco.id,
  });
  const def = BLOCOS[bloco.tipo];

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`glass rounded-[18px] p-5 ${isDragging ? "z-10 opacity-90 shadow-[var(--jk-sombra-modal)]" : ""}`}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Mover ${def.nome}. Use as setas depois de ativar.`}
          className="mt-0.5 cursor-grab rounded-[8px] p-1 text-muted transition-colors hover:bg-brand/10 hover:text-brand-nav active:cursor-grabbing"
        >
          <GripVertical size={16} />
        </button>

        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-medium text-ink">
            {def.nome}
            {bloco.travado ? (
              <span
                title="Bloco essencial: não pode ser ocultado"
                className="inline-flex items-center gap-1 rounded-full bg-ink/8 px-2 py-0.5 text-[0.62rem] font-semibold text-muted"
              >
                <Lock size={9} /> essencial
              </span>
            ) : null}
            {!bloco.visivel ? (
              <span className="rounded-full bg-wine/12 px-2 py-0.5 text-[0.62rem] font-semibold text-wine">
                oculto
              </span>
            ) : null}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted">{def.descricao}</p>
        </div>

        <button
          type="button"
          onClick={aoAlternarVisivel}
          disabled={bloco.travado}
          title={bloco.travado ? "Bloco essencial da home" : bloco.visivel ? "Ocultar" : "Mostrar"}
          className="shrink-0 rounded-full p-1.5 text-muted transition-colors hover:bg-brand/10 hover:text-brand-nav disabled:cursor-not-allowed disabled:opacity-40"
        >
          {bloco.visivel ? <Eye size={15} /> : <EyeOff size={15} />}
          <span className="sr-only">{bloco.visivel ? "Ocultar" : "Mostrar"} {def.nome}</span>
        </button>
      </div>

      {def.campos.length > 0 ? (
        <div className="mt-4 grid gap-4 border-t border-border/70 pt-4 sm:grid-cols-2">
          {def.campos.map((c) => (
            <div key={c.nome} className={c.tipo === "listaDeTexto" ? "sm:col-span-2" : ""}>
              <CampoDoBloco
                campo={c}
                valor={valorTexto(bloco.props, c.nome)}
                aoMudar={(v) => aoMudarProp(c.nome, v)}
              />
            </div>
          ))}
        </div>
      ) : null}
    </li>
  );
}

export function EditorDaHome({ inicial }: { inicial: Layout }) {
  const [layout, setLayout] = useState<Layout>(inicial);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [enviando, iniciar] = useTransition();

  // KeyboardSensor junto do ponteiro: reordenar só com mouse deixaria a tela
  // inutilizável por teclado, e acessibilidade é requisito do projeto.
  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const mudou = useMemo(
    () => JSON.stringify(layout) !== JSON.stringify(inicial),
    [layout, inicial],
  );

  function aoSoltar(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setLayout((l) => {
      const de = l.blocos.findIndex((b) => b.id === active.id);
      const para = l.blocos.findIndex((b) => b.id === over.id);
      if (de < 0 || para < 0) return l;
      return { ...l, blocos: arrayMove(l.blocos, de, para) };
    });
    setSalvo(false);
  }

  function mudarProp(id: string, nome: string, valor: unknown) {
    setLayout((l) => ({
      ...l,
      blocos: l.blocos.map((b) =>
        b.id === id ? { ...b, props: { ...b.props, [nome]: valor } } : b,
      ),
    }));
    setSalvo(false);
    setErro(null);
  }

  function alternarVisivel(id: string) {
    setLayout((l) => ({
      ...l,
      blocos: l.blocos.map((b) => (b.id === id ? { ...b, visivel: !b.visivel } : b)),
    }));
    setSalvo(false);
  }

  function salvar() {
    setErro(null);
    iniciar(async () => {
      const r = await salvarHome(layout);
      if (r.ok) setSalvo(true);
      else setErro(r.erro);
    });
  }

  function restaurar() {
    setErro(null);
    iniciar(async () => {
      const r = await restaurarHome();
      if (r.ok) window.location.reload();
      else setErro(r.erro);
    });
  }

  return (
    <div>
      <div className="glass sticky top-4 z-20 mb-6 flex flex-wrap items-center gap-3 rounded-[18px] p-4">
        <button
          type="button"
          onClick={salvar}
          disabled={enviando || !mudou}
          className="rounded-full bg-brand px-5 py-2 text-xs font-semibold text-ink transition-colors hover:bg-brand-light disabled:cursor-not-allowed disabled:opacity-50"
        >
          {enviando ? "Salvando…" : "Salvar a home"}
        </button>

        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full border border-ink/15 px-4 py-2 text-xs font-semibold text-ink transition-colors hover:border-brand/50 hover:text-brand-nav"
        >
          Ver a home
        </a>

        <button
          type="button"
          onClick={restaurar}
          disabled={enviando}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted transition-colors hover:text-wine disabled:opacity-50"
        >
          <RotateCcw size={12} /> Voltar ao padrão
        </button>

        {salvo && !mudou ? (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-brand-strong">
            <Check size={13} /> Salvo. A home já está no ar com as mudanças.
          </span>
        ) : mudou ? (
          <span className="text-xs text-muted">Alterações não salvas.</span>
        ) : null}

        {erro ? (
          <p className="w-full rounded-[10px] border border-wine/40 bg-wine/10 px-3 py-2 text-xs leading-relaxed text-wine">
            {erro}
          </p>
        ) : null}
      </div>

      <DndContext sensors={sensores} collisionDetection={closestCenter} onDragEnd={aoSoltar}>
        <SortableContext
          items={layout.blocos.map((b) => b.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="space-y-4">
            {layout.blocos.map((b) => (
              <BlocoArrastavel
                key={b.id}
                bloco={b}
                aoMudarProp={(nome, valor) => mudarProp(b.id, nome, valor)}
                aoAlternarVisivel={() => alternarVisivel(b.id)}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  );
}
