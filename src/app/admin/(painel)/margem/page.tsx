import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { listarCatalogo } from "@/lib/catalogo/fotos";
import { lerFamilias, margensDoCatalogo } from "@/lib/margem/dados";
import { porcento, reais } from "@/lib/margem/calculo";
import { FormParametros, ImportarPlanilha, TabelaDeFamilias } from "./PainelDeMargem";

export const metadata = { title: "Margem" };

/**
 * Custo e margem do catálogo. Só administrador: é custo da empresa.
 *
 * O topo responde a pergunta da Black: quais produtos já estão com promoção
 * abaixo da margem mínima, e quais nem custo têm. Embaixo fica o que o dono
 * preenche (preço do grama, taxas e o peso de cada família de ouro), igual à
 * planilha que foi para ele, que também pode ser importada aqui.
 */
export default async function MargemPage() {
  await requireAdmin();
  const db = await createClient();
  const itens = (await listarCatalogo(db)).filter((p) => p.disponivel);
  const [{ parametros, porProduto }, familias] = await Promise.all([margensDoCatalogo(db, itens), lerFamilias(db)]);

  const comCusto = itens.filter((p) => porProduto[p.id]?.custo !== null);
  const porVenda = (a: { vendidos: number }, b: { vendidos: number }) => b.vendidos - a.vendidos;
  const hojePassa = itens.filter((p) => porProduto[p.id]?.margem?.hojePassa).sort(porVenda);
  const abaixo = itens.filter((p) => porProduto[p.id]?.margem?.abaixoDoMinimo).sort(porVenda);
  const semCustoMaisVendidos = itens.filter((p) => porProduto[p.id]?.custo === null).sort(porVenda).slice(0, 10);

  return (
    <div data-painel-largo>
      <header>
        <p className="eyebrow">Loja</p>
        <h1 className="font-display mt-2 text-4xl text-ink">Margem</h1>
        <p className="mt-3 max-w-2xl text-muted">
          Quanto sobra em cada peça e até quanto dá para dar de desconto. Só administradores veem esta tela.
        </p>
      </header>

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        <Numero rotulo="Produtos com custo" valor={`${comCusto.length} de ${itens.length}`} />
        <Numero
          rotulo="Promoção de hoje abaixo da margem mínima"
          valor={String(hojePassa.length)}
          alerta={hojePassa.length > 0}
        />
        <Numero rotulo="Abaixo da margem mínima no preço cheio" valor={String(abaixo.length)} alerta={abaixo.length > 0} />
      </section>

      {parametros.margemMinima === null ? (
        <p className="mt-4 rounded-[12px] bg-brand/10 px-4 py-3 text-sm text-brand-strong">
          Sem margem mínima definida, nenhum produto aparece como abaixo do limite. Preencha nos parâmetros.
        </p>
      ) : null}

      {hojePassa.length ? (
        <Lista
          titulo="Promoção de hoje abaixo da margem mínima"
          explica="A promoção que está valendo na loja deixa menos do que a margem mínima. Vale rever antes da Black."
          linhas={hojePassa.slice(0, 15).map((p) => {
            const m = porProduto[p.id].margem!;
            return {
              codigo: p.trayId,
              nome: p.nome,
              direita: `${porcento(m.descontoHoje ?? 0, 0)} de desconto hoje, máximo ${porcento(m.descontoMaximo, 0)}. Margem hoje ${porcento(m.fracaoHoje ?? 0)}`,
            };
          })}
          resto={hojePassa.length - 15}
        />
      ) : null}

      {abaixo.length ? (
        <Lista
          titulo="Abaixo da margem mínima no preço cheio"
          explica="Mesmo sem desconto, a peça deixa menos que a margem mínima. Ou o custo está errado, ou o preço precisa subir."
          linhas={abaixo.slice(0, 15).map((p) => {
            const m = porProduto[p.id].margem!;
            return { codigo: p.trayId, nome: p.nome, direita: `Margem ${porcento(m.fracao)} (${reais(m.reais)})` };
          })}
          resto={abaixo.length - 15}
        />
      ) : null}

      <section className="mt-8 grid gap-5 xl:grid-cols-2">
        <FormParametros inicial={parametros} />
        <ImportarPlanilha />
      </section>

      <TabelaDeFamilias familias={familias} parametros={parametros} />

      {semCustoMaisVendidos.length ? (
        <Lista
          titulo="Mais vendidos ainda sem custo"
          explica="O custo se preenche na planilha do dono ou na gaveta do produto, em Produtos."
          linhas={semCustoMaisVendidos.map((p) => ({
            codigo: p.trayId,
            nome: p.nome,
            direita: porProduto[p.id].falta ?? "Sem custo",
          }))}
        />
      ) : null}
    </div>
  );
}

function Numero({ rotulo, valor, alerta = false }: { rotulo: string; valor: string; alerta?: boolean }) {
  return (
    <div className={`glass rounded-[18px] p-5 ${alerta ? "ring-1 ring-wine/40" : ""}`}>
      <p className={`font-display text-3xl ${alerta ? "text-wine" : "text-ink"}`}>{valor}</p>
      <p className="mt-1 text-sm text-muted">{rotulo}</p>
    </div>
  );
}

function Lista({
  titulo,
  explica,
  linhas,
  resto = 0,
}: {
  titulo: string;
  explica: string;
  linhas: { codigo: string; nome: string; direita: string }[];
  resto?: number;
}) {
  return (
    <section className="glass mt-6 rounded-[20px] p-5">
      <p className="flex items-center gap-2 text-sm font-semibold text-ink">
        <AlertTriangle size={15} className="text-wine" /> {titulo}
      </p>
      <p className="mt-1 text-sm text-muted">{explica}</p>
      <ul className="mt-3 divide-y divide-border/60">
        {linhas.map((l) => (
          <li key={l.codigo} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2 text-sm">
            <Link href={`/admin/produtos?p=${l.codigo}`} className="min-w-0 flex-1 break-words text-ink hover:text-brand-nav hover:underline">
              {l.nome}
            </Link>
            <span className="text-xs text-muted">{l.direita}</span>
          </li>
        ))}
      </ul>
      {resto > 0 ? <p className="mt-2 text-xs text-muted">E mais {resto}. Veja todos em Produtos, com o filtro de margem.</p> : null}
    </section>
  );
}
