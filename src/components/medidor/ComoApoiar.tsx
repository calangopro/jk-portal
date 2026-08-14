/**
 * Instrução visual do gesto de medir.
 *
 * A dúvida que mais trava a medição não é a calibração, é o que encostar em
 * quê. A primeira versão desta tela desenhava um anel dourado, e anel tem duas
 * bordas: ninguém sabia se a medida era a de fora ou a de dentro. Por isso o
 * desenho virou um disco cheio, de uma borda só, e a instrução virou um gesto
 * único, que a própria tela confirma:
 *
 *   aumente o dourado até ele tocar a aliança.
 *
 * A referência é o CONTATO entre duas coisas que a pessoa está vendo, e não a
 * ausência de um fundo. A versão anterior falava em "o escuro sumiu" e "sobrou
 * escuro em volta", que além de exigir olhar para o que NÃO está lá, abria
 * leitura de duplo sentido em texto de ferramenta. Tocar é o que ela faz com a
 * peça na mão, e é conferível a olho.
 *
 * Os três estados abaixo são o que ela vê de verdade com a peça apoiada. O
 * metal da aliança é cinza de propósito, para não competir com o dourado do
 * desenho, que é a única coisa que ela precisa acompanhar.
 */

type Estado = { rDisco: number; rotulo: string; certo?: boolean };

/** Raio interno e externo da aliança de verdade, apoiada na tela. */
const R_INTERNO = 30;
const R_EXTERNO = 43;

const ESTADOS: Estado[] = [
  { rDisco: 21, rotulo: "Pequeno: ainda não toca" },
  { rDisco: R_INTERNO, rotulo: "Certo: toca a aliança", certo: true },
  // Passar do ponto só fica visível quando o dourado aparece por FORA da peça:
  // entre o encaixe exato e a espessura do metal, a tela não muda de aparência.
  // É por isso que a instrução manda aumentar devagar e parar no primeiro
  // contato, em vez de procurar o meio do caminho.
  { rDisco: 48, rotulo: "Grande: passou da aliança" },
];

function Miniatura({ rDisco }: { rDisco: number }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden className="block h-full w-full">
      {/* O fundo escuro do palco, que é o que aparece quando o disco ainda é
          menor que o furo da aliança. */}
      <circle cx="50" cy="50" r={R_INTERNO} fill="#191612" />

      {/* O disco da tela. */}
      <circle cx="50" cy="50" r={rDisco} fill="#cfa964" />

      {/* A aliança de verdade, apoiada em cima do desenho. */}
      <circle
        cx="50"
        cy="50"
        r={(R_INTERNO + R_EXTERNO) / 2}
        fill="none"
        stroke="rgb(226 222 214 / 0.95)"
        strokeWidth={R_EXTERNO - R_INTERNO}
      />
      <circle cx="50" cy="50" r={R_INTERNO} fill="none" stroke="rgb(20 18 15 / 0.4)" strokeWidth="0.8" />
      <circle cx="50" cy="50" r={R_EXTERNO} fill="none" stroke="rgb(20 18 15 / 0.3)" strokeWidth="0.8" />
    </svg>
  );
}

export function ComoApoiar() {
  return (
    <div>
      <p className="text-apoio leading-relaxed text-[#f3ece1]/80">
        A aliança fica{" "}
        <strong className="font-semibold text-[#f6efe4]">deitada em cima da tela</strong>, em volta
        do círculo dourado. Aumente o dourado devagar e pare assim que ele
        tocar a aliança pelo lado de dentro.
      </p>

      <ul className="mt-4 grid grid-cols-3 gap-3">
        {ESTADOS.map((e) => (
          <li key={e.rotulo} className="text-center">
            <div
              // O destaque do certo é de vidro, e não dourado: aro dourado em
              // volta da miniatura seria lido como parte do desenho.
              className={`mx-auto aspect-square w-full max-w-[4.75rem] rounded-full p-1 ${
                e.certo ? "bg-white/12 ring-1 ring-white/25" : "bg-white/5"
              }`}
            >
              <Miniatura rDisco={e.rDisco} />
            </div>
            <p
              className={`mt-2 text-[0.7rem] leading-snug ${
                e.certo ? "font-semibold text-brand-light" : "text-[#f3ece1]/55"
              }`}
            >
              {e.rotulo}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
