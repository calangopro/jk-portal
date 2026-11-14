"use client";

import { useState } from "react";
import { UserRound } from "lucide-react";
import type { OportunidadeDaLista } from "@/lib/clientes/dados";
import { TIPOS, type TipoDeOportunidade } from "@/lib/clientes/oportunidades";
import { CartaoDaOportunidade, MarcadasAgora, idDaOportunidade, useMarcacao, type Marcar } from "../clientes/CartaoDaOportunidade";

/**
 * A lista de oportunidades, com os dois filtros: por tipo e "só os meus
 * clientes". Filtrar não vai ao servidor: a lista da janela já veio inteira.
 *
 * As oportunidades saem em três blocos, na ordem em que pedem ação: o que já
 * passou da data, o que vence em até sete dias e o que vem depois.
 *
 * O que foi marcado nesta visita fica em cima, com o "Desfazer". É este
 * componente que guarda o que foi marcado e reaberto agora, sem esperar o
 * redesenho da página, e por isso ele fica montado mesmo quando a lista do
 * servidor vem vazia (ver `CartaoDaOportunidade.tsx`).
 *
 * A ação vem de fora, como propriedade, para a tela poder ser vista sem sessão.
 */

type Filtro = TipoDeOportunidade | "todas";

export function ListaDeOportunidades({
  lista, eu, dias, marcar,
}: {
  lista: OportunidadeDaLista[];
  eu: string | null;
  dias: number;
  marcar: Marcar;
}) {
  const [tipo, setTipo] = useState<Filtro>("todas");
  const [soMeus, setSoMeus] = useState(false);
  const { agora, emCurso, erro, decidir, abertasDe } = useMarcacao<OportunidadeDaLista>(marcar);

  const abertas = abertasDe(lista);
  const meus = (o: OportunidadeDaLista) => eu !== null && o.responsavelId === eu;
  const visiveis = abertas.filter((o) => (!soMeus || meus(o)) && (tipo === "todas" || o.tipo === tipo));
  const contar = (t: Filtro) => abertas.filter((o) => (!soMeus || meus(o)) && (t === "todas" || o.tipo === t)).length;
  const tiposPresentes = TIPOS.filter((t) => abertas.some((o) => o.tipo === t.chave));

  const blocos = [
    { titulo: "Passaram da data", apoio: "Ainda dá para chamar, com atraso.", itens: visiveis.filter((o) => o.emDias < 0) },
    { titulo: "Nos próximos 7 dias", apoio: undefined, itens: visiveis.filter((o) => o.emDias >= 0 && o.emDias <= 7) },
    { titulo: "Mais adiante", apoio: undefined, itens: visiveis.filter((o) => o.emDias > 7) },
  ].filter((b) => b.itens.length > 0);

  const chip = "painel-toque inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-xs font-semibold";

  return (
    <div>
      {agora.length > 0 ? (
        <section className="mt-5" aria-label="Marcadas agora">
          <h2 className="font-display text-xl text-ink sm:text-2xl">Marcadas agora</h2>
          <p className="mt-0.5 text-xs text-muted">Saíram da lista. Se foi engano, dá para desfazer.</p>
          <MarcadasAgora marcadas={agora} emCurso={emCurso} erro={erro} aoDesfazer={(o) => decidir(o, "reaberta")} />
        </section>
      ) : null}

      {abertas.length === 0 ? (
        <p className="glass mt-5 rounded-[18px] p-6 text-sm text-muted">
          <span className="font-semibold text-ink">Nenhuma oportunidade nos próximos {dias} dias.</span> A lista cresce
          conforme as fichas ganham datas (aniversário, começo do namoro, casamento) e conforme as compras completam dez
          meses e um ano.
        </p>
      ) : (
        <>
          <div className="painel-fila -mx-1 mt-4 flex gap-1.5 overflow-x-auto px-1 pb-1" role="group" aria-label="Filtrar por tipo">
            <button type="button" onClick={() => setTipo("todas")} aria-pressed={tipo === "todas"} className={`${chip} ${tipo === "todas" ? "painel-aba-ativa" : "border border-ink/12 bg-white text-ink"}`}>
              Todas <span className="numeros opacity-80">{contar("todas")}</span>
            </button>
            {tiposPresentes.map((t) => (
              <button
                key={t.chave}
                type="button"
                onClick={() => setTipo(t.chave)}
                aria-pressed={tipo === t.chave}
                className={`${chip} ${tipo === t.chave ? "painel-aba-ativa" : "border border-ink/12 bg-white text-ink"}`}
              >
                {t.nome} <span className="numeros opacity-80">{contar(t.chave)}</span>
              </button>
            ))}
          </div>

          <label className="mt-3 inline-flex cursor-pointer items-center gap-2.5 text-sm text-ink">
            <input type="checkbox" checked={soMeus} onChange={(e) => setSoMeus(e.target.checked)} className="h-4.5 w-4.5 accent-[var(--setor)]" />
            <span className="inline-flex items-center gap-1.5">
              <UserRound size={14} aria-hidden="true" /> Só os meus clientes
            </span>
          </label>

          {blocos.length === 0 ? (
            <p className="glass mt-5 rounded-[16px] p-5 text-sm text-muted">
              {soMeus && !abertas.some(meus) ? (
                <>
                  <span className="font-semibold text-ink">Nenhum cliente desta lista está com você.</span> Na ficha do cliente, em
                  “Quem cuida deste cliente”, escolha o seu nome.
                </>
              ) : (
                <>
                  <span className="font-semibold text-ink">Nada neste filtro.</span> Troque o tipo ou aumente o número de dias.
                </>
              )}
            </p>
          ) : (
            blocos.map((b) => (
              <section key={b.titulo} className="mt-7" aria-label={b.titulo}>
                <h2 className="font-display text-xl text-ink sm:text-2xl">
                  {b.titulo} <span className="numeros text-base text-muted">({b.itens.length})</span>
                </h2>
                {b.apoio ? <p className="mt-0.5 text-xs text-muted">{b.apoio}</p> : null}
                <ul className="mt-3 grid gap-3 lg:grid-cols-2">
                  {b.itens.map((o) => (
                    <CartaoDaOportunidade key={idDaOportunidade(o)} o={o} emCurso={emCurso} erro={erro} aoDecidir={decidir} />
                  ))}
                </ul>
              </section>
            ))
          )}
        </>
      )}
    </div>
  );
}
