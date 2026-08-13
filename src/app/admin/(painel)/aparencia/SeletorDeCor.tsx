"use client";

import { useEffect, useRef, useState } from "react";
import { HexAlphaColorPicker } from "react-colorful";
import { Check, RotateCcw } from "lucide-react";
import { PALETA_DA_MARCA } from "@/lib/tema/tokens";
import { corValida } from "@/lib/tema/tipos";
import { lerHex, paraHex } from "@/lib/tema/cor";

const CHAVE_RECENTES = "jk-cores-recentes";

/** Fundo xadrez, para transparência ficar visível em vez de virar branco. */
const XADREZ =
  "repeating-conic-gradient(#d8d3ca 0% 25%, #ffffff 0% 50%) 50% / 12px 12px";

function lerRecentes(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const bruto = window.localStorage.getItem(CHAVE_RECENTES);
    const lista = bruto ? (JSON.parse(bruto) as unknown) : [];
    return Array.isArray(lista) ? lista.filter((c): c is string => typeof c === "string") : [];
  } catch {
    return [];
  }
}

function guardarRecente(cor: string) {
  try {
    const atual = lerRecentes().filter((c) => c.toLowerCase() !== cor.toLowerCase());
    window.localStorage.setItem(CHAVE_RECENTES, JSON.stringify([cor, ...atual].slice(0, 12)));
  } catch {
    // localStorage cheio ou bloqueado: perder o histórico de cores recentes não
    // pode impedir a pessoa de escolher uma cor.
  }
}

export function SeletorDeCor({
  valor,
  padrao,
  aoMudar,
  rotulo,
}: {
  valor: string;
  padrao: string;
  aoMudar: (novo: string) => void;
  rotulo: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState(valor);
  const [recentes, setRecentes] = useState<string[]>([]);
  const caixa = useRef<HTMLDivElement>(null);

  // O campo de texto acompanha o valor de fora (arrastar o seletor, reverter),
  // mas sem atropelar o que a pessoa está digitando.
  useEffect(() => setTexto(valor), [valor]);
  useEffect(() => setRecentes(lerRecentes()), [aberto]);

  useEffect(() => {
    if (!aberto) return;
    const foraDaCaixa = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) fechar();
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") fechar();
    };
    document.addEventListener("mousedown", foraDaCaixa);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", foraDaCaixa);
      document.removeEventListener("keydown", tecla);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, valor]);

  function fechar() {
    setAberto(false);
    if (corValida(valor)) guardarRecente(valor);
  }

  function digitou(bruto: string) {
    setTexto(bruto);
    const limpo = bruto.startsWith("#") ? bruto : `#${bruto}`;
    if (corValida(limpo)) aoMudar(limpo.toLowerCase());
  }

  const rgb = lerHex(valor);
  const alterado = valor.toLowerCase() !== padrao.toLowerCase();

  return (
    <div ref={caixa} className="relative">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setAberto((a) => !a)}
          aria-label={`Escolher ${rotulo}`}
          aria-expanded={aberto}
          className="h-9 w-9 shrink-0 rounded-[10px] border border-border transition-transform hover:scale-105"
          style={{ background: XADREZ }}
        >
          <span
            aria-hidden
            className="block h-full w-full rounded-[9px]"
            style={{ backgroundColor: valor }}
          />
        </button>

        <input
          value={texto}
          onChange={(e) => digitou(e.target.value)}
          spellCheck={false}
          aria-label={`Código da cor ${rotulo}`}
          className={`numeros w-[9.5rem] rounded-[10px] border bg-white/80 px-3 py-2 font-mono text-xs uppercase text-ink outline-none transition-colors ${
            corValida(texto.startsWith("#") ? texto : `#${texto}`)
              ? "border-border hover:border-brand/40 focus:border-brand"
              : "border-wine focus:border-wine"
          }`}
        />

        {alterado ? (
          <button
            type="button"
            onClick={() => aoMudar(padrao)}
            title={`Voltar ao padrão da marca (${padrao})`}
            className="shrink-0 rounded-full p-1.5 text-muted transition-colors hover:bg-brand/10 hover:text-brand-nav"
          >
            <RotateCcw size={13} />
            <span className="sr-only">Voltar {rotulo} ao padrão</span>
          </button>
        ) : null}
      </div>

      {aberto ? (
        <div className="absolute left-0 top-full z-50 mt-2 w-[16.5rem] rounded-[14px] border border-border bg-white p-3 shadow-[var(--jk-sombra-modal)]">
          <HexAlphaColorPicker
            color={valor}
            onChange={(c) => aoMudar(c.toLowerCase())}
            style={{ width: "100%", height: "9.5rem" }}
          />

          {rgb ? (
            <p className="numeros mt-2.5 text-center text-[0.68rem] text-muted">
              rgb({Math.round(rgb.r)}, {Math.round(rgb.g)}, {Math.round(rgb.b)})
              {rgb.a < 1 ? ` · opacidade ${Math.round(rgb.a * 100)}%` : ""}
            </p>
          ) : null}

          <p className="mt-3 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted">
            Paleta da marca
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {PALETA_DA_MARCA.map((c) => (
              <button
                key={c.hex}
                type="button"
                title={`${c.nome} (${c.hex})`}
                onClick={() => aoMudar(c.hex)}
                className="relative h-6 w-6 rounded-[7px] border border-border transition-transform hover:scale-110"
                style={{ backgroundColor: c.hex }}
              >
                {valor.toLowerCase() === c.hex.toLowerCase() ? (
                  <Check
                    size={12}
                    className="absolute inset-0 m-auto"
                    style={{ color: c.hex === "#ffffff" || c.hex === "#f7f3ec" ? "#171512" : "#fff" }}
                  />
                ) : null}
                <span className="sr-only">{c.nome}</span>
              </button>
            ))}
          </div>

          {recentes.length > 0 ? (
            <>
              <p className="mt-3 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted">
                Usadas recentemente
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {recentes.map((c) => (
                  <button
                    key={c}
                    type="button"
                    title={c}
                    onClick={() => aoMudar(c)}
                    className="h-6 w-6 rounded-[7px] border border-border transition-transform hover:scale-110"
                    style={{ background: XADREZ }}
                  >
                    <span
                      aria-hidden
                      className="block h-full w-full rounded-[6px]"
                      style={{ backgroundColor: c }}
                    />
                    <span className="sr-only">Usar {c}</span>
                  </button>
                ))}
              </div>
            </>
          ) : null}

          <button
            type="button"
            onClick={fechar}
            className="mt-3 w-full rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-white"
          >
            Pronto
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** Só para reaproveitar a normalização em quem importa este módulo. */
export { paraHex };
