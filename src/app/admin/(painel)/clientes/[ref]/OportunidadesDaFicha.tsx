"use client";

import { CartaoDaOportunidade, MarcadasAgora, idDaOportunidade, useMarcacao, type Marcar, type OportunidadeNaTela } from "../CartaoDaOportunidade";

/**
 * "Para chamar agora", na ficha: o que vence para este cliente e o que foi
 * marcado nesta visita.
 *
 * É este componente que fica na tela quando a página se redesenha depois de
 * uma marcação, e por isso é ele que guarda o "Desfazer" (ver
 * `CartaoDaOportunidade.tsx`). Fica montado mesmo sem nenhuma oportunidade:
 * marcada a última, a lista do servidor vem vazia, e o "Desfazer" não pode
 * sumir junto.
 *
 * A ação vem de fora, como propriedade, para a tela poder ser vista sem sessão.
 */
export function OportunidadesDaFicha({ oportunidades, marcar }: { oportunidades: OportunidadeNaTela[]; marcar: Marcar }) {
  const { agora, emCurso, erro, decidir, aberta } = useMarcacao(marcar);
  const abertas = oportunidades.filter(aberta);
  if (abertas.length === 0 && agora.length === 0) return null;

  return (
    <section className="mt-9" aria-labelledby="oportunidades-do-cliente">
      <h2 id="oportunidades-do-cliente" className="font-display text-2xl text-ink">Para chamar agora</h2>
      <p className="mt-1 text-xs text-muted">O que vence para este cliente nos próximos 90 dias.</p>
      <MarcadasAgora marcadas={agora} emCurso={emCurso} erro={erro} aoDesfazer={(o) => decidir(o, "reaberta")} />
      {abertas.length > 0 ? (
        <ul className="mt-3 grid gap-3 lg:grid-cols-2">
          {abertas.map((o) => (
            <CartaoDaOportunidade key={idDaOportunidade(o)} o={o} emCurso={emCurso} erro={erro} aoDecidir={decidir} />
          ))}
        </ul>
      ) : null}
    </section>
  );
}
