import { headers } from "next/headers";
import { Bot, Plug, ShieldCheck } from "lucide-react";
import { requireStaff } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { origemDosCabecalhos } from "@/lib/conector/base";
import { AREAS, OPERACOES } from "@/lib/conector/operacoes";
import { BASE_PATH } from "@/lib/seo/base-path";
import { quandoLegivel } from "@/lib/content/agenda";
import { BotaoCopiar } from "../bio/LinksParaDivulgar";
import { NovaChave } from "./NovaChave";
import { desligarAcesso } from "./actions";
import { ehAdmin } from "@/lib/auth/acessos";

export const metadata = { title: "Conector do Claude" };
export const dynamic = "force-dynamic";

/**
 * O conector do Claude (MCP): como ligar, quem está ligado e o que o Claude
 * fez. O servidor mora em `lib/conector/` e responde em /guias/api/mcp.
 *
 * Os acessos e o histórico ficam em tabelas sem policy (só a service_role
 * lê), então esta tela usa o cliente admin, depois do `requireStaff`. Quem
 * não é administrador vê só os próprios acessos e o próprio histórico.
 */

const RISCO = {
  leitura: { rotulo: "lê", classe: "bg-ink/6 text-ink/70" },
  escrita: { rotulo: "escreve", classe: "bg-brand/15 text-brand-strong" },
  perigosa: { rotulo: "muda o site", classe: "bg-wine/10 text-wine" },
} as const;

function Selo({ risco }: { risco: keyof typeof RISCO | null }) {
  if (!risco) return null;
  const r = RISCO[risco];
  return <span className={`inline-block rounded-full px-2 py-0.5 text-[0.62rem] font-semibold ${r.classe}`}>{r.rotulo}</span>;
}

function Endereco({ rotulo, valor, ajuda }: { rotulo: string; valor: string; ajuda: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-ink">{rotulo}</p>
      <div className="mt-1.5 flex items-center gap-2 rounded-[12px] border border-border bg-white/70 p-2.5">
        <code className="min-w-0 flex-1 break-all text-xs text-ink">{valor}</code>
        <BotaoCopiar valor={valor} />
      </div>
      <p className="mt-1.5 text-[0.72rem] leading-snug text-muted">{ajuda}</p>
    </div>
  );
}

type Acesso = {
  id: string;
  nome: string;
  prefixo: string;
  escopo: string;
  cliente: string | null;
  oauth_codigo: string | null;
  criado_em: string;
  ultimo_uso_em: string | null;
  profile_id: string;
  profiles: { full_name: string | null; email: string | null } | { full_name: string | null; email: string | null }[] | null;
};

type Linha = {
  id: number;
  criado_em: string;
  ferramenta: string;
  operacao: string | null;
  risco: keyof typeof RISCO | null;
  ok: boolean;
  erro: string | null;
  alvo: string | null;
  profiles: { full_name: string | null; email: string | null } | { full_name: string | null; email: string | null }[] | null;
};

const pessoa = (p: Acesso["profiles"]) => {
  const x = Array.isArray(p) ? p[0] : p;
  return x?.full_name ?? x?.email ?? "?";
};

export default async function ConectorPage() {
  const perfil = await requireStaff();
  const admin = ehAdmin(perfil.role);
  const db = createAdminClient();
  const base = `${origemDosCabecalhos(await headers())}${BASE_PATH}`;
  const mcp = `${base}/api/mcp`;

  let consultaAcessos = db
    .from("conector_chaves")
    .select("id, nome, prefixo, escopo, cliente, oauth_codigo, criado_em, ultimo_uso_em, profile_id, profiles:profile_id(full_name, email)")
    .is("revogada_em", null)
    .order("criado_em", { ascending: false });
  if (!admin) consultaAcessos = consultaAcessos.eq("profile_id", perfil.id);

  let consultaRegistro = db
    .from("conector_registro")
    .select("id, criado_em, ferramenta, operacao, risco, ok, erro, alvo, profiles:profile_id(full_name, email)")
    .not("operacao", "is", null)
    .order("criado_em", { ascending: false })
    .limit(80);
  if (!admin) consultaRegistro = consultaRegistro.eq("profile_id", perfil.id);

  const [{ data: acessos }, { data: registro }] = await Promise.all([consultaAcessos, consultaRegistro]);
  const lista = (acessos ?? []) as Acesso[];
  const linhas = (registro ?? []) as Linha[];

  const porArea = AREAS.map((a) => ({ ...a, ops: OPERACOES.filter((o) => o.nome.startsWith(`${a.nome}.`)) })).filter(
    (a) => a.ops.length,
  );

  return (
    <>
      <header>
        <p className="eyebrow">Sistema</p>
        <h1 className="font-display mt-2 text-4xl text-ink">Conector do Claude</h1>
        <p className="mt-3 max-w-2xl text-muted">
          Liga o painel ao Claude (no site, no app do celular e no Claude Code). Ele lê tudo o que está aqui, escreve
          rascunhos e, quando você pede na conversa, publica. Passa pelas mesmas travas do painel: post sem fonte ou com
          travessão não vai ao ar, e tudo fica registrado abaixo.
        </p>
      </header>

      <section className="mt-8 grid gap-5 lg:grid-cols-2">
        <div className="glass rounded-[18px] p-5">
          <h2 className="flex items-center gap-2 font-medium text-ink">
            <Plug size={16} aria-hidden className="text-brand-nav" />
            No Claude (site e app)
          </h2>
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-ink/85">
            <li>
              Em claude.ai, abra <strong>Configurações</strong>, depois <strong>Conectores</strong>, e clique em{" "}
              <strong>Adicionar conector personalizado</strong>.
            </li>
            <li>Dê o nome JK Alianças e cole o endereço abaixo.</li>
            <li>
              Clique em <strong>Conectar</strong>: o Claude abre o login do painel, você entra e escolhe{" "}
              <strong>Permitir</strong>.
            </li>
          </ol>
          <div className="mt-4">
            <Endereco
              rotulo="Endereço do conector"
              valor={mcp}
              ajuda="Modo código: três ferramentas (buscar, consultar e executar), que gastam muito menos contexto. Ligado no claude.ai, aparece também no Claude Code da mesma conta."
            />
          </div>
          <details className="mt-3">
            <summary className="cursor-pointer text-xs font-semibold text-brand-nav">Outro jeito: uma ferramenta por operação</summary>
            <div className="mt-3">
              <Endereco
                rotulo="Endereço no modo de ferramentas"
                valor={`${mcp}/ferramentas`}
                ajuda={`As mesmas ${OPERACOES.length} operações, cada uma como ferramenta separada. Útil em app que não lida bem com código.`}
              />
            </div>
          </details>
        </div>

        <div className="glass rounded-[18px] p-5">
          <h2 className="flex items-center gap-2 font-medium text-ink">
            <Bot size={16} aria-hidden className="text-brand-nav" />
            No Claude Code (terminal)
          </h2>
          <p className="mt-3 text-sm text-ink/85">
            Pelo login, rode o comando abaixo e depois <code className="rounded bg-ink/5 px-1">/mcp</code> para entrar:
          </p>
          <div className="mt-2 flex items-start gap-2 rounded-[12px] border border-border bg-white/70 p-2.5">
            <code className="min-w-0 flex-1 break-all text-xs text-ink">{`claude mcp add --transport http jk ${mcp}`}</code>
            <BotaoCopiar valor={`claude mcp add --transport http jk ${mcp}`} />
          </div>
          <p className="mt-4 text-sm text-ink/85">Ou com uma chave fixa, que não pede login:</p>
          <div className="mt-3">
            <NovaChave mcp={mcp} />
          </div>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-2xl text-ink">{admin ? "Acessos ligados" : "Seus acessos"}</h2>
        <p className="mt-1 text-sm text-muted">
          Conexão pelo login renova sozinha e cai depois de 90 dias sem uso. Desligar corta na hora.
        </p>
        {lista.length === 0 ? (
          <p className="mt-4 rounded-[14px] border border-dashed border-border p-5 text-sm text-muted">
            Nenhum acesso ainda. Conecte pelo claude.ai ou crie uma chave acima.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-[16px] border border-border bg-white/60">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <thead className="border-b border-border text-xs text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Acesso</th>
                  <th scope="col" className="px-4 py-3 font-medium">Pessoa</th>
                  <th scope="col" className="px-4 py-3 font-medium">Pode</th>
                  <th scope="col" className="px-4 py-3 font-medium">Criado</th>
                  <th scope="col" className="px-4 py-3 font-medium">Último uso</th>
                  <th scope="col" className="px-4 py-3"><span className="sr-only">Ação</span></th>
                </tr>
              </thead>
              <tbody>
                {lista.map((a) => (
                  <tr key={a.id} className="border-b border-border/60 align-top last:border-0">
                    <td className="px-4 py-3">
                      <span className="font-medium text-ink">{a.nome}</span>
                      <span className="mt-0.5 block text-xs text-muted">
                        {a.oauth_codigo ? "Login do app" : `Chave ${a.prefixo}…`}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ink/85">{pessoa(a.profiles)}</td>
                    <td className="px-4 py-3 text-xs text-ink/85">{a.escopo === "leitura" ? "Só ler" : "Ler e escrever"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted">{quandoLegivel(a.criado_em)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted">{a.ultimo_uso_em ? quandoLegivel(a.ultimo_uso_em) : "nunca"}</td>
                    <td className="px-4 py-3 text-right">
                      <form action={desligarAcesso}>
                        <input type="hidden" name="id" value={a.id} />
                        <button
                          type="submit"
                          className="rounded-full border border-wine/30 px-3 py-1 text-xs font-semibold text-wine transition-colors hover:bg-wine/8"
                        >
                          Desligar
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-display text-2xl text-ink">O que o Claude fez</h2>
        <p className="mt-1 text-sm text-muted">
          Cada operação, deu certo ou não{admin ? ", de todos os acessos" : ""}. As 80 mais recentes.
        </p>
        {linhas.length === 0 ? (
          <p className="mt-4 rounded-[14px] border border-dashed border-border p-5 text-sm text-muted">Nada ainda.</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-[16px] border border-border bg-white/60">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <thead className="border-b border-border text-xs text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Quando</th>
                  <th scope="col" className="px-4 py-3 font-medium">Quem</th>
                  <th scope="col" className="px-4 py-3 font-medium">Operação</th>
                  <th scope="col" className="px-4 py-3 font-medium">Resultado</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.id} className="border-b border-border/60 align-top last:border-0">
                    <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted">{quandoLegivel(l.criado_em)}</td>
                    <td className="px-4 py-2.5 text-xs text-ink/85">{pessoa(l.profiles)}</td>
                    <td className="px-4 py-2.5">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <code className="text-xs text-ink">{l.operacao}</code>
                        <Selo risco={l.risco} />
                      </span>
                      {l.alvo ? <span className="mt-0.5 block break-all text-[0.7rem] text-muted">{l.alvo}</span> : null}
                    </td>
                    <td className="px-4 py-2.5 text-xs">
                      {l.ok ? (
                        <span className="font-medium text-ink/80">Feito</span>
                      ) : (
                        <span className="text-wine">{l.erro ?? "Falhou"}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="flex items-center gap-2 font-display text-2xl text-ink">
          <ShieldCheck size={20} aria-hidden className="text-brand-nav" />
          O que o Claude pode fazer
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          {OPERACOES.length} operações. As marcadas “muda o site” pedem o seu sim na conversa antes de rodar. Chaves de
          integração, acessos do conector e papel de administrador ficam fora: só aqui no painel.
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {porArea.map((a) => (
            <details key={a.nome} className="glass-sutil rounded-[16px] p-4">
              <summary className="cursor-pointer">
                <span className="font-medium capitalize text-ink">{a.nome}</span>
                <span className="ml-2 text-xs text-muted">{a.ops.length} · {a.descricao}</span>
              </summary>
              <ul className="mt-3 space-y-1.5">
                {a.ops.map((o) => (
                  <li key={o.nome} className="text-xs leading-snug text-ink/85">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <code className="text-ink">{o.nome.split(".")[1]}</code>
                      <Selo risco={o.risco} />
                      {o.soAdmin ? <span className="text-[0.62rem] font-semibold text-muted">só admin</span> : null}
                    </span>
                    <span className="block text-muted">{o.resumo}</span>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
