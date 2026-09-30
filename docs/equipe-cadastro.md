# Cadastro da Equipe no OAE_FIN

## Onde cada informação fica

| Informação | Origem | Edição |
| --- | --- | --- |
| Pessoa, departamento, tipo de vínculo, modalidade, função e contato | Painel → Equipe | Formulário do painel |
| Contrato por pessoa e obra, valor, objeto, conta e etapas | Painel → Equipe | Formulário do painel |
| Título pago ou em aberto | CP_GERAL da planilha base | Sincronização financeira; vínculo confirmado na Equipe |
| Meta mensal por projeto | CR_GERAL como proposta; painel registra a meta | Registrar uma vez por mês/projeto |
| Saídas dos diretores | CP_GERAL | Vínculo e natureza confirmados no painel |
| PDFs da Equipe | Repositório privado de documentos da empresa | Link HTTPS no contrato; não há upload de PDF da Equipe |

Os dados cadastrados no painel são gravados no PostgreSQL. O navegador não é a fonte dos registros. O backup ZIP, disponível somente ao administrador em Configurações, inclui os cadastros e os PDFs dos empréstimos. Os documentos externos e as abas financeiras continuam exigindo cópia no serviço de origem.

## Uma aba de cadastro, quando desejarem mantê-la na base

Uma aba `EQUIPE_CADASTRO` é suficiente. Use uma linha por pessoa, sem separar por departamento, Big Room ou terceiros. Campos sugeridos:

`ID_PESSOA | NOME | DEPARTAMENTO | TIPO_VINCULO | MODALIDADE | FUNCAO | EMPRESA | BENEFICIARIO_CP | EMAIL | CELULAR | SITUACAO`

- `DEPARTAMENTO`: disciplina/área, padronizada com a conta EQUIP. TÉC. Ex.: `ELÉTRICA`, corrigindo as grafias `ELETRTICA` e `ELETRICA` da planilha atual.
- `TIPO_VINCULO`: PJ, CLT, associado, terceiro, autônomo, estagiário ou outro.
- `MODALIDADE`: Big Room, presencial, home office, híbrido ou por demanda.
- `BENEFICIARIO_CP`: nome do credor nos títulos, quando diferente do nome da pessoa.
- `ID_PESSOA`: identificador estável; não reutilizar se alguém sair.

Essa aba é **opcional como relação de referência**. A primeira versão cadastra e edita as pessoas diretamente no painel; ela não importa essa aba automaticamente. Não copie a aba `obsoleto`, nem CPF/RG em duplicidade. A planilha fornecida contém cadastro principal, dados detalhados, acompanhamento de contratos, terceiros por obra e distratos. Os contratos de terceiros da planilha têm credor, obra, valor, pago e saldo, mas precisam ser vinculados a uma pessoa e conferidos antes de entrarem no controle do painel.

## Permissões

Os menus Equipe, Previsão de Faturamento e Diretores ficam visíveis ao administrador. O administrador pode marcar cada opção no cadastro de um usuário. A verificação ocorre também nas páginas e APIs. Na área Diretores, um usuário liberado vê apenas o perfil expressamente vinculado ao seu login; o administrador vê todos.

## Conferência antes de lançar

1. Cadastrar pessoa e departamento; distinguir tipo de vínculo de modalidade.
2. Cadastrar um contrato para cada combinação pessoa/obra/objeto e suas etapas.
3. Sincronizar a base financeira e pesquisar os títulos no CP pelo beneficiário, documento ou projeto.
4. Confirmar o vínculo de cada título; o valor entra uma vez, com status pago ou aberto da base.
5. Registrar a meta mensal de faturamento quando a previsão do CR estiver conferida. A meta original não pode ser sobrescrita.
