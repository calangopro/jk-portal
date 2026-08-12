import { Acordeao } from "./Acordeao";
import type { Faq } from "@/lib/content/types";

/**
 * FAQ visível.
 *
 * Recebe o MESMO array que alimenta o `faqPageSchema`, para o que a pessoa lê e
 * o que o buscador lê nunca divergirem. Antes existiam duas implementações
 * (guia e medidor) com raios diferentes, e nenhuma delas era acordeão.
 *
 * Sem `<dl>` de propósito: `<details>` não é filho válido de uma lista de
 * definição, e o par summary/conteúdo já entrega a semântica de pergunta e
 * resposta para o leitor de tela.
 */
export function FaqLista({
  faqs,
  titulo = "Perguntas frequentes",
  id,
  className = "",
}: {
  faqs: Faq[];
  titulo?: string;
  id?: string;
  className?: string;
}) {
  if (!faqs.length) return null;

  return (
    <section id={id} className={className} aria-label={titulo}>
      <h2 className="font-display text-titulo-secao text-ink">{titulo}</h2>
      <div className="faq-lista mt-6 space-y-3">
        {faqs.map((f, i) => (
          <Acordeao key={`${f.question}-${i}`} titulo={f.question} aberto={i === 0}>
            {f.answer}
          </Acordeao>
        ))}
      </div>
    </section>
  );
}
