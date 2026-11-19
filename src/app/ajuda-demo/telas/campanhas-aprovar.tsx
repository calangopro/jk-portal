import { EditorDeCampanha } from "@/app/admin/(painel)/campanhas/[id]/EditorDeCampanha";
import type { Demo } from "../tipos";
import { avaliacaoDaDiretoria, campanha, itens, paraAdicionar } from "./campanhas-editor";

const demo: Demo = {
  caminho: "/admin/campanhas",
  desenho: () => (
    <EditorDeCampanha campanha={campanha("em_aprovacao")} itens={itens} avaliacao={avaliacaoDaDiretoria} margemMinima={0.3} admin paraAdicionar={paraAdicionar} />
  ),
};
export default demo;
