-- Foto de quem avaliou, para a vitrine da loja parecer a avaliação do Google.
--
-- É o `reviewer.profilePhotoUrl` que a API devolve, um endereço do próprio
-- Google (googleusercontent). Mesmas regras da 0048: cache de no máximo 25
-- dias, regravado a cada leitura. Avaliação anônima fica sem foto.
--
-- Nasceu como 0049 e virou 0051: a 0049 e a 0050 do banco são da margem e
-- das campanhas, feitas em paralelo. `if not exists` de propósito: roda igual
-- em qualquer ordem.

alter table public.google_avaliacoes add column if not exists autor_foto text;
