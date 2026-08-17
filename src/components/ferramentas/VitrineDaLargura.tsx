"use client";

import { useEffect, useRef, useState } from "react";
import { precoLegivel, type ProdutoDaVitrine } from "@/lib/data/vitrine";
import { useLarguraEscolhida } from "./LarguraEscolhida";
import { BASE_PATH } from "@/lib/seo/base-path";

/**
 * Peças reais na largura que a pessoa escolheu.
 *
 * POR QUE ISTO É CLIENTE, SE A VITRINE ERA DO SERVIDOR
 *
 * A vitrine ficava presa em 4 mm: o simulador roda no navegador, a consulta ao
 * catálogo rodava no servidor, e o resultado era uma página que dizia "Alianças
 * de 4 mm" depois de a pessoa pedir 8 mm. Ferramenta que não responde parece
 * quebrada, e nesse caso ela também mentia sobre o que estava mostrando.
 *
 * O HTML da primeira resposta continua vindo do servidor, com a largura de
 * maior volume no catálogo dentro dele, então a busca e os sistemas de IA leem
 * uma vitrine pronta como antes. A troca só acontece se alguém MEXER na
 * ferramenta.
 *
 * O TÍTULO PERTENCE AO QUE ESTÁ NA TELA, NÃO AO QUE FOI PEDIDO
 *
 * `mostrando` guarda largura e peças JUNTAS, de propósito. Fossem dois estados
 * separados, um erro de rede ou uma resposta atrasada deixaria o título de 8 mm
 * em cima dos cartões de 4 mm, que é exatamente o defeito que este componente
 * veio consertar, só que pior, porque aí seria preço com etiqueta errada.
 */

/**
 * Espera antes de buscar, contada do último clique.
 *
 * Quem compara larguras clica em três ou quatro seguidas. Buscar em cada clique
 * gastaria consulta e faria a vitrine piscar três vezes; esperar demais devolve
 * a sensação de travado que o simulador tinha. Meio segundo depois do último
 * clique é rápido para parecer imediato e lento para não perseguir o dedo.
 */
const ESPERA_MS = 500;

type Mostrando = { largura: number; produtos: ProdutoDaVitrine[] };

export function VitrineDaLargura({
  larguraInicial,
  produtosIniciais,
  className = "",
}: {
  larguraInicial: number;
  produtosIniciais: ProdutoDaVitrine[];
  className?: string;
}) {
  const escolha = useLarguraEscolhida();
  const escolhida = escolha?.largura ?? larguraInicial;

  const [mostrando, setMostrando] = useState<Mostrando>({
    largura: larguraInicial,
    produtos: produtosIniciais,
  });
  const [buscando, setBuscando] = useState<number | null>(null);
  // Largura já visitada volta na hora, sem ida ao servidor e sem piscar.
  const guardadas = useRef<Map<number, ProdutoDaVitrine[]>>(
    new Map([[larguraInicial, produtosIniciais]]),
  );

  useEffect(() => {
    if (escolhida === mostrando.largura) {
      setBuscando(null);
      return;
    }

    const guardado = guardadas.current.get(escolhida);
    if (guardado) {
      setMostrando({ largura: escolhida, produtos: guardado });
      setBuscando(null);
      return;
    }

    setBuscando(escolhida);
    let vivo = true;
    const relogio = setTimeout(async () => {
      try {
        // Com basePath, o endpoint do portal vive em /guias/api/... Sem o
        // prefixo a chamada sairia do portal e cairia na loja da Tray.
        const resposta = await fetch(`${BASE_PATH}/api/produtos/largura?mm=${escolhida}`);
        if (!resposta.ok) throw new Error("resposta fora de 200");
        const dados = (await resposta.json()) as {
          larguraMm: number;
          produtos: ProdutoDaVitrine[];
        };
        guardadas.current.set(dados.larguraMm, dados.produtos);
        // Trocou de largura enquanto a resposta vinha: guarda e não mexe na
        // tela, senão a vitrine anda para trás sozinha.
        if (!vivo) return;
        setMostrando({ largura: dados.larguraMm, produtos: dados.produtos });
      } catch {
        // Rede caiu: a vitrine anterior fica onde está, com o título dela.
        // Preço com etiqueta de outra largura é pior do que vitrine parada.
      } finally {
        if (vivo) setBuscando(null);
      }
    }, ESPERA_MS);

    return () => {
      vivo = false;
      clearTimeout(relogio);
    };
  }, [escolhida, mostrando.largura]);

  const emMm = (v: number) => v.toLocaleString("pt-BR");
  const trocando = buscando !== null && buscando !== mostrando.largura;

  return (
    <section className={`max-w-leitura-larga ${className}`} aria-busy={trocando}>
      <h2 className="font-display text-titulo-secao text-ink">
        Alianças de {emMm(trocando ? (buscando as number) : mostrando.largura)} mm na loja
      </h2>
      {/* O aviso é a única coisa narrada em voz alta. Um `aria-live` na seção
          inteira faria o leitor de tela recitar os quatro cartões a cada troca
          de largura, o que é ruído, não informação. */}
      <p aria-live="polite" className="mt-2 text-apoio text-muted">
        {trocando
          ? `Buscando peças de ${emMm(buscando as number)} mm no catálogo da JK.`
          : "Peças com essa largura no catálogo da JK. A compra acontece na loja oficial."}
      </p>

      {trocando ? (
        <ul aria-hidden className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="glass animate-pulse rounded-[16px] p-4">
              <div className="aspect-square w-full rounded-[10px] bg-brand/10" />
              <div className="mt-3 h-3 w-4/5 rounded bg-brand/10" />
              <div className="mt-2 h-4 w-2/5 rounded bg-brand/10" />
            </li>
          ))}
        </ul>
      ) : mostrando.produtos.length === 0 ? (
        <p className="mt-4 text-apoio text-muted">
          Nenhuma peça de {emMm(mostrando.largura)} mm com preço sincronizado
          agora. Veja as outras larguras ou fale com a JK.
        </p>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {mostrando.produtos.map((p) => {
            const preco = precoLegivel(p.precoPromocional ?? p.preco);
            return (
              <li key={p.id}>
                <a
                  href={p.href}
                  target="_blank"
                  rel="noopener sponsored"
                  data-evento="clique_produto"
                  data-produto-nome={p.nome}
                  className="glass block h-full rounded-[16px] p-4 transition-colors hover:border-brand/50"
                >
                  {p.imagem ? (
                    // Imagem da Tray, em domínio que o next/image não conhece.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.imagem}
                      alt={p.nome}
                      loading="lazy"
                      decoding="async"
                      className="aspect-square w-full rounded-[10px] object-cover"
                    />
                  ) : null}
                  <p className="mt-3 text-sm leading-snug text-ink">{p.nome}</p>
                  {preco ? (
                    <p className="mt-1 font-display text-lg text-brand-strong">{preco}</p>
                  ) : null}
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
