"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { MAXIMO_DE_IMAGENS, conferirImagem } from "@/lib/time/chat";

/**
 * As imagens que vão junto de uma mensagem: a pessoa COLA o print da área de
 * transferência ou escolhe o arquivo. É como o vendedor já pergunta (67 das 72
 * imagens do grupo do time eram print de conversa), então colar precisa ser o
 * caminho mais curto.
 *
 * Print de conversa tem dado de cliente: a imagem sobe para um bucket privado
 * e só volta à tela por link assinado (ver `api.ts` e `actions.ts`).
 */

export type ImagemEscolhida = { chave: string; arquivo: File; previa: string };

/** As imagens escolhidas para a próxima mensagem: juntar (do arquivo ou da colagem), tirar, limpar e soltar. */
export function useImagens() {
  const [lista, setLista] = useState<ImagemEscolhida[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const atual = useRef<ImagemEscolhida[]>([]);
  atual.current = lista;

  // Ao sair da tela, solta as prévias da memória do navegador.
  useEffect(() => () => atual.current.forEach((i) => URL.revokeObjectURL(i.previa)), []);

  const juntar = useCallback((arquivos: File[]) => {
    setErro(null);
    setLista((antes) => {
      const novas = [...antes];
      for (const arquivo of arquivos) {
        const problema = conferirImagem({ tipo: arquivo.type, tamanho: arquivo.size });
        if (problema) {
          setErro(problema);
          continue;
        }
        if (novas.length >= MAXIMO_DE_IMAGENS) {
          setErro(`Dá para mandar até ${MAXIMO_DE_IMAGENS} imagens por vez.`);
          break;
        }
        novas.push({ chave: crypto.randomUUID(), arquivo, previa: URL.createObjectURL(arquivo) });
      }
      return novas;
    });
  }, []);

  const tirar = useCallback((chave: string) => {
    setErro(null);
    setLista((antes) => {
      antes.filter((i) => i.chave === chave).forEach((i) => URL.revokeObjectURL(i.previa));
      return antes.filter((i) => i.chave !== chave);
    });
  }, []);

  /**
   * Entrega as imagens a quem vai enviar e esvazia o campo, SEM soltar as
   * prévias: a mensagem que está indo ainda mostra a imagem. Quem recebeu
   * solta quando o envio terminar.
   */
  const soltar = useCallback((): ImagemEscolhida[] => {
    const entregues = atual.current;
    atual.current = [];
    setErro(null);
    setLista([]);
    return entregues;
  }, []);

  /** Para pôr no campo de texto: se a colagem trouxe imagem, ela entra na lista e não vira texto. */
  const aoColar = useCallback(
    (e: React.ClipboardEvent) => {
      const imagens = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
      if (imagens.length === 0) return;
      e.preventDefault();
      juntar(imagens);
    },
    [juntar],
  );

  return { lista, erro, juntar, tirar, soltar, aoColar };
}

/** As miniaturas do que foi escolhido, cada uma com o botão de tirar. */
export function Miniaturas({ imagens, ocupado }: { imagens: Pick<ReturnType<typeof useImagens>, "lista" | "tirar">; ocupado?: boolean }) {
  if (imagens.lista.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-2.5 px-1 pb-2 pt-2.5">
      {imagens.lista.map((i, n) => (
        <li key={i.chave} className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={i.previa} alt={`Imagem ${n + 1} escolhida`} className="h-16 w-16 rounded-[10px] border border-ink/15 bg-white object-cover" />
          <button
            type="button"
            disabled={ocupado}
            onClick={() => imagens.tirar(i.chave)}
            aria-label={`Tirar a imagem ${n + 1}`}
            className="painel-toque absolute -right-2 -top-2 grid h-7 w-7 place-items-center rounded-full bg-ink text-white shadow"
          >
            <X size={13} aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  );
}
