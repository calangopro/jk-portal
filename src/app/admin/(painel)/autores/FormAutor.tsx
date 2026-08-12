"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { salvarAutor, type AutoresState } from "./actions";

const campo =
  "mt-1.5 w-full rounded-[12px] border border-border bg-white/70 px-4 py-3 text-ink outline-none transition-colors placeholder:text-muted/60 focus:border-brand";

function Botao({ editando }: { editando: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-12 items-center justify-center rounded-full bg-brand px-7 text-sm font-semibold text-ink transition-colors hover:bg-brand-light disabled:opacity-60"
    >
      {pending ? "Salvando…" : editando ? "Salvar alterações" : "Cadastrar pessoa"}
    </button>
  );
}

export type AutorEditavel = {
  id: string;
  slug: string;
  name: string;
  jobTitle: string | null;
  credentials: string | null;
  bio: string | null;
  email: string | null;
  sameAs: string[];
};

export function FormAutor({ autor }: { autor?: AutorEditavel }) {
  const [state, formAction] = useActionState<AutoresState, FormData>(
    salvarAutor,
    {},
  );
  const [bio, setBio] = useState(autor?.bio ?? "");

  return (
    <form action={formAction} className="space-y-5">
      {autor ? <input type="hidden" name="id" value={autor.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-ink">
          Nome de quem assina
          <input
            name="name"
            required
            defaultValue={autor?.name}
            className={campo}
            placeholder="Ana Ribeiro"
          />
          <span className="mt-1.5 block text-xs text-muted">
            Só o nome. Cargo e credencial vão nos campos abaixo, porque o Google
            pede que a assinatura no schema leve o nome sozinho.
          </span>
        </label>

        <label className="block text-sm font-medium text-ink">
          Endereço da página
          <input
            name="slug"
            defaultValue={autor?.slug}
            className={campo}
            placeholder="ana-ribeiro"
          />
          <span className="mt-1.5 block text-xs text-muted">
            Vira /autor/…. Em branco, é montado a partir do nome.
          </span>
        </label>

        <label className="block text-sm font-medium text-ink">
          Cargo
          <input
            name="job_title"
            defaultValue={autor?.jobTitle ?? ""}
            className={campo}
            placeholder="Gemóloga responsável"
          />
        </label>

        <label className="block text-sm font-medium text-ink">
          Credencial
          <input
            name="credentials"
            defaultValue={autor?.credentials ?? ""}
            className={campo}
            placeholder="12 anos na fábrica da JK, formada em gemologia"
          />
          <span className="mt-1.5 block text-xs text-muted">
            O que sustenta a assinatura. Nunca inventar formação nem tempo de casa.
          </span>
        </label>
      </div>

      <label className="block text-sm font-medium text-ink">
        Apresentação
        <textarea
          name="bio"
          rows={4}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          className={campo}
          placeholder="Quem é a pessoa, o que ela faz na JK e por que ela entende do assunto."
        />
        <span className="mt-1.5 block text-xs text-muted">
          {bio.length} caracteres. Aparece na página da pessoa e na descrição da
          busca.
        </span>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-ink">
          Perfis públicos, um por linha
          <textarea
            name="same_as"
            rows={3}
            defaultValue={autor?.sameAs.join("\n")}
            className={campo}
            placeholder={"https://www.linkedin.com/in/…\nhttps://www.instagram.com/…"}
          />
          <span className="mt-1.5 block text-xs text-muted">
            Vira `sameAs` no schema, que é o que prova que a pessoa existe fora
            do site. Só perfil real.
          </span>
        </label>

        <label className="block text-sm font-medium text-ink">
          E-mail de contato
          <input
            name="email"
            type="email"
            defaultValue={autor?.email ?? ""}
            className={campo}
            placeholder="ana@jkaliancas.com.br"
          />
          <span className="mt-1.5 block text-xs text-muted">
            Interno, não aparece na página.
          </span>
        </label>
      </div>

      {state.error ? (
        <p role="alert" className="text-sm font-medium text-wine">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="text-sm font-medium text-brand-strong">
          {state.success}
        </p>
      ) : null}

      <Botao editando={Boolean(autor)} />
    </form>
  );
}
