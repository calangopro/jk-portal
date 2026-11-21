import { Suspense } from "react";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { requireSessao, ROLE_LABEL } from "@/lib/auth/session";
import { ehAdmin } from "@/lib/auth/acessos";
import { Skeleton } from "@/components/ui/states";
import { ChatParaMim } from "./ChatParaMim";
import { definirMeta } from "./meta-actions";
import { MetaDoMes } from "./MetaDoMes";
import { MeuMesNoInicio } from "./MeuMes";
import { OportunidadesDaSemana } from "./OportunidadesDaSemana";
import { PainelGeral } from "./PainelGeral";
import { ResultadoDoMes } from "./ResultadoDoMes";
import { Salas } from "./Salas";
import { SuporteParaMim } from "./SuporteParaMim";
import * as v from "./visao-geral-dados";

/**
 * Visão geral: o painel de cada pessoa, montado pelo nível de acesso dela.
 *
 * Quem tem a área de vendas vê os números dos últimos 30 dias contra os 30
 * anteriores, os gráficos e os sinais (problemas e oportunidades). Quem só tem
 * recuperação vê a fila como sinal. Quem cuida de conteúdo vê os contadores
 * editoriais. Cada leitura só acontece se a área estiver liberada, e o banco
 * confere de novo: pedir sem ter a área devolve vazio.
 *
 * Cada bloco aparece quando a leitura DELE termina (cartão 76): as leituras
 * moram em `visao-geral-dados.ts`, guardadas por pedido, e começam todas juntas
 * antes do primeiro bloco. Bloco que pode não existir (chat, suporte,
 * oportunidades) espera sem esqueleto, para a tela não piscar um cartão que
 * some em seguida.
 *
 * Esta rota aceita qualquer pessoa ativa (`requireSessao`), porque é para onde
 * as outras telas mandam quem não tem acesso a elas.
 */
export default async function AdminDashboard({ searchParams }: { searchParams: Promise<{ sem?: string }> }) {
  const profile = await requireSessao();
  v.comecarLeituras();
  const semAcesso = (await searchParams).sem === "acesso";
  const podeVerMeta = profile.areas.includes("vendas");

  return (
    <div data-painel-largo>
      <header>
        <p className="eyebrow">Visão geral</p>
        <h1 className="font-display mt-2 text-4xl text-ink">Olá, {(profile.fullName ?? "equipe").split(" ")[0]}</h1>
        <p className="mt-3 text-muted">
          Seu acesso é de {ROLE_LABEL[profile.role] ?? profile.role}. Aqui fica o que pede atenção hoje.
        </p>
      </header>

      {semAcesso ? (
        <p role="status" className="mt-5 flex items-start gap-2.5 rounded-[14px] bg-[#fcefd9] p-3.5 text-sm leading-relaxed text-[#6d3505]">
          <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            <span className="font-semibold">O seu acesso não abre aquela tela.</span> Você voltou para o início. Se precisa dela no
            dia a dia, peça a um administrador para liberar em Usuários.
          </span>
        </p>
      ) : null}

      <Suspense fallback={null}>
        <BlocoMeuMes areas={profile.areas} />
      </Suspense>

      {podeVerMeta ? (
        <Suspense fallback={<Esqueleto altura="h-36" />}>
          <BlocoMeta admin={ehAdmin(profile.role)} />
        </Suspense>
      ) : null}

      <Suspense fallback={<Esqueleto altura="h-28" />}>
        <BlocoSalas areas={profile.areas} />
      </Suspense>

      <Suspense fallback={null}>
        <BlocoChat />
      </Suspense>

      <Suspense fallback={null}>
        <BlocoSuporte />
      </Suspense>

      <Suspense fallback={null}>
        <BlocoOportunidades />
      </Suspense>

      {ehAdmin(profile.role) ? (
        <Suspense fallback={null}>
          <BlocoResultado />
        </Suspense>
      ) : null}

      <Suspense fallback={podeVerMeta ? <Esqueleto altura="h-72" /> : null}>
        <BlocoPainel />
      </Suspense>

      {profile.areas.includes("conteudo") ? (
        <Suspense fallback={<Esqueleto altura="h-28" />}>
          <BlocoConteudo />
        </Suspense>
      ) : null}

      <Suspense fallback={null}>
        <BlocoSemNada />
      </Suspense>
    </div>
  );
}

function Esqueleto({ altura }: { altura: string }) {
  return (
    <div className="mt-8" role="status" aria-busy="true">
      <span className="sr-only">Carregando</span>
      <Skeleton className={`w-full ${altura}`} />
    </div>
  );
}

async function BlocoMeuMes({ areas }: { areas: Parameters<typeof MeuMesNoInicio>[0]["areas"] }) {
  const [mostrar, m] = await Promise.all([v.mostrarMeuMes(), v.meuMes()]);
  return mostrar && m ? <MeuMesNoInicio m={m} areas={areas} /> : null;
}

async function BlocoMeta({ admin }: { admin: boolean }) {
  const [andamento, porFora] = await Promise.all([v.andamento(), v.porForaNoMes()]);
  return <MetaDoMes andamento={andamento} hoje={v.datas().hoje} porFora={porFora} acao={admin ? definirMeta : undefined} />;
}

async function BlocoSalas({ areas }: { areas: Parameters<typeof Salas>[0]["areas"] }) {
  return <Salas areas={areas} numeros={await v.numerosDasSalas()} />;
}

async function BlocoChat() {
  return <ChatParaMim resumo={await v.chat()} agora={Date.now()} />;
}

async function BlocoSuporte() {
  return <SuporteParaMim resumo={await v.suporte()} agora={Date.now()} />;
}

async function BlocoOportunidades() {
  return <OportunidadesDaSemana lista={await v.oportunidades()} />;
}

async function BlocoResultado() {
  const r = await v.resultadoDoMes();
  return r ? <ResultadoDoMes r={r} /> : null;
}

async function BlocoPainel() {
  const [vendas, sinais] = await Promise.all([v.dadosDeVendas(), v.avisos()]);
  return <PainelGeral vendas={vendas} sinais={sinais} />;
}

async function BlocoConteudo() {
  const conteudo = await v.conteudo();
  if (!conteudo) return null;
  return (
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
  );
}

async function BlocoSemNada() {
  if (!(await v.semNada())) return null;
  return (
    <p className="glass mt-9 rounded-[18px] p-6 text-sm text-muted">
      <span className="font-semibold text-ink">Seu trabalho fica nos setores acima.</span> Aqui aparecem os avisos do
      que pede atenção, conforme o seu acesso.
    </p>
  );
}
