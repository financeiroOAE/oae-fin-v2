# OAE Financeiro v2

Painel financeiro corporativo da Oliveira Araújo Engenharia, desenvolvido em Next.js com Prisma, autenticação por usuário/senha e sincronização com Google Sheets.

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

4. Se for a primeira execução, defina `ADMIN_TEMP_PASSWORD` e crie o administrador:

```bash
node scripts/seed.js
```

5. Inicie o painel:

```bash
npm run dev -- -p 3001
```

## Variáveis obrigatórias

- `JWT_SECRET`: segredo longo e exclusivo para assinar as sessões.
- `DATABASE_URL`: URL do SQLite. Local: `file:./database.sqlite`. Em produção com volume em `/data`: `file:/data/database.sqlite`.
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REFRESH_TOKEN`
- `GOOGLE_SPREADSHEET_ID`
- `ADMIN_TEMP_PASSWORD`: necessário apenas na criação inicial do usuário administrador.

Nunca versionar `.env.local`, tokens, senhas ou o arquivo `database.sqlite`.

## Produção

O projeto inclui `Dockerfile`. Como o sistema mantém usuários e histórico no SQLite, o ambiente de produção precisa oferecer armazenamento persistente.

Configuração esperada do serviço:

- build a partir do `Dockerfile`;
- porta fornecida pelo ambiente via `PORT`;
- volume persistente montado em `/data`;
- `DATABASE_URL=file:/data/database.sqlite`;
- demais variáveis configuradas como secrets do provedor;
- HTTPS habilitado no domínio público.

Na inicialização do container, `prisma db push` garante que as tabelas estejam presentes antes do Next.js iniciar.

## Validação

```bash
npm ci
npx prisma generate
npm run build
```

O GitHub Actions também executa esse build em alterações destinadas ao branch `main`.
