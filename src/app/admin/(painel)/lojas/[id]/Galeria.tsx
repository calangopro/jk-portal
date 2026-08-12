"use client";

import { useState, useTransition } from "react";
import { ImageIcon, Trash2, ArrowUp, ArrowDown, Plus } from "lucide-react";
// O seletor da biblioteca de mídia nasceu no editor de conteúdo e serve igual
// aqui. Duplicar a tela faria as duas divergirem na primeira melhoria.
import { SeletorImagem } from "../../conteudos/[id]/SeletorImagem";
import type { ImagemDaBiblioteca } from "../../conteudos/[id]/actions";
import {
  adicionarFotoDaLoja,
  removerFotoDaLoja,
  reordenarFotosDaLoja,
  type FotoDaLoja,
} from "../actions";

/**
 * Galeria da loja no admin.
 *
 * A ordem importa: a primeira foto vira a capa do card no índice de lojas e
 * abre o visor na página da unidade.
 */
export function Galeria({
  locationId,
  iniciais,
}: {
  locationId: string;
  iniciais: FotoDaLoja[];
}) {
  const [fotos, setFotos] = useState(iniciais);
  const [seletor, setSeletor] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, iniciar] = useTransition();

  const adicionar = async (img: ImagemDaBiblioteca) => {
    setErro(null);
    const r = await adicionarFotoDaLoja(locationId, img.id);
    if (!r.ok) {
      setErro(r.erro ?? "Não foi possível adicionar a foto.");
      return;
    }
    setFotos((f) => [
      ...f,
      {
        vinculoId: `novo-${img.id}`,
        mediaId: img.id,
        url: img.url,
        alt: img.alt,
        credit: img.credit,
        width: img.width,
        height: img.height,
        role: "gallery",
        position: f.length,
      },
    ]);
  };

  const remover = (vinculoId: string) => {
    setFotos((f) => f.filter((x) => x.vinculoId !== vinculoId));
    iniciar(async () => {
      await removerFotoDaLoja(vinculoId);
    });
  };

  const mover = (indice: number, direcao: -1 | 1) => {
    const destino = indice + direcao;
    if (destino < 0 || destino >= fotos.length) return;

    const nova = [...fotos];
    [nova[indice], nova[destino]] = [nova[destino], nova[indice]];
    setFotos(nova);

    iniciar(async () => {
      await reordenarFotosDaLoja(nova.map((f) => f.vinculoId));
    });
  };

  return (
    <div className="glass rounded-[20px] p-6 sm:p-7">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] border border-brand/30 bg-brand/10 text-brand-nav">
            <ImageIcon size={14} />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink">Fotos da loja</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted">
              A primeira foto vira a capa no índice de lojas. Toda foto exige
              texto alternativo, que se escreve em Mídia.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setSeletor(true)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-brand/40 bg-brand/8 px-3.5 py-2 text-xs font-semibold text-brand-nav transition-colors hover:bg-brand/16"
        >
          <Plus size={13} /> Adicionar
        </button>
      </div>

      {erro ? (
        <p className="mb-4 rounded-[10px] border border-wine/30 bg-wine/8 px-4 py-2.5 text-xs text-wine">
          {erro}
        </p>
      ) : null}

      {fotos.length === 0 ? (
        <button
          type="button"
          onClick={() => setSeletor(true)}
          className="flex w-full items-center justify-center gap-2 rounded-[12px] border border-dashed border-brand/40 bg-brand/5 px-4 py-8 text-sm font-semibold text-brand-nav transition-colors hover:border-brand hover:bg-brand/12"
        >
          <ImageIcon size={16} /> Nenhuma foto ainda. Escolher da biblioteca
        </button>
      ) : (
        <ul className={`grid gap-3 sm:grid-cols-2 ${salvando ? "opacity-70" : ""}`}>
          {fotos.map((f, i) => (
            <li
              key={f.vinculoId}
              className="flex gap-3 rounded-[12px] border border-border bg-white/60 p-3"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={f.url}
                alt={f.alt ?? ""}
                className="h-20 w-28 shrink-0 rounded-[8px] object-cover"
              />
              <div className="flex min-w-0 flex-1 flex-col">
                <p className="line-clamp-2 text-xs text-ink">{f.alt}</p>
                {i === 0 ? (
                  <span className="mt-1 w-fit rounded-full bg-brand/15 px-2 py-0.5 text-[0.65rem] font-semibold text-brand-strong">
                    capa
                  </span>
                ) : null}
                <div className="mt-auto flex gap-1 pt-2">
                  <button
                    type="button"
                    onClick={() => mover(i, -1)}
                    disabled={i === 0}
                    aria-label="Mover para cima"
                    className="rounded-[7px] p-1.5 text-muted transition-colors hover:bg-ink/8 hover:text-ink disabled:opacity-30"
                  >
                    <ArrowUp size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => mover(i, 1)}
                    disabled={i === fotos.length - 1}
                    aria-label="Mover para baixo"
                    className="rounded-[7px] p-1.5 text-muted transition-colors hover:bg-ink/8 hover:text-ink disabled:opacity-30"
                  >
                    <ArrowDown size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => remover(f.vinculoId)}
                    aria-label="Tirar da galeria"
                    className="ml-auto rounded-[7px] p-1.5 text-muted transition-colors hover:bg-wine/10 hover:text-wine"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {seletor ? (
        <SeletorImagem
          aoEscolher={adicionar}
          aoEnviar={() => {
            setSeletor(false);
            setErro(
              "Para a galeria da loja, envie a foto primeiro em Mídia, com texto alternativo e crédito. Depois escolha ela aqui.",
            );
          }}
          aoFechar={() => setSeletor(false)}
        />
      ) : null}
    </div>
  );
}
