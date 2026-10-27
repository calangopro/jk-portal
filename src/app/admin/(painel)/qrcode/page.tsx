import Link from "next/link";
import { Plus } from "lucide-react";
import { requireStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { COLUNAS_DO_QRCODE, destinoLegivel, enderecoCurto, type Qrcode } from "@/lib/qrcode/tipos";
import { quandoLegivel } from "@/lib/content/agenda";
import { hojeEmSaoPaulo } from "@/lib/tray/preco";
import { GraficoDeLeituras } from "./GraficoDeLeituras";
import { Numeros } from "./Numeros";
import { leiturasPorDia, resumoVazio, somar, trintaDias, type Resumo } from "./dados";

export const metadata = { title: "QR codes" };

/**
 * Os QR codes impressos: um por lugar, cada um com endereço, destino e
 * contagem próprios.
 *
 * A contagem sai de `qrcode_leituras`, gravada pelo próprio redirecionamento
 * (`lib/qrcode/servir.ts`). O GA4 não enxerga essa visita, porque a pessoa vai
 * direto para o WhatsApp sem nenhuma página do site carregar no meio.
 */

function Linha({ q, r }: { q: Qrcode; r: Resumo }) {
  return (
    <tr className="border-b border-border/60 align-top last:border-0">
      <td className="px-4 py-3">
        <Link href={`/admin/qrcode/${q.id}`} className="font-medium text-ink hover:text-brand-nav hover:underline">
          {q.nome}
        </Link>
        <span className="mt-0.5 block break-all text-xs text-muted">{enderecoCurto(q.slug)}</span>
      </td>
      <td className="px-4 py-3 text-xs text-muted">
        <span className="break-all">{destinoLegivel(q)}</span>
      </td>
      <td className="numeros px-4 py-3 text-right text-ink">{r.hoje}</td>
      <td className="numeros px-4 py-3 text-right text-ink">{r.ultimos_7}</td>
      <td className="numeros px-4 py-3 text-right text-ink">{r.ultimos_30}</td>
      <td className="numeros px-4 py-3 text-right font-semibold text-ink">{r.total}</td>
      <td className="whitespace-nowrap px-4 py-3 text-xs text-muted">{r.ultima ? quandoLegivel(r.ultima) : "nunca"}</td>
    </tr>
  );
}

function Tabela({ qrcodes, resumos }: { qrcodes: Qrcode[]; resumos: Map<string, Resumo> }) {
  return (
    <div className="overflow-x-auto rounded-[16px] border border-border bg-white/60">
      <table className="w-full min-w-[46rem] text-left text-sm">
        <thead className="border-b border-border text-xs text-muted">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium">Lugar</th>
            <th scope="col" className="px-4 py-3 font-medium">Leva para</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">Hoje</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">7 dias</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">30 dias</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">Total</th>
            <th scope="col" className="px-4 py-3 font-medium">Última leitura</th>
          </tr>
        </thead>
        <tbody>
          {qrcodes.map((q) => (
            <Linha key={q.id} q={q} r={resumos.get(q.slug) ?? resumoVazio(q.slug)} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function QrcodesPage() {
  await requireStaff();
  const supabase = await createClient();

  const hoje = hojeEmSaoPaulo();
  const dias = trintaDias(hoje);

  const [lista, resumo, noDia] = await Promise.all([
    supabase.from("qrcodes").select(COLUNAS_DO_QRCODE).order("criado_em", { ascending: true }),
    supabase.from("qrcode_resumo").select("*"),
    leiturasPorDia(supabase, dias),
  ]);

  const qrcodes = (lista.data ?? []) as Qrcode[];
  const resumos = new Map(((resumo.data ?? []) as Resumo[]).map((r) => [r.qrcode, r]));
  const ativos = qrcodes.filter((q) => !q.arquivado_em);
  const arquivados = qrcodes.filter((q) => q.arquivado_em);

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow">Site</p>
          <h1 className="font-display mt-2 text-4xl text-ink">QR codes</h1>
          <p className="mt-3 max-w-2xl text-muted">
            Um QR por lugar. Cada um tem o próprio endereço para imprimir e conta as leituras separado, então dá para
            saber de onde veio cada contato. O destino se troca aqui a qualquer hora, sem reimprimir.
          </p>
        </div>
        <Link
          href="/admin/qrcode/novo"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-xs font-semibold text-ink transition-colors hover:bg-brand-light"
        >
          <Plus size={14} aria-hidden />
          Novo QR code
        </Link>
      </header>

      <section className="mt-8">
        <h2 className="sr-only">Todos os QR codes</h2>
        <Tabela qrcodes={ativos} resumos={resumos} />
        {arquivados.length > 0 ? (
          <details className="mt-4">
            <summary className="cursor-pointer text-xs font-semibold text-brand-nav">
              Arquivados ({arquivados.length})
            </summary>
            <p className="mt-2 max-w-2xl text-xs leading-relaxed text-muted">
              Saíram da lista, mas continuam levando ao destino e contando: o adesivo pode seguir colado em algum lugar.
            </p>
            <div className="mt-3">
              <Tabela qrcodes={arquivados} resumos={resumos} />
            </div>
          </details>
        ) : null}
      </section>

      <section className="mt-10">
        <h2 className="font-display text-2xl text-ink">Leituras de todos os QR codes</h2>
        <div className="mt-4">
          <Numeros resumo={somar([...resumos.values()])} />
        </div>
        <GraficoDeLeituras dias={dias} noDia={noDia} hoje={hoje} />
      </section>
    </>
  );
}
