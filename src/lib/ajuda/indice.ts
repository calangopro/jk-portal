import type { Tutorial } from "./tipos.ts";
import { hoje } from "./tutoriais/hoje.ts";
import { pedidosDoSite } from "./tutoriais/pedidos-do-site.ts";
import { vendasDaKommo } from "./tutoriais/vendas-da-kommo.ts";
import { clientes } from "./tutoriais/clientes.ts";
import { oportunidades } from "./tutoriais/oportunidades.ts";
import { consulta } from "./tutoriais/consulta.ts";
import { suporte } from "./tutoriais/suporte.ts";
import { tutor } from "./tutoriais/tutor.ts";
import { biblioteca } from "./tutoriais/biblioteca.ts";
import { chat } from "./tutoriais/chat.ts";
import { registrarVenda } from "./tutoriais/registrar-venda.ts";

/**
 * Todos os tutoriais do painel. Tutorial novo: um arquivo em `tutoriais/` e uma
 * linha aqui (veja `docs/como-usar.md`).
 */
export const TUTORIAIS: Tutorial[] = [hoje, registrarVenda, pedidosDoSite, vendasDaKommo, clientes, oportunidades, consulta, suporte, tutor, biblioteca, chat];

export function tutorialDaTela(href: string): Tutorial | null {
  return TUTORIAIS.find((t) => t.href === href) ?? null;
}
