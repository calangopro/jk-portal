import Link from "next/link";
import { requireSessao, ROLE_LABEL, type Profile } from "@/lib/auth/session";
import { ehAdmin } from "@/lib/auth/acessos";
import { createClient } from "@/lib/supabase/server";
import { lerDespesas, somarDespesas } from "@/lib/custos/dados";
import { calcularSinais, type EntradaDosSinais } from "@/lib/painel/sinais";
import { lerResumoDeVendas, ultimaImportacao } from "@/lib/vendas/dados";
import { agruparPorCanal } from "@/lib/vendas/origem";
import { hojeEmSaoPaulo, primeiroDoMes, somarDias } from "@/lib/vendas/periodo";
import { lerFilaDeRecuperacao } from "@/lib/vendas/recuperacao";
import { PainelGeral, type DadosDeVendas } from "./PainelGeral";

/** Quantos dias o painel compara: os últimos 30 contra os 30 anteriores. */
const DIAS = 30;

/**
 * Visão geral: o painel de cada pessoa, montado pelo nível de acesso dela.
 *
 * Quem tem a área de vendas vê os números dos últimos 30 dias contra os 30
 * anteriores, os gráficos e os sinais (problemas e oportunidades). Quem só tem
 * recuperação vê a fila como sinal. Quem cuida de conteúdo vê os contadores
 * editoriais. Cada leitura só acontece se a área estiver liberada, e o banco
 * confere de novo: pedir sem ter a área devolve vazio.
 *
 * Esta rota aceita qualquer pessoa ativa (`requireSessao`), porque é para onde
 * as outras telas mandam quem não tem acesso a elas.
 */
async function lerPainel(profile: Profile) {
  const db = await createClient();
  const pode = (area: Profile["areas"][number]) => profile.areas.includes(area);
  const hoje = hojeEmSaoPaulo();
  const de = somarDias(hoje, -(DIAS - 1));

  const [atual, anterior, ultima, fila, despesas, doMes] = await Promise.all([
    pode("vendas") ? lerResumoDeVendas(db, de, hoje) : null,
    pode("vendas") ? lerResumoDeVendas(db, somarDias(de, -DIAS), somarDias(de, -1)) : null,
    pode("vendas") ? ultimaImportacao(db) : null,
    pode("recuperacao") ? lerFilaDeRecuperacao(db, 14) : null,
    ehAdmin(profile.role) ? lerDespesas(db) : null,
    ehAdmin(profile.role) ? lerResumoDeVendas(db, primeiroDoMes(hoje), hoje) : null,
  ]);

  const vendas: DadosDeVendas | null = atual ? { atual, anterior, dias: DIAS, de, ate: hoje } : null;

  let custos: EntradaDosSinais["custos"] = null;
  if (despesas && doMes) {
    const t = somarDespesas(despesas);
    const diasNoMes = new Date(Date.UTC(Number(hoje.slice(0, 4)), Number(hoje.slice(5, 7)), 0)).getUTCDate();
    custos = {
      custoAteHoje: (t.mensal * Number(hoje.slice(8, 10))) / diasNoMes + t.porPedido * doMes.totais.pagos,
      faturamento: Number(doMes.totais.valor_pago),
    };
  }

  const aRecuperar = fila?.resumo.a_recuperar;
  const sinais = atual
    ? calcularSinais({
        atual: { ...atual, canais: agruparPorCanal(atual.por_origem) },
        anterior: anterior ? { ...anterior, canais: agruparPorCanal(anterior.por_origem) } : null,
        dias: DIAS,
        recuperar: aRecuperar ? { clientes: aRecuperar.clientes, valor: Number(aRecuperar.valor) } : null,
        custos,
        horasDesdeALeitura: ultima ? (Date.now() - Date.parse(ultima.quando)) / 3_600_000 : null,
      })
    : aRecuperar && aRecuperar.clientes > 0
      ? [
          {
            chave: "fila-de-recuperacao",
            gravidade: "oportunidade" as const,
            peso: Number(aRecuperar.valor),
            titulo: `${aRecuperar.clientes} ${aRecuperar.clientes === 1 ? "cliente" : "clientes"} para chamar na fila de recuperação`,
            texto: "São pessoas que criaram pedido na loja nos últimos 14 dias, não pagaram e ninguém chamou. A fila está por ordem de valor.",
            link: { href: "/admin/recuperacao", rotulo: "Abrir a fila" },
          },
        ]
      : [];

  return { vendas, sinais };
}

async function lerConteudo() {
  const db = await createClient();
  const [contents, published, media, products, pendingComments] = await Promise.all([
    db.from("contents").select("*", { count: "exact", head: true }),
    db.from("contents").select("*", { count: "exact", head: true }).eq("status", "published"),
    db.from("media").select("*", { count: "exact", head: true }),
    db.from("products").select("*", { count: "exact", head: true }),
    db.from("comments").select("*", { count: "exact", head: true }).eq("status", "pending"),
  ]);
  return [
    { label: "Conteúdos", value: contents.count ?? 0, hint: `${published.count ?? 0} publicados`, href: "/admin/conteudos" },
    { label: "Imagens", value: media.count ?? 0, hint: "biblioteca de mídia", href: "/admin/midia" },
    { label: "Produtos", value: products.count ?? 0, hint: "sincronizados da Tray", href: "/admin/produtos" },
    { label: "Comentários", value: pendingComments.count ?? 0, hint: "aguardando moderação", href: "/admin/comentarios" },
  ];
}

export default async function AdminDashboard() {
  const profile = await requireSessao();
  const [{ vendas, sinais }, conteudo] = await Promise.all([
    lerPainel(profile),
    profile.areas.includes("conteudo") ? lerConteudo() : null,
  ]);
  const semNada = !vendas && sinais.length === 0 && !conteudo;

  return (
    <div data-painel-largo>
      <header>
        <p className="eyebrow">Visão geral</p>
        <h1 className="font-display mt-2 text-4xl text-ink">Olá, {(profile.fullName ?? "equipe").split(" ")[0]}</h1>
        <p className="mt-3 text-muted">
          Seu acesso é de {ROLE_LABEL[profile.role] ?? profile.role}. Aqui fica o que pede atenção hoje.
        </p>
      </header>

      <PainelGeral vendas={vendas} sinais={sinais} />

      {conteudo ? (
        <section className="mt-10" aria-label="Conteúdo do site">
          <p className="eyebrow">Site</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {conteudo.map((c) => (
              <Link key={c.label} href={c.href} className="glass rounded-[18px] p-5 transition-colors hover:border-brand/50">
                <p className="eyebrow text-[0.62rem]">{c.label}</p>
                <p className="font-display numeros mt-2 text-3xl text-ink">{c.value}</p>
                <p className="mt-1 text-xs text-muted">{c.hint}</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {semNada ? (
        <p className="glass mt-9 rounded-[18px] p-6 text-sm text-muted">
          <span className="font-semibold text-ink">Ainda não há nada liberado para o seu acesso.</span> A área da fábrica
          está sendo construída. Quando ela entrar no ar, aparece aqui e no menu ao lado.
        </p>
      ) : null}
    </div>
  );
}
