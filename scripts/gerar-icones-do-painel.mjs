// Gera os ícones do painel instalado no celular (o "app" do Chrome).
//
// O desenho é o JK do próprio logo (os dois primeiros traços de public/logo.svg)
// em dourado sobre carvão. Rodar de novo só se o logo mudar:
//   node scripts/gerar-icones-do-painel.mjs
//
// Saem quatro arquivos em public/:
//   painel-icone-192.png e painel-icone-512.png   cantos arredondados, para o Chrome no computador
//   painel-icone-mascara-512.png                  fundo até a borda e marca menor: o Android recorta em círculo
//   painel-icone-180.png                          iPhone, sem transparência (o iOS arredonda sozinho)
import { readFileSync } from "node:fs";
import sharp from "sharp";

const logo = readFileSync("public/logo.svg", "utf8");
const tracos = [...logo.matchAll(/<path class="cls-1" d="([^"]+)"/g)].slice(0, 2).map((m) => m[1]);
if (tracos.length !== 2) throw new Error("Não achei o J e o K no logo.");

// Mede a caixa do JK desenhando só os dois traços e aparando o vazio.
const ESCALA = 8;
const soJK = (cor) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 100" width="${300 * ESCALA}" height="${100 * ESCALA}">` +
  tracos.map((d) => `<path fill="${cor}" d="${d}"/>`).join("") +
  "</svg>";
const aparado = await sharp(Buffer.from(soJK("#000000"))).png().trim().toBuffer({ resolveWithObject: true });
const caixa = {
  x: -aparado.info.trimOffsetLeft / ESCALA,
  y: -aparado.info.trimOffsetTop / ESCALA,
  w: aparado.info.width / ESCALA,
  h: aparado.info.height / ESCALA,
};

/** `ocupa`: fração da largura do ícone que o JK toma. `raio`: canto arredondado, em fração do lado. */
function icone(lado, { ocupa, raio }) {
  const escala = (lado * ocupa) / caixa.w;
  const dx = (lado - caixa.w * escala) / 2 - caixa.x * escala;
  const dy = (lado - caixa.h * escala) / 2 - caixa.y * escala;
  const r = lado * raio;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${lado}" height="${lado}" viewBox="0 0 ${lado} ${lado}">` +
      `<defs><linearGradient id="f" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#262019"/><stop offset="1" stop-color="#100e0c"/></linearGradient>` +
      `<linearGradient id="o" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e3c68a"/><stop offset="1" stop-color="#be9b60"/></linearGradient></defs>` +
      `<rect width="${lado}" height="${lado}" rx="${r}" fill="url(#f)"/>` +
      `<g transform="translate(${dx} ${dy}) scale(${escala})">` +
      tracos.map((d) => `<path fill="url(#o)" d="${d}"/>`).join("") +
      "</g></svg>",
  );
}

const saidas = [
  ["public/painel-icone-192.png", 192, { ocupa: 0.6, raio: 0.22 }],
  ["public/painel-icone-512.png", 512, { ocupa: 0.6, raio: 0.22 }],
  ["public/painel-icone-mascara-512.png", 512, { ocupa: 0.46, raio: 0 }],
  ["public/painel-icone-180.png", 180, { ocupa: 0.6, raio: 0 }],
];
for (const [arquivo, lado, opcoes] of saidas) {
  await sharp(icone(lado, opcoes)).png({ compressionLevel: 9 }).toFile(arquivo);
  console.log("ok", arquivo);
}
