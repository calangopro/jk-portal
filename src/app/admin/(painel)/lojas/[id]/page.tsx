import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Form, type LojaDados } from "./Form";
import { Galeria } from "./Galeria";
import { fotosDaLoja } from "../actions";

export const metadata = { title: "Editar loja" };

export default async function EditarLojaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff();
  const supabase = await createClient();

  const { data } = await supabase
    .from("locations")
    .select("*")
    .eq("id", (await params).id)
    .maybeSingle();

  if (!data) notFound();

  const fotos = await fotosDaLoja((data as LojaDados).id);

  return (
    <div className="space-y-5">
      <Form loja={data as LojaDados} />
      <Galeria locationId={(data as LojaDados).id} iniciais={fotos} />
    </div>
  );
}
