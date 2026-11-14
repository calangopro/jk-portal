"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { MAXIMO_DE_IMAGENS, TIPOS_DE_IMAGEM, caminhoDaImagem, conferirImagem } from "@/lib/time/chamados";
import { botaoClaro } from "../biblioteca/pecas";

/**
 * O print do chamado: a pessoa COLA a imagem da área de transferência ou
 * escolhe o arquivo. É como o vendedor já pergunta hoje (67 das 72 imagens do
 * grupo do time eram print de conversa), então colar precisa ser o caminho
 * mais curto.
 *
 * A imagem sobe direto do navegador para o bucket privado `chamados`, na pasta
 * de quem envia, e só depois o chamado é gravado com o caminho. Não passa pela
 * ação de servidor: print de celular passa fácil do limite de corpo dela.
 *
 * Print de conversa tem dado de cliente. Por isso o nome do arquivo NÃO entra
 * no caminho (print costuma se chamar pelo nome do cliente), e a imagem só é
 * mostrada de volta por link assinado.
 */

const BUCKET = "chamados";

export type ImagemEscolhida = { chave: string; arquivo: File; previa: string };
export type ImagemEnviada = { caminho: string; nome: string };

export type Enviar = (quem: string, lista: ImagemEscolhida[]) => Promise<{ ok: true; imagens: ImagemEnviada[] } | { ok: false; erro: string }>;

/** Sobe as imagens escolhidas e devolve o caminho de cada uma. Para na primeira que falhar. */
export const enviarImagens: Enviar = async (quem, lista) => {
  const imagens: ImagemEnviada[] = [];
  const armazenamento = createClient().storage.from(BUCKET);
  for (const i of lista) {
    const caminho = caminhoDaImagem(quem, crypto.randomUUID(), i.arquivo.type);
    const { error } = await armazenamento.upload(caminho, i.arquivo, { upsert: false, contentType: i.arquivo.type });
    if (error) return { ok: false, erro: "Não deu para enviar a imagem. Confira a conexão e tente de novo." };
    imagens.push({ caminho, nome: i.arquivo.name.slice(0, 200) });
  }
  return { ok: true, imagens };
};

/** As imagens escolhidas para um envio: juntar (do arquivo ou da colagem), tirar e limpar. */
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

  const limpar = useCallback(() => {
    setErro(null);
    setLista((antes) => {
      antes.forEach((i) => URL.revokeObjectURL(i.previa));
      return [];
    });
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

  return { lista, erro, juntar, tirar, limpar, aoColar };
}

/** As miniaturas do que foi escolhido, o botão de escolher arquivo e a dica de colar. */
export function CampoDeImagens({ imagens, ocupado }: { imagens: ReturnType<typeof useImagens>; ocupado?: boolean }) {
  const entrada = useRef<HTMLInputElement>(null);
  return (
    <div>
      {imagens.lista.length > 0 ? (
        <ul className="mb-2 flex flex-wrap gap-2">
          {imagens.lista.map((i, n) => (
            <li key={i.chave} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={i.previa} alt={`Imagem ${n + 1} escolhida`} className="h-20 w-20 rounded-[10px] border border-ink/15 bg-white object-cover" />
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
      ) : null}
      <input
        ref={entrada}
        type="file"
        accept={TIPOS_DE_IMAGEM.join(",")}
        multiple
        className="sr-only"
        aria-label="Escolher imagem"
        onChange={(e) => {
          const arquivos = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (arquivos.length > 0) imagens.juntar(arquivos);
        }}
      />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <button type="button" disabled={ocupado} onClick={() => entrada.current?.click()} className={botaoClaro}>
          <ImagePlus size={14} aria-hidden="true" /> Escolher imagem
        </button>
        <p className="text-[0.7rem] leading-snug text-muted">Ou cole o print direto no texto. Só imagem, até 5 MB.</p>
      </div>
      {imagens.erro ? (
        <p role="alert" className="mt-1.5 text-xs font-semibold text-[#b01919]">
          {imagens.erro}
        </p>
      ) : null}
    </div>
  );
}
