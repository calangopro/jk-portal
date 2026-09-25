"use client";

import { useEffect, useState } from "react";

type Partes = { dias: number; horas: number; minutos: number; segundos: number };

function partesAte(alvo: number, agora: number): Partes | null {
  const resto = alvo - agora;
  if (resto <= 0) return null;
  const s = Math.floor(resto / 1000);
  return {
    dias: Math.floor(s / 86400),
    horas: Math.floor((s % 86400) / 3600),
    minutos: Math.floor((s % 3600) / 60),
    segundos: s % 60,
  };
}

const dois = (n: number) => String(n).padStart(2, "0");

/**
 * Contador regressivo da campanha.
 *
 * O HTML chega do servidor já com um valor, para a caixa não nascer vazia e
 * pular de altura. Esse valor pode ter alguns minutos de idade (a página é
 * servida pronta), e o navegador corrige no primeiro segundo. O
 * `suppressHydrationWarning` nos dígitos é por isso: a diferença é esperada.
 *
 * Números tabulares e caixas de largura fixa, como pede o manual da campanha:
 * sem isso a largura muda a cada segundo e o relógio treme. Nada aqui muda de
 * tamanho, só de valor.
 *
 * Para o leitor de tela o relógio não fala a cada segundo (`aria-live` fica
 * desligado): a frase de antes já diz o que ele conta.
 */
export function Contador({ ate, rotulo }: { ate: string; rotulo: string }) {
  const alvo = Date.parse(ate);
  const [partes, setPartes] = useState<Partes | null>(() => partesAte(alvo, Date.now()));

  useEffect(() => {
    const tique = () => setPartes(partesAte(alvo, Date.now()));
    tique();
    const intervalo = window.setInterval(tique, 1000);
    return () => window.clearInterval(intervalo);
  }, [alvo]);

  if (!partes) return null;

  const caixas: [string, string][] = [
    [String(partes.dias), partes.dias === 1 ? "dia" : "dias"],
    [dois(partes.horas), "h"],
    [dois(partes.minutos), "min"],
    [dois(partes.segundos), "s"],
  ];

  return (
    <div className="mt-4">
      {rotulo ? <p className="text-[0.75rem] text-[var(--bio-apoio)]">{rotulo}</p> : null}
      <div role="timer" aria-live="off" className="numeros mt-2 flex justify-center gap-1.5">
        {caixas.map(([valor, unidade]) => (
          <span
            key={unidade}
            className="flex min-w-[3.4rem] items-baseline justify-center gap-0.5 rounded-xl border border-[var(--bio-contador-borda)] bg-[var(--bio-contador-fundo)] px-2 py-1.5"
          >
            <span suppressHydrationWarning className="text-[1.15rem] font-semibold leading-none text-[var(--bio-digito)]">
              {valor}
            </span>
            <span className="text-[0.68rem] text-[var(--bio-contador-apoio)]">{unidade}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
