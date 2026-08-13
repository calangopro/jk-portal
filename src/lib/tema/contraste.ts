import { avaliarContraste, aproximarAteAAPassar, lerHex, paraHex, razaoLegivel } from "./cor";
import { PARES_DE_CONTRASTE } from "./tokens";

/**
 * Avaliação de contraste dos pares que existem de verdade na tela.
 *
 * Mora fora do componente porque roda nos dois lados: no formulário, enquanto a
 * pessoa arrasta o seletor, e no servidor, antes de gravar. Trava que só existe
 * no navegador não é trava, é enfeite.
 */

export type Avaliacao = {
  frente: string;
  fundo: string;
  onde: string;
  razao: number;
  razaoTexto: string;
  /** Exigência aplicável: 3:1 para texto grande, 4,5:1 para o resto. */
  minimo: number;
  passa: boolean;
  /** Cor de frente mais próxima que passaria, quando reprova. */
  sugestao?: string;
  /** Nem preto nem branco puro resolvem: o problema está no fundo. */
  semSaida?: boolean;
};

export function avaliarTema(cores: Record<string, string>): Avaliacao[] {
  const saida: Avaliacao[] = [];

  for (const par of PARES_DE_CONTRASTE) {
    const frente = lerHex(cores[par.frente] ?? "");
    const fundo = lerHex(cores[par.fundo] ?? "");
    if (!frente || !fundo) continue;

    const veredito = avaliarContraste(frente, fundo);
    const minimo = par.textoGrande ? 3 : 4.5;
    const passa = par.textoGrande ? veredito.passaAAGrande : veredito.passaAA;

    const item: Avaliacao = {
      frente: par.frente,
      fundo: par.fundo,
      onde: par.onde,
      razao: veredito.razao,
      razaoTexto: razaoLegivel(veredito.razao),
      minimo,
      passa,
    };

    if (!passa) {
      const { cor, conseguiu } = aproximarAteAAPassar(frente, fundo, minimo);
      item.sugestao = paraHex(cor);
      item.semSaida = !conseguiu;
    }

    saida.push(item);
  }

  return saida;
}

export function reprovados(cores: Record<string, string>): Avaliacao[] {
  return avaliarTema(cores).filter((a) => !a.passa);
}

/** Mensagem pronta para o usuário, listando o que precisa mudar. */
export function mensagemDeReprovacao(lista: Avaliacao[]): string {
  const linhas = lista.map(
    (a) =>
      `${a.onde}: ${a.razaoTexto}, precisa de ${String(a.minimo).replace(".", ",")}:1` +
      (a.sugestao && !a.semSaida ? ` (o mais próximo que passa é ${a.sugestao})` : ""),
  );
  return `Estas combinações ficariam difíceis de ler:\n${linhas.join("\n")}`;
}
