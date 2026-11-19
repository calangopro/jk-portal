import { requireArea } from "@/lib/auth/session";
import { listarFatos } from "./actions";
import { TelaDosFatos } from "./Tela";

export const metadata = { title: "Base de fatos" };

/**
 * Base de fatos aprovados.
 *
 * É o card BASE MESTRA DE CONHECIMENTO JK do Trello virando tela. A regra do
 * projeto sempre disse que nenhuma afirmação vai ao ar sem fonte, e a
 * publicação já travava sem isso, só que a fonte era por conteúdo: o mesmo fato
 * precisava ser redigitado em cada guia. O resultado previsível foi a tabela de
 * fontes ficar zerada.
 *
 * Aqui o fato é escrito uma vez. No editor, citar o fato grava a fonte daquele
 * conteúdo sozinha.
 */
export default async function FatosPage() {
  await requireArea("conteudo");
  const fatos = await listarFatos();

  return <TelaDosFatos fatos={fatos} />;
}
