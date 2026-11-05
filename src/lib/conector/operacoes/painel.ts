import "server-only";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { absoluteUrl } from "@/lib/seo/site";
import { falhar, operacao } from "../tipos";
import { id, limite, painel, quando } from "./apoio";

/** Visão geral, quem sou eu, o que o conector fez, equipe e integrações. */

export const OPERACOES_PAINEL = [
  operacao({
    nome: "painel.resumo",
    resumo: "A visão geral do painel: posts por situação, agendados, comentários na fila, pautas, leads, QR, 404, sincronização e Search Console.",
    entrada: z.object({}),
    retorno:
      "{ posts: Record<status,number>, agendados: Array<{titulo,quando,erro?}>, comentarios_na_fila, pautas: Record<status,number>, leads_7_dias, leituras_de_qr_7_dias, erros_404_abertos, fatos_para_validar, ultima_sincronizacao_tray, ultima_importacao_search_console, painel }",
    risco: "leitura",
    async executar(_a, ctx) {
      const seteDias = new Date(Date.now() - 7 * 86400_000).toISOString();
      const [posts, agendados, comentarios, pautas, leads, qr, quebrados, fatos, tray, gsc] = await Promise.all([
        ctx.db.from("contents").select("status"),
        ctx.db.from("contents").select("title, scheduled_at, scheduled_error").not("scheduled_at", "is", null).order("scheduled_at"),
        ctx.db.from("comments").select("id", { count: "exact", head: true }).eq("status", "pending"),
        ctx.db.from("briefings").select("status"),
        ctx.db.from("leads").select("id", { count: "exact", head: true }).gte("criado_em", seteDias),
        ctx.db.from("qrcode_leituras").select("id", { count: "exact", head: true }).gte("lido_em", seteDias),
        ctx.db.from("not_found_hits").select("path", { count: "exact", head: true }).eq("resolved", false),
        ctx.db.from("facts").select("id", { count: "exact", head: true }).eq("status", "validar"),
        ctx.db.from("sync_logs").select("status, created_at, error").eq("source", "tray").order("created_at", { ascending: false }).limit(1).maybeSingle(),
        ctx.db.from("integration_tokens").select("updated_at").eq("provider", "gsc").maybeSingle(),
      ]);
      const contar = (linhas: { status: string }[] | null) =>
        (linhas ?? []).reduce<Record<string, number>>((m, l) => ((m[l.status] = (m[l.status] ?? 0) + 1), m), {});
      return {
        posts: contar(posts.data),
        agendados: (agendados.data ?? []).map((a) => ({ titulo: a.title, quando: quando(a.scheduled_at), ...(a.scheduled_error ? { erro: a.scheduled_error } : {}) })),
        comentarios_na_fila: comentarios.count ?? 0,
        pautas: contar(pautas.data),
        leads_7_dias: leads.count ?? 0,
        leituras_de_qr_7_dias: qr.count ?? 0,
        erros_404_abertos: quebrados.count ?? 0,
        fatos_para_validar: fatos.count ?? 0,
        ultima_sincronizacao_tray: tray.data ? { status: tray.data.status, quando: quando(tray.data.created_at), ...(tray.data.error ? { erro: tray.data.error } : {}) } : null,
        ultima_importacao_search_console: quando(gsc.data?.updated_at),
        painel: painel(ctx, ""),
      };
    },
  }),

  operacao({
    nome: "painel.eu",
    resumo: "Quem está conectado, com que perfil, por qual acesso e com que escopo.",
    entrada: z.object({}),
    retorno: "{ nome, email, papel, acesso: { nome, escopo, via }, conector }",
    risco: "leitura",
    async executar(_a, ctx) {
      return {
        nome: ctx.quem.nome,
        email: ctx.quem.email,
        papel: ctx.quem.papel,
        acesso: ctx.acesso,
        conector: painel(ctx, "/conector"),
      };
    },
  }),

  operacao({
    nome: "painel.atividade",
    resumo: "O que foi feito pelo conector (por este acesso ou por todos, se administrador): operação, se deu certo e quando.",
    entrada: z.object({ todos: z.boolean().default(false), so_escrita: z.boolean().default(false), limite: limite(40, 200) }),
    retorno: "{ itens: Array<{ quando, quem, operacao, risco, ok, erro?, alvo? }> }",
    risco: "leitura",
    async executar(a, ctx) {
      if (a.todos && ctx.quem.papel !== "admin") falhar("Ver a atividade de todos é só para administrador.", 403);
      let q = ctx.db
        .from("conector_registro")
        .select("criado_em, operacao, ferramenta, risco, ok, erro, alvo, profiles:profile_id(full_name, email)")
        .not("operacao", "is", null)
        .order("criado_em", { ascending: false })
        .limit(a.limite);
      if (!a.todos) q = q.eq("chave_id", ctx.acesso.id);
      if (a.so_escrita) q = q.neq("risco", "leitura");
      const { data } = await q;
      return {
        itens: (data ?? []).map((r) => {
          const p = (Array.isArray(r.profiles) ? r.profiles[0] : r.profiles) as { full_name: string | null; email: string | null } | null;
          return { quando: quando(r.criado_em), quem: p?.full_name ?? p?.email, operacao: r.operacao, risco: r.risco, ok: r.ok, ...(r.erro ? { erro: r.erro } : {}), ...(r.alvo ? { alvo: r.alvo } : {}) };
        }),
      };
    },
  }),

  // ---------------------------------------------------------------- usuários
  operacao({
    nome: "usuarios.listar",
    resumo: "As pessoas com acesso ao painel: papel, se está ativa e se já criou a senha.",
    entrada: z.object({}),
    retorno: "{ itens: Array<{ id, nome, email, papel, ativo, criou_senha, ultimo_acesso }> }",
    risco: "leitura",
    soAdmin: true,
    async executar(_a, ctx) {
      const { data: perfis } = await ctx.db.from("profiles").select("id, full_name, email, role, is_active, created_at").order("created_at");
      const { data: auth } = await ctx.db.auth.admin.listUsers({ perPage: 200 });
      const porId = new Map((auth?.users ?? []).map((u) => [u.id, u]));
      return {
        itens: (perfis ?? []).map((p) => {
          const u = porId.get(p.id);
          return {
            id: p.id,
            nome: p.full_name,
            email: p.email,
            papel: p.role,
            ativo: p.is_active,
            criou_senha: !!u?.email_confirmed_at,
            ultimo_acesso: quando(u?.last_sign_in_at),
          };
        }),
        painel: painel(ctx, "/usuarios"),
      };
    },
  }),

  operacao({
    nome: "usuarios.convidar",
    resumo: "Convida uma pessoa para o painel por e-mail (ela cria a senha pelo link). Papel de administrador só pelo painel.",
    entrada: z.object({
      email: z.string().email(),
      nome: z.string().min(2).max(120),
      papel: z.enum(["editor", "reviewer", "author"]).default("editor"),
    }),
    retorno: "{ ok: true; mensagem }",
    risco: "perigosa",
    soAdmin: true,
    async executar(a, ctx) {
      const email = a.email.trim().toLowerCase();
      const { data, error } = await ctx.db.auth.admin.inviteUserByEmail(email, {
        data: { full_name: a.nome },
        redirectTo: absoluteUrl("/admin/senha"),
      });
      if (error || !data?.user) {
        const msg: Record<string, string> = {
          email_exists: "Este e-mail já tem acesso ao painel. Se esqueceu a senha, a pessoa pede um link em 'Esqueci minha senha'.",
          over_email_send_rate_limit: "O Supabase travou o envio por excesso de e-mails na última hora. Tente mais tarde.",
          email_address_not_authorized: "O Supabase recusou o envio: sem SMTP próprio ele só manda para quem é do time do projeto.",
        };
        falhar(msg[error?.code ?? ""] ?? `Não deu para convidar: ${error?.message ?? "erro desconhecido"}`);
      }
      const r = await ctx.db.from("profiles").update({ role: a.papel, full_name: a.nome, email, is_active: true }).eq("id", data!.user!.id);
      if (r.error) falhar(`Convite enviado, mas o papel falhou: ${r.error.message}`, 500);
      revalidatePath("/admin/usuarios");
      return { ok: true, mensagem: `Convite enviado para ${email}. O link vale uma vez só.` };
    },
  }),

  operacao({
    nome: "usuarios.reenviar_convite",
    resumo: "Reenvia o convite para quem ainda não criou a senha.",
    entrada: z.object({ id }),
    retorno: "{ ok: true }",
    risco: "escrita",
    soAdmin: true,
    async executar(a, ctx) {
      const { data: u } = await ctx.db.auth.admin.getUserById(a.id);
      if (!u?.user?.email) falhar("Pessoa não encontrada.", 404);
      if (u!.user!.email_confirmed_at) falhar("Essa pessoa já criou a senha. Se esqueceu, ela pede um link em 'Esqueci minha senha'.");
      const { data: p } = await ctx.db.from("profiles").select("full_name").eq("id", a.id).maybeSingle();
      const { error } = await ctx.db.auth.admin.inviteUserByEmail(u!.user!.email!, {
        data: { full_name: p?.full_name ?? u!.user!.email },
        redirectTo: absoluteUrl("/admin/senha"),
      });
      if (error) falhar(`Não deu para reenviar: ${error.message}`);
      return { ok: true };
    },
  }),

  // ---------------------------------------------------------------- integrações
  operacao({
    nome: "integracoes.status",
    resumo: "Como estão as integrações: GA4, GTM, Search Console, Tray, Kommo, RD, Meta, webhook do grupo e o relógio (cron). Nunca mostra chave.",
    entrada: z.object({}),
    retorno: "{ integracoes: Array<{ provedor, nome, status, config, conectada_em }>, chaves: Array<{ provedor, tem_valor, atualizada_em, vence_em }>, ultimas_rodadas: Array<{fonte,status,quando,erro?}> }",
    risco: "leitura",
    soAdmin: true,
    async executar(_a, ctx) {
      const [integ, chaves, rodadas, cron] = await Promise.all([
        ctx.db.from("integrations").select("provider, display_name, status, config, connected_at"),
        ctx.db.from("integration_tokens").select("provider, access_token, updated_at, expires_at"),
        ctx.db.from("sync_logs").select("source, status, created_at, error").order("created_at", { ascending: false }).limit(15),
        ctx.db.from("site_settings").select("value").eq("key", "cron").maybeSingle(),
      ]);
      return {
        integracoes: (integ.data ?? []).map((i) => ({ provedor: i.provider, nome: i.display_name, status: i.status, config: i.config, conectada_em: quando(i.connected_at) })),
        chaves: (chaves.data ?? []).map((c) => ({ provedor: c.provider, tem_valor: !!c.access_token, atualizada_em: quando(c.updated_at), vence_em: quando(c.expires_at) })),
        relogio: cron.data?.value ? "configurado" : "sem endereço",
        ultimas_rodadas: (rodadas.data ?? []).map((r) => ({ fonte: r.source, status: r.status, quando: quando(r.created_at), ...(r.error ? { erro: r.error } : {}) })),
        aviso: "Chaves se colam e se trocam só no painel, em Integrações.",
        painel: painel(ctx, "/integracoes"),
      };
    },
  }),
];
