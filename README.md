# OAE Financeiro v2

Painel financeiro corporativo da Oliveira Araújo Engenharia, desenvolvido em Next.js, Prisma e PostgreSQL/Neon, com autenticação por usuário e sincronização com Google Sheets.

## Desenvolvimento local

1. Copie `.env.example` para `.env.local` e preencha as variáveis.
2. Instale as dependências:

```bash
npm ci
```

3. Gere o Prisma Client e prepare o banco:

```bash
npx prisma generate
npx prisma db push
```

4. Na primeira execução, defina `ADMIN_TEMP_PASSWORD` e crie o administrador:

```bash
node scripts/seed.js
```

5. Inicie o painel:

```bash
npm run dev -- -p 3001
```

## Variáveis obrigatórias

- `JWT_SECRET`: segredo longo e exclusivo para assinar as sessões.
- `DATABASE_URL`: connection string PostgreSQL fornecida pelo Neon.
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REFRESH_TOKEN`
- `GOOGLE_SPREADSHEET_ID`
- `ADMIN_TEMP_PASSWORD`: necessária apenas para criar o administrador inicial.

Nunca versione `.env.local`, tokens, senhas ou credenciais do banco.

## Sincronização financeira

- Ao abrir ou recarregar uma página, o painel utiliza o último snapshot salvo.
- Uma nova leitura do Google Sheets ocorre ao clicar em **Atualizar Dados**.
- A sincronização automática oficial é executada diariamente às 17h pelo workflow `daily-financial-sync.yml`.
- Se uma atualização falhar, o snapshot anterior permanece disponível.

## Produção

O projeto é publicado no Render utilizando o `Dockerfile`.

Na inicialização do container:

1. o Prisma Client é gerado durante o build;
2. `prisma db push` valida a estrutura no PostgreSQL/Neon;
3. o Next.js inicia na porta fornecida pela variável `PORT`.

## Workflows ativos

- `build.yml`: valida o build em pushes e pull requests para a branch `main`.
- `daily-financial-sync.yml`: atualiza o snapshot financeiro diariamente às 07h.

## Validação

```bash
npm ci
npx prisma generate
npm run build
```
