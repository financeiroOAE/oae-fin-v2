# Prévia Ameba para o administrador

Referência: https://styles.refero.design/style/371df039-a090-402b-b2e4-21ab38e07625

A prévia aplica o visual aos componentes atuais do painel. Não altera cálculos,
fontes de dados, sincronização, permissões de menus ou o visual padrão.
Navegação navy #00052e, superfícies brancas, azul #0428cb, bordas finas e
raios de 4–8px. Inter já utilizado pelo painel substitui a fonte proprietária.
As cores inválidas #00052 do material foram corrigidas na adaptação.

## Uso após instalação

1. Entrar com uma conta ADMIN ativa, com troca de senha concluída.
2. Na parte inferior do menu, clicar em “Prévia Ameba”.
3. Navegar pelas páginas reais para avaliar o visual.
4. Clicar em “Voltar ao visual atual” para encerrar a avaliação.

A preferência dura até 24 horas, pertence à conta e é eliminada no logout.
O servidor consulta a função atual do usuário no banco. Uma conta comum não
recebe o seletor, não ativa a prévia com cookie forjado e recebe 403 ao tentar
alterar a preferência. Acesso sem sessão recebe 401 na API. Atributos inseridos
manualmente no navegador só mudam o CSS local, sem conceder permissões.

## Publicação

Esta branch prepara uma avaliação individual. Não libera o tema para todos.
Não há botão de publicação geral nem mudança do tema padrão. Liberar o design
para os demais usuários exige uma alteração posterior após aprovação de Manu.

## Validação no ambiente conectado

- ADMIN: ativar, trocar página, recarregar e retornar ao tema anterior.
- USER: seletor ausente, POST negado e cookie de ADMIN ignorado.
- Sem sessão: POST 401, sem alteração de cookie.
- Conferir gráficos, filtros, modais de Equipe/Administrativo e exportações
  com dados reais, desktop e celular.
