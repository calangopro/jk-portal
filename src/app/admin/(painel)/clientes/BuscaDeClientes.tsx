"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import type { ResumoDoCliente } from "@/lib/clientes/dados";
import { LinhaDoCliente } from "./LinhaDoCliente";

/**
 * A busca de clientes: nome, telefone, e-mail ou número de pedido.
 *
 * Busca enquanto a pessoa digita, com uma pausa curta para não ir ao banco a
 * cada tecla. O que foi digitado NÃO vai para o endereço da página (é dado de
 * cliente): a busca é uma ação, e o último termo fica guardado só nesta aba,
 * para a lista estar lá quando a pessoa volta da ficha.
 *
 * A ação vem de fora, como propriedade, para a tela poder ser vista sem sessão.
 */

type Buscar = (q: string) => Promise<ResumoDoCliente[] | null>;

const GUARDADO = "jk-clientes-busca";

function Lista({ titulo, apoio, clientes }: { titulo: string; apoio?: string; clientes: ResumoDoCliente[] }) {
  return (
    <section className="mt-6" aria-label={titulo}>
      <h2 className="font-display text-xl text-ink sm:text-2xl">{titulo}</h2>
      {apoio ? <p className="mt-1 text-xs text-muted">{apoio}</p> : null}
      <ul className="mt-3 grid gap-2.5 lg:grid-cols-2">
        {clientes.map((c) => (
          <LinhaDoCliente key={c.ref} c={c} />
        ))}
      </ul>
    </section>
  );
}

export function BuscaDeClientes({
  buscar, recentes, meus,
}: {
  buscar: Buscar;
  /** Quem comprou por último. `null`: não deu para ler. */
  recentes: ResumoDoCliente[] | null;
  /** Os clientes de quem a pessoa logada cuida. */
  meus: ResumoDoCliente[];
}) {
  const [q, setQ] = useState("");
  const [achados, setAchados] = useState<{ termo: string; lista: ResumoDoCliente[] | null } | null>(null);
  const [buscando, setBuscando] = useState(false);
  const pedido = useRef(0);

  // Na volta da ficha, o termo que estava na caixa.
  useEffect(() => {
    try {
      const antes = window.sessionStorage.getItem(GUARDADO);
      if (antes) setQ(antes);
    } catch {
      // Navegador sem armazenamento: a busca só começa vazia.
    }
  }, []);

  useEffect(() => {
    const termo = q.trim();
    try {
      if (termo) window.sessionStorage.setItem(GUARDADO, termo);
      else window.sessionStorage.removeItem(GUARDADO);
    } catch {
      // Sem armazenamento, nada a guardar.
    }
    if (termo.length < 2) {
      pedido.current++;
      setAchados(null);
      setBuscando(false);
      return;
    }
    const meu = ++pedido.current;
    setBuscando(true);
    const espera = window.setTimeout(async () => {
      let lista: ResumoDoCliente[] | null = null;
      try {
        lista = await buscar(termo);
      } catch {
        lista = null;
      }
      // Resposta de uma busca antiga não passa por cima da mais nova.
      if (meu !== pedido.current) return;
      setAchados({ termo, lista });
      setBuscando(false);
    }, 350);
    return () => window.clearTimeout(espera);
  }, [q, buscar]);

  return (
    <div>
      <div className="relative mt-6">
        <label htmlFor="busca-de-clientes" className="sr-only">Buscar cliente por nome, telefone, e-mail ou número do pedido</label>
        <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input
          id="busca-de-clientes"
          // `type="text"`, e não "search": o navegador desenharia o próprio X ao lado do nosso.
          type="text"
          inputMode="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoComplete="off"
          enterKeyHint="search"
          placeholder="Nome, telefone ou pedido"
          className="h-13 w-full rounded-full border border-ink/15 bg-white py-3.5 pl-11 pr-12 text-base text-ink outline-none placeholder:text-muted focus:border-[var(--setor)]"
        />
        <span className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center">
          {buscando ? (
            <Loader2 size={18} className="animate-spin text-muted" aria-hidden="true" />
          ) : q ? (
            <button type="button" onClick={() => setQ("")} className="painel-toque grid h-8 w-8 place-items-center rounded-full text-muted hover:text-ink" aria-label="Limpar a busca">
              <X size={16} aria-hidden="true" />
            </button>
          ) : null}
        </span>
      </div>

      <div aria-live="polite">
        {achados ? (
          achados.lista === null ? (
            <p className="glass mt-6 rounded-[16px] p-5 text-sm text-muted">
              <span className="font-semibold text-ink">Não deu para buscar agora.</span> Tente de novo em alguns segundos.
            </p>
          ) : achados.lista.length === 0 ? (
            <p className="glass mt-6 rounded-[16px] p-5 text-sm text-muted">
              <span className="font-semibold text-ink">Ninguém com “{achados.termo}”.</span> Tente só o primeiro nome, os últimos
              dígitos do telefone ou o número do pedido. Quem nunca criou pedido, não comprou por fora e não entrou no grupo ainda
              não tem ficha.
            </p>
          ) : (
            <Lista
              titulo={achados.lista.length === 1 ? "1 cliente" : `${achados.lista.length} clientes`}
              apoio={achados.lista.length >= 30 ? "Mostrando os 30 mais recentes. Escreva mais para afinar." : undefined}
              clientes={achados.lista}
            />
          )
        ) : (
          <>
            {meus.length > 0 ? <Lista titulo="Clientes com você" apoio="As fichas em que você está como quem cuida." clientes={meus} /> : null}
            {recentes === null ? (
              <p className="glass mt-6 rounded-[16px] p-5 text-sm text-muted">
                <span className="font-semibold text-ink">Não deu para ler os clientes agora.</span> Recarregue a página em alguns segundos.
              </p>
            ) : recentes.length > 0 ? (
              <Lista titulo="Compraram por último" apoio="Pedidos pagos na loja nos últimos 30 dias, do mais novo para o mais antigo." clientes={recentes} />
            ) : (
              <p className="glass mt-6 rounded-[16px] p-5 text-sm text-muted">Nenhum pedido pago nos últimos 30 dias. Use a busca para achar um cliente.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
