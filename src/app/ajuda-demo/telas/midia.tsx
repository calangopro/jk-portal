import { TelaDaMidia } from "@/app/admin/(painel)/midia/Tela";
import type { Midia } from "@/app/admin/(painel)/midia/Biblioteca";
import type { Demo } from "../tipos";

/** Imagem neutra desenhada na hora (um bloco de cor e uma moldura), nada de foto real. */
function placeholder(cor: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600"><rect width="800" height="600" fill="${cor}"/><rect x="250" y="170" width="300" height="260" rx="18" fill="none" stroke="#ffffff" stroke-opacity=".7" stroke-width="10"/><circle cx="340" cy="250" r="26" fill="#ffffff" fill-opacity=".7"/><path d="M270 410 L370 320 L430 380 L480 330 L530 410 Z" fill="#ffffff" fill-opacity=".7"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const base = { storage_path: "exemplo/imagem.webp", title: null, credit: null, width: 1600, height: 900, mime: "image/webp", deactivated_at: null };
const itens: Midia[] = [
  { ...base, id: "i1", url: placeholder("#c9b99a"), alt: "Imagem de exemplo com texto alternativo preenchido", caption: "Legenda de exemplo", bytes: 84000, usos: 3 },
  { ...base, id: "i2", url: placeholder("#9fb3a8"), alt: null, caption: null, bytes: 120000, usos: 0 },
  { ...base, id: "i3", url: placeholder("#b4a7c9"), alt: "Outra imagem de exemplo", caption: null, bytes: 64000, usos: 1 },
  { ...base, id: "i4", url: placeholder("#c9a7a7"), alt: "Mais uma imagem de exemplo", caption: "Outra legenda de exemplo", bytes: 91000, usos: 2 },
];

const demo: Demo = {
  caminho: "/admin/midia",
  desenho: () => <TelaDaMidia itens={itens} />,
};
export default demo;
