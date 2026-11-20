"use server";

import { abrirGarantia, registrarGarantia, type GarantiaAberta } from "@/lib/garantia/dados";
import { dataDoFormulario, digitosValidos, lerCodigo } from "@/lib/garantia/garantia";

/**
 * As duas ações da página pública da garantia (cartão 65). Não há sessão: quem
 * prova que é o dono da garantia são os 4 últimos números do telefone do
 * pedido, e a trava de tentativas mora no banco (`garantia_abrir`).
 */
export async function abrir(codigo: string, digitos: string): Promise<GarantiaAberta> {
  const c = lerCodigo(codigo);
  if (!c || !digitosValidos(digitos)) return { ok: false, motivo: "errado" };
  return abrirGarantia(c, digitos);
}

export async function registrar(
  codigo: string,
  digitos: string,
  f: { par_nome: string; aniversario: string; aniversario_par: string; data_namoro: string; data_casamento: string; aceite: boolean },
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const c = lerCodigo(codigo);
  if (!c || !digitosValidos(digitos)) return { ok: false, motivo: "errado" };
  if (f?.aceite !== true) return { ok: false, motivo: "sem_aceite" };
  return registrarGarantia(c, digitos, {
    par_nome: typeof f.par_nome === "string" ? f.par_nome.trim().slice(0, 120) || null : null,
    aniversario: dataDoFormulario(f.aniversario),
    aniversario_par: dataDoFormulario(f.aniversario_par),
    data_namoro: dataDoFormulario(f.data_namoro),
    data_casamento: dataDoFormulario(f.data_casamento),
    aceite: true,
  });
}
