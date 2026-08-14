"use client";

import { Ruler } from "lucide-react";
import { lerHex, paraTriplete } from "@/lib/tema/cor";
import { TRIPLETES } from "@/lib/tema/tokens";

/**
 * Preview ao vivo, montado com as MESMAS classes do site publicado.
 *
 * O truque é simples e é o que garante fidelidade: as variáveis do tema são
 * aplicadas no `style` deste contêiner, e o Tailwind lê variável por herança.
 * Então `bg-brand` aqui dentro pinta com a cor que a pessoa está arrastando,
 * sem nenhuma folha de estilo paralela e sem reimplementar componente nenhum.
 * Se o preview e o site divergirem um dia, é porque o componente real mudou, e
 * não porque a amostra mentiu.
 */
export function Amostra({
  cores,
  raios,
}: {
  cores: Record<string, string>;
  raios: Record<string, string>;
}) {
  const variaveis: Record<string, string> = {};
  for (const [nome, valor] of Object.entries(cores)) {
    variaveis[`--color-${nome}`] = valor;
    const triplete = TRIPLETES[nome];
    const rgb = triplete ? lerHex(valor) : null;
    if (triplete && rgb) variaveis[triplete] = paraTriplete(rgb);
  }
  for (const [nome, valor] of Object.entries(raios)) {
    variaveis[`--radius-${nome}`] = valor;
  }

  return (
    <div
      style={variaveis as React.CSSProperties}
      className="overflow-hidden rounded-[18px] border border-border"
    >
      <div className="bg-background p-6">
        <p className="eyebrow">Guia JK Alianças</p>
        <h3 className="font-display mt-3 text-titulo-secao text-ink">
          Tudo sobre alianças de casamento e namoro
        </h3>
        <p className="mt-2.5 max-w-[46ch] leading-relaxed text-muted">
          Tamanho, largura, material e preço, explicado por quem fabrica as
          alianças.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <span className="inline-flex min-h-11 items-center gap-2 rounded-full bg-brand px-6 text-apoio font-semibold text-ink shadow-[var(--jk-sombra-acao)]">
            <Ruler size={15} aria-hidden />
            Medir minha aliança
          </span>
          <span className="inline-flex min-h-11 items-center rounded-full border border-ink/25 bg-white/40 px-6 text-apoio font-semibold text-ink">
            Ver as dicas
          </span>
          <span className="text-apoio font-semibold text-brand-nav">Ver todos</span>
        </div>

        <div className="glass mt-6 rounded-lg p-5">
          <p className="eyebrow">Por que a JK</p>
          <p className="font-display mt-2.5 text-titulo-bloco text-brand-strong">
            Fábrica própria
          </p>
          <p className="text-apoio text-muted">Controle de cada detalhe</p>
          <span aria-hidden className="hairline mt-4 block" />
        </div>

        <div className="mt-5 overflow-hidden rounded-xl bg-gradient-to-br from-charcoal via-charcoal to-wine-deep px-6 py-7">
          <p className="eyebrow text-brand-light">Onde comprar</p>
          <p className="font-display mt-2 text-titulo-bloco text-white">
            Experimente na loja mais perto de você
          </p>
        </div>
      </div>
    </div>
  );
}
