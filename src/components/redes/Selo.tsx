import { rede as acharRede, type RedeId } from "@/lib/redes/redes";

/**
 * O selo de uma rede: quadradinho na cor dela com a sigla em branco.
 *
 * Não é o logotipo da rede, de propósito: logotipo tem regra de uso de cada
 * empresa, e duas letras resolvem o reconhecimento. É decorativo
 * (`aria-hidden`): quem usa o selo escreve o nome da rede ao lado.
 */
const SIGLA: Record<RedeId, string> = {
  instagram: "IG",
  facebook: "FB",
  threads: "TH",
  youtube: "YT",
  tiktok: "TT",
  pinterest: "PI",
  linkedin: "IN",
  x: "X",
  kwai: "KW",
};

export function SeloDaRede({ id, tamanho = 28 }: { id: RedeId; tamanho?: number }) {
  const r = acharRede(id);
  return (
    <span
      aria-hidden="true"
      className="grid shrink-0 place-items-center rounded-[8px] font-bold leading-none tracking-tight text-white"
      style={{ width: tamanho, height: tamanho, background: r?.cor ?? "#111111", fontSize: Math.max(9, Math.round(tamanho * 0.38)) }}
    >
      {SIGLA[id] ?? "?"}
    </span>
  );
}
