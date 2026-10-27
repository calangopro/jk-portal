import Link from "next/link";
import { notFound } from "next/navigation";
import { Archive, ArchiveRestore, ArrowLeft, Download } from "lucide-react";
import { requireStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { COLUNAS_DO_QRCODE, enderecoCurto, enderecoDoQrcode, type Qrcode } from "@/lib/qrcode/tipos";
import { hojeEmSaoPaulo } from "@/lib/tray/preco";
import { comBasePath } from "@/lib/seo/base-path";
import { BotaoCopiar } from "../../bio/LinksParaDivulgar";
import { FormularioDoQrcode } from "../FormularioDoQrcode";
import { GraficoDeLeituras } from "../GraficoDeLeituras";
import { Numeros } from "../Numeros";
import { arquivarQrcode } from "../actions";
import { leiturasPorDia, resumoVazio, trintaDias, type Resumo } from "../dados";

export const metadata = { title: "QR code" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Um QR: a arte para baixar, para onde ele leva e quantas vezes foi lido. */
export default async function QrcodePage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const supabase = await createClient();
  const { data } = await supabase.from("qrcodes").select(COLUNAS_DO_QRCODE).eq("id", id).maybeSingle();
  if (!data) notFound();
  const q = data as Qrcode;

  const hoje = hojeEmSaoPaulo();
  const dias = trintaDias(hoje);
  const [resumo, noDia] = await Promise.all([
    supabase.from("qrcode_resumo").select("*").eq("qrcode", q.slug).maybeSingle(),
    leiturasPorDia(supabase, dias, q.slug),
  ]);

  // Caminho cru em <img> e <a>: o basePath entra na mão (ver CLAUDE.md).
  const arte = comBasePath(`/admin/qrcode/${q.id}/arte`);
  const principal = q.slug === "";

  return (
    <>
      <Link
        href="/admin/qrcode"
        className="inline-flex items-center gap-1 text-xs font-semibold text-brand-nav hover:underline"
      >
        <ArrowLeft size={13} aria-hidden />
        Todos os QR codes
      </Link>

      <header className="mt-4">
        <p className="eyebrow">{q.arquivado_em ? "QR code arquivado" : "QR code"}</p>
        <h1 className="font-display mt-2 break-words text-4xl text-ink">{q.nome}</h1>
      </header>

      <div className="mt-8 grid gap-5 lg:grid-cols-[18rem_1fr]">
        <section className="glass rounded-[18px] p-5">
          <h2 className="sr-only">Arte do QR</h2>
          {/* eslint-disable-next-line @next/next/no-img-element -- SVG gerado na hora, sem otimizador */}
          <img
            src={arte}
            alt={`QR code que leva a ${enderecoCurto(q.slug)}`}
            width={240}
            height={240}
            className="mx-auto block aspect-square w-full max-w-[15rem] rounded-[10px] bg-white"
          />
          <div className="mt-4 flex items-center gap-2 rounded-[12px] border border-border bg-white/70 p-2.5">
            <code className="min-w-0 flex-1 truncate text-xs font-semibold text-ink">{enderecoCurto(q.slug)}</code>
            <BotaoCopiar valor={enderecoDoQrcode(q.slug)} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <a
              href={`${arte}?baixar=1`}
              className="inline-flex items-center justify-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-ink hover:border-brand/50 hover:bg-white"
            >
              <Download size={13} aria-hidden />
              SVG
            </a>
            <a
              href={`${arte}?formato=png&baixar=1`}
              className="inline-flex items-center justify-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-ink hover:border-brand/50 hover:bg-white"
            >
              <Download size={13} aria-hidden />
              PNG
            </a>
          </div>
          <p className="mt-3 text-[0.7rem] leading-snug text-muted">
            SVG para a gráfica e para quem diagrama: não perde nitidez em tamanho nenhum. PNG em 2.400 px para o resto.
            Deixe o QR com pelo menos 2,5 cm de lado e a borda branca em volta.
          </p>
          {principal ? (
            <p className="mt-3 text-[0.7rem] leading-snug text-muted">
              É o endereço dos 36 adesivos dos banheiros do Shopping Tamboré. Não se arquiva.
            </p>
          ) : null}
        </section>

        <div className="min-w-0">
          <FormularioDoQrcode id={q.id} nome={q.nome} destino={q} />
        </div>
      </div>

      <section className="mt-10">
        <h2 className="font-display text-2xl text-ink">Leituras</h2>
        <div className="mt-4">
          <Numeros resumo={(resumo.data as Resumo | null) ?? resumoVazio(q.slug)} />
        </div>
        <GraficoDeLeituras dias={dias} noDia={noDia} hoje={hoje} />
      </section>

      {principal ? null : (
        <section className="glass mt-10 rounded-[18px] p-5">
          <h2 className="font-medium text-ink">{q.arquivado_em ? "Voltar para a lista" : "Arquivar"}</h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted">
            {q.arquivado_em
              ? "Este QR está fora da lista principal. Ele nunca parou de funcionar nem de contar."
              : "Tira o QR da lista principal. Ele continua levando ao destino e contando, porque o adesivo pode seguir colado em algum lugar. Dá para voltar quando quiser."}
          </p>
          <form action={arquivarQrcode} className="mt-3">
            <input type="hidden" name="id" value={q.id} />
            <input type="hidden" name="arquivar" value={q.arquivado_em ? "0" : "1"} />
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-ink hover:border-brand/50 hover:bg-white"
            >
              {q.arquivado_em ? <ArchiveRestore size={13} aria-hidden /> : <Archive size={13} aria-hidden />}
              {q.arquivado_em ? "Voltar para a lista" : "Arquivar este QR"}
            </button>
          </form>
        </section>
      )}
    </>
  );
}
