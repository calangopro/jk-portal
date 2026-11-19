import { GRUPOS, type GrupoDeNivel, type Passo, type Tutorial } from "./tipos.ts";

/** Em que grupo cada nível do painel cai. Nível desconhecido cai em conteúdo, o mais fechado. */
export function grupoDoPapel(papel: string | null | undefined): GrupoDeNivel {
  switch (papel) {
    case "admin":
    case "dono":
    case "gm":
      return "diretoria";
    case "gerente":
      return "gerente";
    case "vendas":
      return "vendas";
    case "fabrica":
      return "fabrica";
    case "trafego":
      return "trafego";
    case "social":
      return "social_media";
    default:
      return "conteudo";
  }
}

/** Os passos que esse grupo vê: a versão dele, ou a de todos. */
export function passosPara(tutorial: Tutorial, grupo: GrupoDeNivel): Passo[] {
  return tutorial.versoes[grupo] ?? tutorial.versoes.todos;
}

/** Os grupos que têm versão própria nesse tutorial (a de todos fica de fora). */
export function gruposComVersao(tutorial: Tutorial): GrupoDeNivel[] {
  return GRUPOS.filter((g) => tutorial.versoes[g]);
}
