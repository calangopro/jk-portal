/**
 * Venda ganha da Kommo sem pedido vai para a fila da fábrica (cartão 51, 0176).
 *
 * Arquivo PURO (sem banco, sem rede e sem importar função de outro arquivo,
 * só tipo): serve à rodada (`fabrica-rodada.ts`), à tela e ao teste
 * (`npm run verificar:kommo-vendas`).
 *
 * `lerProducaoDaKommo` lê os campos do negócio e devolve o formulário da
 * fábrica (`ProducaoDoFormulario`, o MESMO que o vendedor preenche em
 * Registrar venda). Quem confere e monta o texto da peça é `lerProducao`
 * (`lib/vendas/producao.ts`), chamada por quem usa esta leitura: assim a venda
 * da Kommo chega à fábrica no mesmo formato da venda por fora e do pedido da
 * loja, e `lerEspecificacoes` (`lib/fabrica/etapas.ts`) abre as duas igual.
 *
 * Como os vendedores preenchem a Kommo (medido em 18/11/2026, nos ganhos dos
 * funis de venda): o campo "Produto" quase nunca vem; a peça sai de "Tipo de
 * Produto" (Alianças, Anéis, Brinco...) mais "Metal". A numeração vem num texto
 * só, "17 e 23", "18 E 19", "17/16", "12,25". A gravação, quando vem, é um
 * texto só ("Isaac/Ana Clara 21.04.26"), sem dizer o aro nem se é laser ou
 * manual. "Loja" é lista: E-commerce ou uma das lojas físicas.
 *
 * Regra de ouro: NUNCA PALPITE. O que não dá para ler sem chutar devolve
 * `incompleta` com o motivo por extenso, e a venda espera alguém completar
 * pelo formulário de Registrar venda. Peça que não leva numeração nem gravação
 * (relógio, corrente, brinco...) devolve `fora`: não vai sozinha para a
 * fábrica, e a tela mostra para quem quiser mandar.
 */
import type { Campo } from "./vendas";
import type { PecaDoFormulario, ProducaoDoFormulario } from "../vendas/producao";

/** Os campos que a leitura usa, pelo nome como está na Kommo (id entre parênteses, conferido em 18/11/2026). */
export const CAMPOS_DA_FABRICA = {
  produto: "Produto", // 3173632 e 3176760: dois campos com o mesmo nome, vale o primeiro preenchido
  numeracao: "Numeração", // 3173630
  gravura: "Gravura", // 3173628
  metal: "Metal", // 3173626
  quilates: "Quilates", // 3174602
  modelo: "Modelo Aliança", // 3173638
  tipoDeJoia: "Tipo de Joia", // 3173634
  milimetros: "Milimetros/tamanho", // 3174656
  conjunto: "Contém conjunto?", // 3177544
  quantidade: "Quantidade de produtos", // 3177740
  tipoDeProduto: "Tipo de Produto", // 3177220
  loja: "Loja", // 3185306
  personalizados: "Personalizados", // 3173624
  joia: "Joia", // 3173636
} as const;

/** "Loja" que não é loja física: a entrega fica a combinar. */
export const LOJA_SEM_RETIRADA = /e-?commerce|site|online/i;

/** Numeração de aro que o painel aceita: de 5 a 40, com meio número ("17,5"). */
export const ARO_MINIMO = 5;
export const ARO_MAXIMO = 40;

export type Familia = "aliancas" | "anel" | "sem_numeracao" | "desconhecida";

export type LeituraDaFabrica =
  | { tipo: "fabrica"; formulario: ProducaoDoFormulario }
  | { tipo: "incompleta"; motivos: string[]; formulario: ProducaoDoFormulario }
  | { tipo: "fora"; motivos: string[]; formulario: ProducaoDoFormulario };

function semAcento(t: string): string {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

function campo(campos: Campo[] | null | undefined, nome: string): string | null {
  const alvo = semAcento(nome);
  for (const c of campos ?? []) {
    if (semAcento(c.nome ?? "") === alvo && c.valor?.trim()) return c.valor.trim();
  }
  return null;
}

/** De que família é a peça: pelo "Tipo de Produto" e, sem ele, por palavra do "Produto". Sem pista, `desconhecida`. */
export function familiaDaPeca(tipoDeProduto: string | null, produto: string | null): Familia {
  const t = semAcento(tipoDeProduto ?? "");
  if (t) {
    if (/alianc/.test(t)) return "aliancas";
    if (/^ane(l|is)/.test(t)) return "anel";
    return "sem_numeracao";
  }
  const p = semAcento(produto ?? "");
  if (!p) return "desconhecida";
  if (/alianc|\bpar\b/.test(p)) return "aliancas";
  if (/\banel\b|\baneis\b|solitario/.test(p)) return "anel";
  if (/brinco|colar|corrente|gargantilha|pulseira|relogio|escapulario|pingente|caixa|caixinha/.test(p)) return "sem_numeracao";
  return "desconhecida";
}

/**
 * A numeração como o vendedor escreveu, em números de aro. "17 e 23", "18 E
 * 19", "17/16" e "12,25" são dois aros; "17,5" é um aro com meio número.
 * Devolve `null` quando aparece algo que não é aro (um "2mm" escrito no campo
 * errado, um 120): aí é ambíguo, e ambíguo não vira palpite.
 */
export function lerNumeracao(texto: string | null | undefined): string[] | null {
  const t = (texto ?? "").trim();
  if (!t) return [];
  // Medida em milímetro no campo de numeração é engano de campo, não aro.
  if (/\d\s*mm\b/i.test(t)) return null;
  const achados = t.match(/\d+(?:[.,]5(?!\d))?/g) ?? [];
  const aros: string[] = [];
  for (const a of achados) {
    const n = Number(a.replace(",", "."));
    if (!Number.isFinite(n) || n < ARO_MINIMO || n > ARO_MAXIMO) return null;
    aros.push(a.replace(".", ","));
  }
  return aros;
}

function quantidadeDoCampo(v: string | null): number | null {
  if (!v) return null;
  const n = Number(v.replace(",", "."));
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** O que a fábrica precisa saber da peça além do nome, numa linha de "Detalhes". */
function detalhesDaPeca(campos: Campo[], jaNoNome: string[]): string {
  const partes: string[] = [];
  const pega = (rotulo: string, nome: string) => {
    const v = campo(campos, nome);
    if (v && !jaNoNome.some((n) => n.includes(v))) partes.push(rotulo ? `${rotulo} ${v}` : v);
  };
  pega("Metal", CAMPOS_DA_FABRICA.metal);
  pega("", CAMPOS_DA_FABRICA.quilates);
  pega("Modelo", CAMPOS_DA_FABRICA.modelo);
  pega("", CAMPOS_DA_FABRICA.tipoDeJoia);
  pega("Largura", CAMPOS_DA_FABRICA.milimetros);
  pega("Joia:", CAMPOS_DA_FABRICA.joia);
  pega("Personalizado:", CAMPOS_DA_FABRICA.personalizados);
  return partes.join(", ").slice(0, 300);
}

/**
 * Lê a produção de um negócio da Kommo. Devolve o formulário preenchido com o
 * que deu para ler, para a fábrica (completo), para alguém completar
 * (incompleta, com os motivos) ou para ninguém, se ninguém pedir (fora).
 */
export function lerProducaoDaKommo(campos: Campo[] | null | undefined): LeituraDaFabrica {
  const cs = campos ?? [];
  const produto = campo(cs, CAMPOS_DA_FABRICA.produto);
  const tipoDeProduto = campo(cs, CAMPOS_DA_FABRICA.tipoDeProduto);
  const metal = campo(cs, CAMPOS_DA_FABRICA.metal);
  const gravura = campo(cs, CAMPOS_DA_FABRICA.gravura);
  const conjunto = semAcento(campo(cs, CAMPOS_DA_FABRICA.conjunto) ?? "") === "sim";
  const quantidade = quantidadeDoCampo(campo(cs, CAMPOS_DA_FABRICA.quantidade));
  const loja = campo(cs, CAMPOS_DA_FABRICA.loja);
  const familia = familiaDaPeca(tipoDeProduto, produto);
  const motivos: string[] = [];

  // O nome da peça: o "Produto" como o vendedor escreveu, ou o tipo com o metal ("Alianças de Prata").
  let nome = "";
  if (produto) nome = produto;
  else if (tipoDeProduto && metal) nome = `${tipoDeProduto} de ${metal}`;
  else if (tipoDeProduto) motivos.push(`Não sei qual peça: a Kommo diz "${tipoDeProduto}" sem o Metal nem o Produto`);
  else motivos.push("Não sei qual peça: falta o Produto ou o Tipo de Produto na Kommo");
  nome = nome.slice(0, 200);

  const peca: PecaDoFormulario = {
    nome, codigo: null, quantidade: 1, aro1: "", aro2: "", anel: "",
    gravacao: gravura ? "a_confirmar" : "sem", gravar1: gravura ?? "", gravar2: "",
    detalhes: detalhesDaPeca(cs, [nome]),
  };

  // A numeração, aro por aro.
  const textoDaNumeracao = campo(cs, CAMPOS_DA_FABRICA.numeracao);
  const aros = lerNumeracao(textoDaNumeracao);
  if (aros === null) {
    motivos.push(`Não dá para ler a numeração "${textoDaNumeracao}" sem chutar`);
  } else if (familia === "aliancas") {
    const esperado = conjunto ? 3 : 2;
    if (aros.length < esperado) {
      // O que veio já entra no formulário, para quem completar escrever só o que falta.
      peca.aro1 = aros[0] ?? "";
      peca.aro2 = aros[1] ?? "";
      if (aros.length === 0) motivos.push(conjunto ? "Falta a numeração dos dois aros e do anel do conjunto" : "Falta a numeração dos dois aros");
      else if (aros.length === 1) motivos.push("Falta a numeração do segundo aro");
      else motivos.push("Falta a numeração do anel do conjunto (Contém conjunto? Sim)");
    } else if (aros.length > esperado) {
      motivos.push(`A numeração tem ${aros.length} números para ${esperado} ${conjunto ? "peças (par e anel)" : "aros"}`);
    } else {
      peca.aro1 = aros[0];
      peca.aro2 = aros[1];
      if (conjunto) peca.anel = aros[2];
    }
    // "1" é um par; o número de peças do par (2, ou 3 com o anel) também. Outro número pode ser mais de um par: não dá para saber.
    if (quantidade !== null && quantidade !== 1 && quantidade !== esperado) {
      motivos.push(`Quantidade de produtos ${quantidade} não bate com ${conjunto ? "um par com anel" : "um par"}: diga a numeração de cada peça`);
    }
  } else if (familia === "anel") {
    if (aros.length === 0) motivos.push("Falta a numeração do anel");
    else if (aros.length > 1) motivos.push(`A numeração tem ${aros.length} números para um anel`);
    else peca.aro1 = aros[0];
    if (quantidade !== null && quantidade > 1) motivos.push(`Quantidade de produtos ${quantidade}: diga a numeração de cada anel`);
  } else if (familia === "desconhecida" && nome) {
    motivos.push("Não sei se a peça leva numeração: falta o Tipo de Produto na Kommo");
  }

  // A entrega: retirada na loja física do campo "Loja"; sem loja física, a combinar.
  const formulario: ProducaoDoFormulario = loja && !LOJA_SEM_RETIRADA.test(loja)
    ? { pecas: [peca], entrega: "retirada", loja, endereco: "", cidade: "", uf: "" }
    : { pecas: [peca], entrega: "a_combinar", loja: "", endereco: "", cidade: "", uf: "" };

  if (motivos.length) return { tipo: "incompleta", motivos: motivos.map((m) => m.replace(/[—–]/g, ",")), formulario };
  // Peça sem numeração e sem gravação (relógio, corrente, brinco): não é trabalho de bancada por definição, e o painel não decide sozinho.
  if (familia === "sem_numeracao" && !gravura) {
    return { tipo: "fora", motivos: [`${tipoDeProduto ?? "A peça"} sem numeração nem gravação: não foi sozinha para a fábrica`], formulario };
  }
  return { tipo: "fabrica", formulario };
}

// ---------------------------------------------------------------------------
// A tela: o que `kommo_fabrica_lista` devolve.
// ---------------------------------------------------------------------------

export type EstadoNaFabrica = "fabrica" | "incompleta" | "fora";

export type FaltaNaFabrica = {
  negocio_id: number;
  venda_id: string;
  negocio: string | null;
  cliente: string | null;
  dia: string | null;
  vendedor: string | null;
  estado: EstadoNaFabrica;
  motivos: string[];
  pode_completar: boolean;
  link: string;
};

export function lerFaltasNaFabrica(data: unknown): FaltaNaFabrica[] {
  if (!Array.isArray(data)) return [];
  return data.map((x) => {
    const d = (x ?? {}) as Record<string, unknown>;
    const id = Number(d.negocio_id);
    return {
      negocio_id: id,
      venda_id: String(d.venda_id ?? ""),
      negocio: (d.negocio as string) ?? null,
      cliente: (d.cliente as string) ?? null,
      dia: (d.dia as string) ?? null,
      vendedor: (d.vendedor as string) ?? null,
      estado: (d.estado === "fora" ? "fora" : d.estado === "fabrica" ? "fabrica" : "incompleta") as EstadoNaFabrica,
      motivos: Array.isArray(d.motivos) ? d.motivos.map(String) : [],
      pode_completar: d.pode_completar === true,
      link: `https://kathleengfz.kommo.com/leads/detail/${id}`,
    };
  });
}
