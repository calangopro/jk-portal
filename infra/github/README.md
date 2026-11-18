# GitHub do jk-portal: o que protege o `main`

O repositório é `calangopro/jk-portal`. Quem administra é a conta `calangopro`;
o Filipe (`agenciasetup`) e o Erick (`ErickOlih`) têm escrita. Só quem
administra liga a proteção abaixo.

## As três camadas

1. **O Roadmap avisa antes** (`.github/workflows/roadmap.yml`). Cada envio de
   ramo e cada pedido de revisão conta ao painel os arquivos que mexe. O cartão
   anda sozinho, o pedido ganha um comentário com quem mais mexe no mesmo
   lugar, e quando um pedido junta, quem mexe nos mesmos arquivos é avisado
   para trazer o main. A checagem `roadmap` falha quando o pedido não tem
   cartão ou quando uma migration nova repete um número que já existe.
2. **A verificação confere o código** (`.github/workflows/verificar.yml`):
   tipos e todos os testes puros do projeto em todo pedido de revisão, sem
   depender da Vercel.
3. **O `main` só aceita o que passou** (o conjunto de regras abaixo): nada
   entra direto, só por pedido de revisão; o pedido só junta com `verificar`,
   `roadmap` e a montagem da Vercel verdes; e o ramo precisa estar em dia com
   o main antes de juntar. É isso que garante "junta os dois sem estragar":
   quando o Filipe junta primeiro, o GitHub obriga o pedido do Erick a trazer
   o main, e as checagens rodam de novo sobre o código como ele vai ficar.

## Ligar a proteção do `main` (só quem administra, uma vez)

Pela tela: Settings, Rules, Rulesets, New ruleset, Import a ruleset, e escolher
`infra/github/ruleset-main.json`. Ou pelo terminal, logado como `calangopro`:

```bash
gh api -X POST repos/calangopro/jk-portal/rulesets --input infra/github/ruleset-main.json
```

O que ela faz:

| Regra | Efeito |
|---|---|
| `pull_request` | Ninguém envia direto para o main: tudo passa por pedido de revisão. Não exige aprovação de outra pessoa (são duas pessoas, e cada uma junta o próprio). |
| `required_status_checks` com `strict` | O pedido só junta com `verificar`, `roadmap` e `Vercel` verdes, e com o ramo em dia com o main. |
| `non_fast_forward` | Ninguém reescreve o histórico do main (`push --force`). |
| `deletion` | Ninguém apaga o main. |

**Ordem:** ligar depois que o pedido que traz os dois workflows estiver
juntado, senão as checagens `verificar` e `roadmap` ainda não existem e todo
pedido fica esperando por elas.

**Se a Vercel falhar à toa** (a primeira montagem às vezes morre no
`next/font`, ver CLAUDE.md), é "Redeploy" na Vercel ou um commit vazio. Se
isso virar rotina, tire `Vercel` da lista de checagens obrigatórias: a
`verificar` continua conferindo tipos e testes.

## Quem é quem no Roadmap

O login do GitHub vira pessoa do painel pela tabela `roadmap_github_pessoas`
(0143). Hoje estão `agenciasetup` (Filipe) e `ErickOlih` (Erick). Login
desconhecido não move cartão sem dono. Para acrescentar, pelo SQL:

```sql
insert into public.roadmap_github_pessoas (login, perfil)
select 'login-do-github', id from public.profiles where full_name = 'Nome' and is_active;
```
