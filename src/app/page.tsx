import { createClient } from "@/lib/supabase/server";
import { signOut } from "./login/actions";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-6 px-6">
      <div>
        <p className="text-sm uppercase tracking-widest text-neutral-500">
          JK Alianças
        </p>
        <h1 className="mt-1 text-3xl font-semibold">Portal</h1>
      </div>

      <p className="text-neutral-600 dark:text-neutral-400">
        Bem-vindo(a), <span className="font-medium">{user?.email}</span>.
      </p>

      <form action={signOut}>
        <button
          type="submit"
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium transition hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          Sair
        </button>
      </form>
    </main>
  );
}
