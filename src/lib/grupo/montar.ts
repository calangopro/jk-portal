import { campanhaDoDia } from "@/lib/bio/agenda";
import { blocoNovo, type Bio, type BlocoDaBio, type BlocoDe, type TemaDaBio } from "@/lib/bio/tipos";
import type { ConfigDoGrupo } from "./tipos";

/** Tudo que a página /grupo desenha num dia. */
export type PaginaDoGrupoNoDia = {
  tema: TemaDaBio;
  /** Textos do formulário, os da campanha do dia. */
  captura: BlocoDe<"captura">;
  /** A oferta com contador da campanha, quando existe e está visível. */
  oferta: BlocoDe<"campanha"> | null;
  /** Último dia da campanha, para o contador sem data própria. */
  fim: string | null;
  /** Código da campanha nos eventos (`esq`, `black`), vazio fora de campanha. */
  codigo: string;
};

function acharCaptura(blocos: BlocoDaBio[]): BlocoDe<"captura"> | null {
  // Vale mesmo oculto na bio: esconder o botão na bio não pode apagar a página
  // do anúncio, que é outra porta.
  return (blocos.find((b) => b.tipo === "captura") as BlocoDe<"captura"> | undefined) ?? null;
}

/**
 * A página do dia, a partir da bio.
 *
 * O formulário usa os textos do bloco de captura da campanha no ar; sem
 * campanha, os da bio Normal; sem nenhum, os de fábrica. O visual acompanha a
 * campanha, a não ser que o painel fixe um tema.
 */
export function paginaDoGrupoNoDia(bio: Bio, grupo: ConfigDoGrupo, hoje: string): PaginaDoGrupoNoDia {
  const campanha = campanhaDoDia(bio, hoje);
  const blocos = campanha?.blocos ?? bio.normal.blocos;

  const textos =
    acharCaptura(blocos) ?? acharCaptura(bio.normal.blocos) ?? (blocoNovo("captura", "captura") as BlocoDe<"captura">);
  // Sem a pergunta do momento do casal: na página do anúncio vale o menor
  // formulário possível (pedido do gestor de tráfego, "no máximo e-mail e
  // telefone"). Na folha da bio ela continua, como o painel mandar.
  const captura = { ...textos, momento: false };

  const oferta =
    (blocos.find((b) => b.tipo === "campanha" && b.visivel) as BlocoDe<"campanha"> | undefined) ?? null;

  const tema: TemaDaBio = grupo.tema === "campanha" ? (campanha?.tema ?? "padrao") : grupo.tema;

  return { tema, captura, oferta, fim: campanha?.fim ?? null, codigo: campanha?.id ?? "" };
}
