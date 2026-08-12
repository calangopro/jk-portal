/**
 * Primitivo único para injetar dados estruturados (JSON-LD).
 * Renderiza no servidor — o schema já vem no HTML do primeiro carregamento,
 * que é o que os crawlers de busca e de IA leem.
 */
export function JsonLd({ data }: { data: object | object[] }) {
  return (
    <script
      type="application/ld+json"
      // O conteúdo é montado por builders tipados nossos, nunca por input do usuário.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
