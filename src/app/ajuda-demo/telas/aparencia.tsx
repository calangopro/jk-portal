import { Aparencia } from "@/app/admin/(painel)/aparencia/Aparencia";
import { temaPadrao } from "@/lib/tema/tipos";
import type { Demo } from "../tipos";

// O padrão da marca, que é o que o site usa de fábrica.
const demo: Demo = {
  caminho: "/admin/aparencia",
  desenho: () => (
    <div>
      <header className="mb-7">
        <h1 className="font-display text-2xl text-ink">Aparência</h1>
        <p className="mt-1.5 max-w-[62ch] text-sm leading-relaxed text-muted">
          Cor e forma do site público. O que você escolher aqui vale para todas as
          páginas na hora em que salvar, sem precisar de publicação nova.
        </p>
      </header>
      <Aparencia inicial={temaPadrao()} />
    </div>
  ),
};
export default demo;
