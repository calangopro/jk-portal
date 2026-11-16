import "server-only";
import type { RedeId } from "../redes";
import type { ModuloDaRede } from "../tipos";
import { facebook } from "./facebook";
import { instagram } from "./instagram";
import { youtube } from "./youtube";

/**
 * O registro dos módulos das redes. Quem usa (ligações, leitura, fila,
 * conector) pede o módulo por aqui e só fala com o contrato de `tipos.ts`.
 *
 * Rede sem módulo devolve null, e cada chamador diz isso do seu jeito: a tela
 * de ligações mostra "em breve", a fila marca a peça com o motivo. Rede nova
 * entra com o arquivo dela e uma linha neste mapa.
 */
const MODULOS: Partial<Record<RedeId, ModuloDaRede>> = {
  instagram,
  facebook,
  youtube,
};

export const modulo = (id: RedeId | string | null | undefined): ModuloDaRede | null => MODULOS[id as RedeId] ?? null;

export const redesComModulo = (): RedeId[] => Object.keys(MODULOS) as RedeId[];
