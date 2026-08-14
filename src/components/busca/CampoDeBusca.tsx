"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, CornerDownLeft, Loader2, MapPin, FileText } from "lucide-react";

type Achado = {
  tipo: "guia" | "loja";
  slug: string;
  titulo: string;
  href: string;
  secao: string | null;
  trecho: string;
};

type Resposta = { guias: Achado[]; lojas: Achado[]; comSignificado: boolean };

/**
 * Campo de busca do portal.
 *
 * Segue o padrão de combobox da WAI-ARIA: o campo anuncia que controla uma
 * lista, as setas andam pelos resultados e o leitor de tela recebe a contagem.
 * Busca sem teclado é busca pela metade.
 */
export function CampoDeBusca({
  sugestoes = [],
  autoFoco = false,
  placeholder = "Ex.: como descobrir meu aro",
  compacto = false,
}: {
  sugestoes?: string[];
  autoFoco?: boolean;
  placeholder?: string;
  /** Versão do cabeçalho: mais baixa, sem dica de tecla e sem sugestões. */
  compacto?: boolean;
}) {
  const [termo, setTermo] = useState("");
  const [resposta, setResposta] = useState<Resposta | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(-1);

  const router = useRouter();
  const idLista = useId();
  const caixa = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  // Guarda qual busca é a mais recente. Sem isto, uma resposta lenta de uma
  // digitação antiga chega depois e sobrescreve a resposta certa.
  const ultima = useRef(0);

  useEffect(() => {
    const t = termo.trim();
    if (t.length < 2) {
      setResposta(null);
      setCarregando(false);
      return;
    }

    setCarregando(true);
    const meu = ++ultima.current;
    // Espera a pessoa parar de digitar. Cada busca custa uma chamada de
    // embedding, então disparar por tecla seria caro e pioraria o resultado.
    const timer = setTimeout(async () => {
      try {
        const r = await fetch(`/api/busca?q=${encodeURIComponent(t)}`);
        const dados = (await r.json()) as Resposta;
        if (meu === ultima.current) {
          setResposta(dados);
          setAberto(true);
          setAtivo(-1);
        }
      } catch {
        if (meu === ultima.current) setResposta(null);
      } finally {
        if (meu === ultima.current) setCarregando(false);
      }
    }, 260);

    return () => clearTimeout(timer);
  }, [termo]);

  useEffect(() => {
    const fora = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, []);

  const lista = [...(resposta?.guias ?? []), ...(resposta?.lojas ?? [])];
  const temResultado = lista.length > 0;

  function teclado(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setAberto(false);
      return;
    }
    if (!aberto || !temResultado) {
      if (e.key === "Enter" && termo.trim()) router.push(`/busca?q=${encodeURIComponent(termo.trim())}`);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAtivo((i) => (i + 1) % lista.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setAtivo((i) => (i <= 0 ? lista.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const escolhido = ativo >= 0 ? lista[ativo] : null;
      router.push(escolhido ? escolhido.href : `/busca?q=${encodeURIComponent(termo.trim())}`);
      setAberto(false);
    }
  }

  return (
    <div ref={caixa} className="relative w-full">
      {/* O anel de foco fica no CONTÊINER, não no input. O `:focus-visible`
          global desenha um retângulo de cantos pequenos, que dentro de um campo
          em cápsula aparece como uma caixa torta. Aqui ele segue a forma real do
          campo, e continua visível pelo teclado, que é o que a regra exige. */}
      <div
        className={`flex items-center rounded-full transition-shadow focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand-nav ${
          compacto
            ? "gap-2 border border-brand/25 bg-white/60 py-0.5 pl-3.5 pr-2 backdrop-blur-sm hover:border-brand/45"
            : "glass gap-3 py-1 pl-5 pr-2 focus-within:shadow-[var(--jk-sombra-acao)]"
        }`}
      >
        <Search size={compacto ? 15 : 19} className="shrink-0 text-brand-nav" aria-hidden />
        <input
          ref={campo}
          type="search"
          value={termo}
          autoFocus={autoFoco}
          onChange={(e) => setTermo(e.target.value)}
          onFocus={() => temResultado && setAberto(true)}
          onKeyDown={teclado}
          placeholder={placeholder}
          aria-label="Buscar no site"
          role="combobox"
          aria-expanded={aberto && temResultado}
          aria-controls={idLista}
          aria-autocomplete="list"
          aria-activedescendant={ativo >= 0 ? `${idLista}-${ativo}` : undefined}
          className={`min-w-0 flex-1 bg-transparent text-ink outline-none focus:outline-none focus-visible:outline-none placeholder:text-muted/80 [&::-webkit-search-cancel-button]:hidden ${
            compacto ? "py-1.5 text-apoio" : "py-3.5 text-corpo"
          }`}
        />
        {carregando ? (
          <Loader2
            size={compacto ? 14 : 17}
            className={`shrink-0 animate-spin text-brand-nav ${compacto ? "mr-1.5" : "mr-3"}`}
            aria-hidden
          />
        ) : compacto ? null : (
          <span className="mr-1 hidden shrink-0 items-center gap-1 rounded-full bg-ink/6 px-2.5 py-1 text-nota text-muted sm:flex">
            <CornerDownLeft size={11} aria-hidden />
            buscar
          </span>
        )}
      </div>

      <p aria-live="polite" className="sr-only">
        {carregando ? "Buscando" : temResultado ? `${lista.length} resultados` : ""}
      </p>

      {sugestoes.length > 0 && !termo && !compacto ? (
        <div className="mt-3.5 flex flex-wrap justify-center gap-2">
          {sugestoes.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setTermo(s);
                campo.current?.focus();
              }}
              className="rounded-full border border-brand/25 bg-white/50 px-3.5 py-1.5 text-apoio text-brand-nav transition-colors hover:border-brand/60 hover:bg-white/80"
            >
              {s}
            </button>
          ))}
        </div>
      ) : null}

      {aberto && temResultado ? (
        <ul
          id={idLista}
          role="listbox"
          aria-label="Resultados da busca"
          className="glass absolute left-0 right-0 top-full z-50 mt-2.5 max-h-[26rem] overflow-y-auto rounded-xl p-2 text-left"
        >
          {resposta?.guias.length ? (
            <li className="px-3 pb-1 pt-2 text-nota font-semibold uppercase tracking-[0.14em] text-muted">
              Guias
            </li>
          ) : null}
          {lista.map((a, i) => (
            <Fragmento
              key={`${a.tipo}-${a.slug}-${i}`}
              a={a}
              i={i}
              idLista={idLista}
              ativo={ativo === i}
              primeiraLoja={a.tipo === "loja" && lista[i - 1]?.tipo !== "loja"}
              aoEntrar={() => setAtivo(i)}
              aoClicar={() => setAberto(false)}
            />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Fragmento({
  a,
  i,
  idLista,
  ativo,
  primeiraLoja,
  aoEntrar,
  aoClicar,
}: {
  a: Achado;
  i: number;
  idLista: string;
  ativo: boolean;
  primeiraLoja: boolean;
  aoEntrar: () => void;
  aoClicar: () => void;
}) {
  return (
    <>
      {primeiraLoja ? (
        <li className="mt-1 border-t border-border/70 px-3 pb-1 pt-3 text-nota font-semibold uppercase tracking-[0.14em] text-muted">
          Lojas
        </li>
      ) : null}
      <li id={`${idLista}-${i}`} role="option" aria-selected={ativo}>
        <Link
          href={a.href}
          onMouseEnter={aoEntrar}
          onClick={aoClicar}
          className={`flex gap-3 rounded-lg px-3 py-2.5 transition-colors ${
            ativo ? "bg-brand/12" : "hover:bg-brand/8"
          }`}
        >
          <span className="mt-0.5 shrink-0 text-brand-nav" aria-hidden>
            {a.tipo === "loja" ? <MapPin size={15} /> : <FileText size={15} />}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-apoio font-semibold text-ink">
              {a.secao ?? a.titulo}
            </span>
            <span className="mt-0.5 line-clamp-2 block text-nota leading-relaxed text-muted">
              {a.trecho}
            </span>
          </span>
        </Link>
      </li>
    </>
  );
}
