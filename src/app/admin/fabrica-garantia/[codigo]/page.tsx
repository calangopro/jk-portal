import { notFound, redirect } from "next/navigation";
import { SEM_ACESSO, requireSessao } from "@/lib/auth/session";
import { lerGarantiaParaImprimir } from "@/lib/garantia/dados";
import { codigoEmBlocos, lerCodigo } from "@/lib/garantia/garantia";
import { qrEmSvg } from "@/lib/qrcode/arte";
import { absoluteUrl } from "@/lib/seo/site";
import { createClient } from "@/lib/supabase/server";
import { Imprimir } from "./Imprimir";

export const metadata = { title: "Cartão de garantia" };

/**
 * O cartão de garantia para imprimir (cartão 65): tamanho de cartão de visita
 * (85 x 55 mm), com o QR que abre a garantia e o código por extenso, para quem
 * prefere digitar. Fica fora da moldura do painel: a página é só o cartão.
 *
 * O cartão não leva nome, telefone nem gravação: ele sai da loja dentro da
 * caixinha, e quem o achar no chão vê só o que a página pública mostra.
 */
export default async function CartaoDeGarantiaPage({ params }: { params: Promise<{ codigo: string }> }) {
  const quem = await requireSessao();
  if (!quem.areas.includes("fabrica") && !quem.areas.includes("lancar_venda")) redirect(SEM_ACESSO);
  const codigo = lerCodigo((await params).codigo);
  if (!codigo) notFound();
  const g = await lerGarantiaParaImprimir(await createClient(), codigo);
  if (!g) notFound();
  const endereco = absoluteUrl(`/garantia/${g.codigo}`);
  const qr = await qrEmSvg(endereco);

  return (
    <main className="min-h-dvh bg-[#e9e4da] p-6 print:bg-white print:p-0">
      <style>{`@page { size: 85mm 55mm; margin: 0; } @media print { body { margin: 0; } }`}</style>
      <div className="mx-auto mb-4 flex max-w-md items-center justify-between gap-3 print:hidden">
        <p className="text-sm text-[#5d5850]">Cartão de 85 x 55 mm. Na impressão, escolha tamanho real (100%).</p>
        <Imprimir />
      </div>
      <article
        className="mx-auto flex overflow-hidden bg-white text-[#1a1815] shadow-lg print:shadow-none"
        style={{ width: "85mm", height: "55mm", padding: "4mm", gap: "3mm" }}
      >
        <div className="flex min-w-0 flex-1 flex-col justify-between">
          <div>
            <p style={{ fontSize: "7pt", letterSpacing: "0.14em" }} className="font-bold uppercase text-[#84663c]">Garantia</p>
            <p style={{ fontSize: "12pt" }} className="font-semibold leading-tight">JK Alianças</p>
            <p style={{ fontSize: "6.5pt" }} className="mt-1 leading-snug text-[#5d5850]">
              Aponte a câmera para o QR e registre a sua garantia.
            </p>
          </div>
          <div>
            <p style={{ fontSize: "6pt" }} className="text-[#5d5850]">Código</p>
            <p style={{ fontSize: "10pt", letterSpacing: "0.08em" }} className="numeros font-bold">{codigoEmBlocos(g.codigo)}</p>
            <p style={{ fontSize: "6pt" }} className="numeros mt-0.5 text-[#5d5850]">
              {[g.pedido ? `Pedido ${g.pedido}` : null, g.os ? `OS ${g.os}` : null].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
        {/* O SVG do QR é gerado aqui no servidor, pela mesma biblioteca dos QR dos impressos. */}
        <div style={{ width: "40mm", height: "40mm" }} className="shrink-0 self-center [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: qr }} />
      </article>
      <p className="numeros mx-auto mt-3 max-w-md break-all text-center text-xs text-[#5d5850] print:hidden">{endereco}</p>
    </main>
  );
}
