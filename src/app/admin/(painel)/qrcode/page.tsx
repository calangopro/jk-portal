import { requireStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { normalizarQrcode } from "@/lib/qrcode/tipos";
import { quandoLegivel } from "@/lib/content/agenda";
import { hojeEmSaoPaulo } from "@/lib/tray/preco";
import { ConfigDoQrcode } from "./ConfigDoQrcode";
import { GraficoDeLeituras } from "./GraficoDeLeituras";

export const metadata = { title: "QR code" };

/**
 * O QR code impresso: para onde ele leva e quantas vezes foi lido.
 *
 * A contagem sai de `qrcode_leituras`, gravada pelo próprio redirecionamento
 * (`app/(bio)/qrcode/route.ts`). O GA4 não enxerga essa visita, porque a pessoa
 * vai direto para o WhatsApp sem nenhuma página do site carregar no meio.
 */

type LinhaPorDia = { dia: string; origem: string; aparelho: "iphone" | "android" | "outro"; leituras: number };

const NOMES_DOS_APARELHOS = { iphone: "iPhone", android: "Android", outro: "Outro" } as const;

/** `AAAA-MM-DD` de `n` dias antes de `dia`, sem fuso no meio da conta. */
function diasAntes(dia: string, n: number): string {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

export default async function QrcodePage() {
  await requireStaff();
  const supabase = await createClient();

  const hoje = hojeEmSaoPaulo();
  const dias = Array.from({ length: 30 }, (_, i) => diasAntes(hoje, 29 - i));

  const [config, porDia, total, ultima] = await Promise.all([
    supabase.from("site_settings").select("value").eq("key", "pagina:qrcode").maybeSingle(),
    supabase.from("qrcode_leituras_por_dia").select("dia, origem, aparelho, leituras").gte("dia", dias[0]),
    supabase.from("qrcode_leituras").select("id", { count: "exact", head: true }),
    supabase.from("qrcode_leituras").select("lido_em").order("lido_em", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const linhas = (porDia.data ?? []) as LinhaPorDia[];
  const soma = (filtro: (l: LinhaPorDia) => boolean) =>
    linhas.filter(filtro).reduce((s, l) => s + l.leituras, 0);

  const noDia = new Map(dias.map((d) => [d, soma((l) => l.dia === d)]));
  const trintaDias = soma(() => true);

  const porAparelho = (["iphone", "android", "outro"] as const)
    .map((a) => ({ a, n: soma((l) => l.aparelho === a) }))
    .filter((x) => x.n > 0);

  const origens = [...new Set(linhas.map((l) => l.origem))]
    .map((o) => ({ o, n: soma((l) => l.origem === o) }))
    .sort((x, y) => y.n - x.n);

  return (
    <>
      <header>
        <p className="eyebrow">Site</p>
        <h1 className="font-display mt-2 text-4xl text-ink">QR code</h1>
        <p className="mt-3 max-w-2xl text-muted">
          O endereço que vai nos impressos (jkaliancas.com.br/qrcode), para onde ele leva e quantas pessoas leram.
        </p>
      </header>

      <div className="mt-8">
        <ConfigDoQrcode inicial={normalizarQrcode(config.data?.value)} />
      </div>

      <section className="mt-10">
        <h2 className="font-display text-2xl text-ink">Leituras</h2>
        <dl className="mt-4 grid gap-3 grid-cols-2 sm:grid-cols-4">
          {(
            [
              ["Hoje", noDia.get(hoje) ?? 0],
              ["Últimos 7 dias", soma((l) => l.dia >= dias[23])],
              ["Últimos 30 dias", trintaDias],
              ["Desde o início", total.count ?? 0],
            ] as const
          ).map(([rotulo, valor]) => (
            <div key={rotulo} className="glass rounded-[16px] p-4">
              <dt className="text-xs text-muted">{rotulo}</dt>
              <dd className="numeros mt-1 font-display text-3xl text-ink">{valor}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-muted">
          {ultima.data?.lido_em
            ? `Última leitura em ${quandoLegivel(ultima.data.lido_em)}.`
            : "Nenhuma leitura ainda."}{" "}
          Robô de prévia de link não entra na conta.
        </p>

        <GraficoDeLeituras dias={dias} noDia={noDia} hoje={hoje} />

        {trintaDias > 0 ? (
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <section className="glass rounded-[18px] p-5">
              <h3 className="text-sm font-medium text-ink">Aparelho, últimos 30 dias</h3>
              <ul className="mt-3 space-y-1.5 text-sm">
                {porAparelho.map(({ a, n }) => (
                  <li key={a} className="flex justify-between gap-3">
                    <span className="text-ink">{NOMES_DOS_APARELHOS[a]}</span>
                    <span className="numeros text-muted">
                      {n} ({Math.round((n / trintaDias) * 100)}%)
                    </span>
                  </li>
                ))}
              </ul>
            </section>
            <section className="glass rounded-[18px] p-5">
              <h3 className="text-sm font-medium text-ink">De qual impresso, últimos 30 dias</h3>
              <ul className="mt-3 space-y-1.5 text-sm">
                {origens.map(({ o, n }) => (
                  <li key={o || "-"} className="flex justify-between gap-3">
                    <span className="text-ink">{o ? `?o=${o}` : "Sem etiqueta (adesivos do Tamboré)"}</span>
                    <span className="numeros text-muted">{n}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        ) : null}
      </section>
    </>
  );
}
