import { TelaDePublicar } from "@/app/admin/(painel)/redes/publicar/Tela";
import { POSTS_DA_FILA, AGORA } from "../redes-exemplo";
import type { Demo } from "../tipos";

const ok = async () => {
  "use server";
  return { ok: true as const };
};
const liberar = async () => {
  "use server";
  return { ok: true as const, quando: "2026-11-19T22:00:00Z", contas: [] as string[] };
};
const cancelou = async () => {
  "use server";
  return { ok: true as const, cancelados: 1 };
};

const demo: Demo = {
  caminho: "/admin/redes/publicar",
  desenho: () => (
    <TelaDePublicar
      aba="fila"
      posts={POSTS_DA_FILA}
      contagem={{ fila: 4, rascunhos: 2, erros: 1 }}
      agora={AGORA}
      saiu={null}
      acoes={{ liberar, cancelar: cancelou, apagar: ok, cancelarSequencia: cancelou }}
    />
  ),
};
export default demo;
