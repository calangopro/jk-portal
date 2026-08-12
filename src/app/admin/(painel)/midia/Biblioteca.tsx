"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { UploadCloud, Copy, Check, ImageOff, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { paraWebp } from "@/lib/midia/webp";
import {
  salvarMidia,
  desativarMidia,
  reativarMidia,
  sugerirAlt,
  type MidiaState,
} from "./actions";

export type Midia = {
  id: string;
  url: string | null;
  storage_path: string;
  alt: string | null;
  title: string | null;
  caption: string | null;
  credit: string | null;
  width: number | null;
  height: number | null;
  bytes: number | null;
  mime: string | null;
  deactivated_at: string | null;
  usos: number;
};

const campo =
  "w-full rounded-[10px] border border-border bg-white/70 px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-muted/50 focus:border-brand";

const rotulo = "block text-[0.68rem] font-semibold uppercase tracking-wider text-muted";

function tamanho(bytes: number | null) {
  if (!bytes) return "";
  return bytes > 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} KB`;
}

/** Deixa o nome do arquivo legível para busca por imagens. */
function nomeLegivel(nome: string) {
  const semExt = nome.replace(/\.[^.]+$/, "");
  return semExt
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "imagem";
}

function BotaoSalvar() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-brand px-4 py-2 text-xs font-semibold text-ink transition-colors hover:bg-brand-light disabled:opacity-60"
    >
      {pending ? "Salvando…" : "Salvar"}
    </button>
  );
}

function Ficha({ m }: { m: Midia }) {
  const [estado, acao] = useActionState<MidiaState, FormData>(salvarMidia, {});
  const [copiado, setCopiado] = useState(false);
  // alt e legenda viram estado porque a IA precisa conseguir preencher os dois.
  const [alt, setAlt] = useState(m.alt ?? "");
  const [legenda, setLegenda] = useState(m.caption ?? "");
  const [erroIa, setErroIa] = useState<string | null>(null);
  const [descrevendo, descrever] = useTransition();

  const copiar = async () => {
    if (!m.url) return;
    await navigator.clipboard.writeText(m.url);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1600);
  };

  const inativa = !!m.deactivated_at;

  return (
    <li className={`glass overflow-hidden rounded-[18px] ${inativa ? "opacity-60" : ""}`}>
      <div
        className="relative aspect-[4/3] w-full overflow-hidden"
        style={{
          backgroundColor: "#f4f1ea",
          backgroundImage:
            "linear-gradient(45deg, rgb(0 0 0 / 0.04) 25%, transparent 25%, transparent 75%, rgb(0 0 0 / 0.04) 75%), linear-gradient(45deg, rgb(0 0 0 / 0.04) 25%, transparent 25%, transparent 75%, rgb(0 0 0 / 0.04) 75%)",
          backgroundSize: "16px 16px",
          backgroundPosition: "0 0, 8px 8px",
        }}
      >
        {m.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={m.url}
            alt={m.alt ?? ""}
            loading="lazy"
            /* contain para ver a imagem inteira: numa biblioteca, enquadrar
               importa menos que reconhecer o arquivo */
            className="h-full w-full object-contain p-3"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted">
            <ImageOff size={20} />
          </div>
        )}
        {!m.alt ? (
          <span className="absolute left-3 top-3 rounded-full bg-wine px-2.5 py-1 text-[0.68rem] font-semibold text-white">
            Falta o alt
          </span>
        ) : null}
        {inativa ? (
          <span className="absolute right-3 top-3 rounded-full bg-ink/80 px-2.5 py-1 text-[0.68rem] font-semibold text-white">
            Desativada
          </span>
        ) : null}
      </div>

      <form action={acao} className="space-y-3 p-4">
        <input type="hidden" name="id" value={m.id} />

        <label className="block">
          <span className={rotulo}>Texto alternativo (obrigatório)</span>
          <input
            name="alt"
            value={alt}
            onChange={(e) => setAlt(e.target.value)}
            required
            placeholder="Descreva a imagem para quem não enxerga"
            className={`${campo} mt-1`}
          />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={descrevendo}
            onClick={() => {
              if (!m.url) {
                setErroIa("Esta imagem não tem endereço público, então a IA não consegue abrir.");
                return;
              }
              const url = m.url;
              setErroIa(null);
              descrever(async () => {
                const r = await sugerirAlt(url);
                if (!r.ok) {
                  setErroIa(r.erro ?? "Não deu certo.");
                  return;
                }
                if (r.alt) setAlt(r.alt);
                if (r.legenda) setLegenda(r.legenda);
              });
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-brand/40 px-3 py-1.5 text-[0.7rem] font-semibold text-brand-strong transition-colors hover:bg-brand/10 disabled:opacity-60"
          >
            <Sparkles size={12} aria-hidden />
            {descrevendo ? "Olhando a imagem…" : "Descrever com IA"}
          </button>
          <span className="text-[0.68rem] text-muted">
            A IA lê a foto e escreve. Confira antes de salvar.
          </span>
        </div>
        {erroIa ? (
          <p role="alert" className="text-[0.7rem] font-medium text-wine">
            {erroIa}
          </p>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={rotulo}>Legenda</span>
            <input
              name="caption"
              value={legenda}
              onChange={(e) => setLegenda(e.target.value)}
              className={`${campo} mt-1`}
            />
          </label>
          <label className="block">
            <span className={rotulo}>Crédito ou fonte</span>
            <input name="credit" defaultValue={m.credit ?? ""} className={`${campo} mt-1`} />
          </label>
        </div>

        <label className="block">
          <span className={rotulo}>Título interno</span>
          <input name="title" defaultValue={m.title ?? ""} className={`${campo} mt-1`} />
        </label>

        <p className="text-[0.68rem] text-muted">
          {m.width && m.height ? `${m.width} x ${m.height} px` : "dimensão não registrada"}
          {m.bytes ? ` · ${tamanho(m.bytes)}` : ""}
          {m.mime ? ` · ${m.mime.replace("image/", "")}` : ""}
          {m.usos > 0 ? ` · usada em ${m.usos} conteúdo(s)` : " · ainda não usada"}
        </p>

        {estado.erro ? <p className="text-xs text-wine">{estado.erro}</p> : null}
        {estado.ok ? <p className="text-xs text-brand-strong">{estado.ok}</p> : null}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <BotaoSalvar />
          <button
            type="button"
            onClick={copiar}
            className="flex items-center gap-1.5 rounded-full border border-ink/15 px-3 py-2 text-xs font-semibold text-ink transition-colors hover:border-brand/50 hover:text-brand-nav"
          >
            {copiado ? <Check size={13} /> : <Copy size={13} />}
            {copiado ? "Copiado" : "Copiar URL"}
          </button>
        </div>
      </form>

      <div className="border-t border-border/60 px-4 py-2.5">
        <form action={inativa ? reativarMidia : desativarMidia}>
          <input type="hidden" name="id" value={m.id} />
          <button
            type="submit"
            className="text-xs font-semibold text-muted transition-colors hover:text-wine"
          >
            {inativa ? "Reativar" : "Desativar"}
          </button>
        </form>
      </div>
    </li>
  );
}

export function Biblioteca({ itens }: { itens: Midia[] }) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const enviar = async (arquivos: FileList) => {
    setErro(null);
    setEnviando(true);
    const supabase = createClient();

    try {
      for (const original of Array.from(arquivos)) {
        // Converte para WebP antes de subir: mesmo resultado visual, arquivo
        // bem menor, e velocidade conta como fator de ranqueamento.
        const conv = await paraWebp(original);
        const arquivo = conv.arquivo;
        const dim = { w: conv.largura, h: conv.altura };

        const ext = arquivo.name.split(".").pop()?.toLowerCase() ?? "jpg";
        const caminho = `${nomeLegivel(arquivo.name)}-${Date.now()}.${ext}`;

        const { error: upErro } = await supabase.storage
          .from("media")
          .upload(caminho, arquivo, { cacheControl: "31536000", upsert: false });
        if (upErro) throw new Error(upErro.message);

        const { data } = supabase.storage.from("media").getPublicUrl(caminho);

        const { error: insErro } = await supabase.from("media").insert({
          bucket: "media",
          storage_path: caminho,
          url: data.publicUrl,
          mime: arquivo.type,
          bytes: arquivo.size,
          width: dim.w || null,
          height: dim.h || null,
        });
        if (insErro) throw new Error(insErro.message);
      }
      window.location.reload();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao enviar.");
      setEnviando(false);
    }
  };

  const semAlt = itens.filter((m) => !m.alt && !m.deactivated_at).length;

  return (
    <>
      <div
        className="glass mt-8 rounded-[20px] border-dashed p-8 text-center"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files.length) enviar(e.dataTransfer.files);
        }}
      >
        <UploadCloud className="mx-auto text-brand-nav" size={26} />
        <p className="mt-3 font-medium text-ink">
          Arraste imagens aqui ou escolha do computador
        </p>
        <p className="mt-1 text-sm text-muted">
          Prefira WebP ou AVIF. O nome do arquivo vira endereço legível, o que ajuda na busca por imagens.
        </p>
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={enviando}
          className="mt-5 rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-brand-light disabled:opacity-60"
        >
          {enviando ? "Enviando…" : "Escolher imagens"}
        </button>
        <input
          ref={input}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files?.length) enviar(e.target.files);
            e.target.value = "";
          }}
        />
        {erro ? <p className="mt-4 text-sm text-wine">{erro}</p> : null}
      </div>

      {semAlt > 0 ? (
        <p className="mt-5 rounded-[12px] border border-wine/25 bg-wine/5 px-4 py-3 text-sm text-wine">
          {semAlt} imagem(ns) sem texto alternativo. Sem ele a imagem não ajuda no SEO e falha em acessibilidade.
        </p>
      ) : null}

      {itens.length === 0 ? (
        <p className="mt-8 text-center text-muted">
          Nenhuma imagem ainda. As que você inserir pelo editor também aparecem aqui.
        </p>
      ) : (
        <ul className="mt-8 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {itens.map((m) => (
            <Ficha key={m.id} m={m} />
          ))}
        </ul>
      )}
    </>
  );
}
