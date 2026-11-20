import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { lerGarantiaPublica } from "@/lib/garantia/dados";
import { codigoEmBlocos, lerCodigo } from "@/lib/garantia/garantia";
import { nomeLimpo } from "@/lib/vendas/origem";
import { abrir, registrar } from "./actions";
import { AbrirGarantia } from "./AbrirGarantia";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Garantia JK Alianças",
  robots: { index: false, follow: false },
};

/**
 * A garantia digital, aberta pelo QR do cartão (cartão 65).
 *
 * Mostra sem pedir nada só o que não é dado pessoal: as peças, a data, o
 * número do pedido e da OS, e os benefícios que a JK aprovou na base de fatos.
 * Benefício nunca sai do código: sem fato aprovado, a página manda falar com a
 * loja. O nome, o texto da gravação e o registro do casal abrem com os 4
 * últimos números do telefone (`AbrirGarantia`).
 */
export default async function GarantiaPage({ params }: { params: Promise<{ codigo: string }> }) {
  const codigo = lerCodigo((await params).codigo);
  if (!codigo) notFound();
  const g = await lerGarantiaPublica(codigo);
  if (!g) notFound();
  const emitida = g.emitidaEm ? new Date(g.emitidaEm).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : null;

  return (
    <main className="min-h-dvh bg-[#f7f3ec] px-4 py-8 text-[#1a1815]">
      <div className="mx-auto max-w-lg">
        <Link href="/" className="inline-block">
          <Image src="/logo.png" alt="JK Alianças" width={120} height={40} className="h-10 w-auto" priority />
        </Link>

        <section className="mt-6 rounded-[22px] bg-white p-5 shadow-[0_10px_30px_rgba(26,24,21,0.08)]">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[#84663c]">
            <ShieldCheck size={16} aria-hidden="true" /> Certificado de garantia
          </p>
          <h1 className="mt-2 text-2xl font-semibold leading-tight">Sua peça JK Alianças</h1>
          <p className="numeros mt-1 text-sm text-[#5d5850]">
            Código <span className="font-bold text-[#1a1815]">{codigoEmBlocos(g.codigo)}</span>
          </p>

          <ul className="mt-4 space-y-1.5 border-t border-[#1a1815]/10 pt-4 text-sm">
            {g.pecas.map((p, i) => (
              <li key={i} className="font-semibold">
                <span className="numeros">{p.quantidade}×</span> {nomeLimpo(p.nome)}
              </li>
            ))}
          </ul>
          <dl className="numeros mt-4 grid grid-cols-2 gap-3 text-sm">
            {emitida ? (
              <div>
                <dt className="text-xs text-[#5d5850]">Emitida em</dt>
                <dd className="font-semibold">{emitida}</dd>
              </div>
            ) : null}
            {g.pedido ? (
              <div>
                <dt className="text-xs text-[#5d5850]">Pedido</dt>
                <dd className="font-semibold">{g.pedido}</dd>
              </div>
            ) : null}
            {g.os ? (
              <div>
                <dt className="text-xs text-[#5d5850]">Ordem de serviço</dt>
                <dd className="font-semibold">{g.os}</dd>
              </div>
            ) : null}
          </dl>
        </section>

        <section className="mt-4 rounded-[22px] bg-white p-5">
          <h2 className="text-lg font-semibold">Seus benefícios</h2>
          {g.beneficios.length ? (
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed">
              {g.beneficios.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm leading-relaxed text-[#5d5850]">
              Para saber o que a sua garantia cobre, fale com a loja onde você comprou ou com o nosso atendimento, com o código acima
              em mãos.{" "}
              <Link href="/lojas" className="font-semibold text-[#1a1815] underline underline-offset-2">Ver as lojas</Link>
            </p>
          )}
        </section>

        <AbrirGarantia codigo={g.codigo} registrada={g.registrada} travada={g.travada} abrir={abrir} registrar={registrar} />

        <p className="mt-6 text-center text-xs text-[#5d5850]">
          Guarde este endereço: é a sua garantia. Os dados do registro ficam com a JK Alianças e servem para lembrar as suas datas.
        </p>
      </div>
    </main>
  );
}
