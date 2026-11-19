import { EditorDaHome } from "@/app/admin/(painel)/home/EditorDaHome";
import { layoutPadraoDaHome } from "@/lib/blocos/tipos";
import type { Demo } from "../tipos";

// O layout de fábrica da home é texto público do site, então serve de exemplo.
const demo: Demo = {
  caminho: "/admin/home",
  desenho: () => (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-2xl text-ink">Home</h1>
        <p className="mt-1.5 max-w-[62ch] text-sm leading-relaxed text-muted">
          Cada cartão abaixo é uma faixa da página inicial, na ordem em que aparece.
          Arraste pela alça para reordenar, use o olho para ocultar sem apagar, e
          salve. A home vai ao ar com a mudança na hora.
        </p>
      </header>
      <EditorDaHome inicial={layoutPadraoDaHome()} />
    </div>
  ),
};
export default demo;
