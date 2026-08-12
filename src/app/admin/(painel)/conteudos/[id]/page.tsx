import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth/session";
import {
  obterConteudo,
  paginasComparaveis,
  clustersExistentes,
  opcoesDeAutor,
  temLinkDeEntrada,
} from "@/lib/data/admin-contents";
import { listarFontes, capaAtual } from "./actions";
import { Editor } from "./Editor";

export const metadata = { title: "Editar conteúdo" };

export default async function EditarConteudoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff();
  const { id } = await params;
  const conteudo = await obterConteudo(id);
  if (!conteudo) notFound();

  const [comparaveis, fontesIniciais, clusters, capaInicial, autores] =
    await Promise.all([
      paginasComparaveis(id),
      listarFontes(id),
      clustersExistentes(),
      capaAtual(id),
      opcoesDeAutor(),
    ]);
  const entrada = await temLinkDeEntrada(id);

  return (
    <Editor
      inicial={conteudo}
      comparaveis={comparaveis}
      fontesIniciais={fontesIniciais}
      clusters={clusters}
      capaInicial={capaInicial}
      autores={autores}
      temLinkDeEntrada={entrada}
    />
  );
}
