from pathlib import Path
import re


def replace_once(path, old, new, label):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    if old not in text:
        raise RuntimeError(f'{label}: trecho nao encontrado em {path}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')
    print(f'OK {label}')


def replace_tooltip_by_title(path, title, replacement, label):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    pattern = rf'<InfoTooltip\s+title="{re.escape(title)}"\s+content=.*?\s*/>'
    new_text, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise RuntimeError(f'{label}: tooltip nao encontrado em {path}')
    p.write_text(new_text, encoding='utf-8')
    print(f'OK {label}')


projects = 'src/app/projetos/page.js'
replace_tooltip_by_title(projects, 'Receita Administrativa Vinculada', '<InfoTooltip title="Receita Administrativa Vinculada" content="Receita administrativa vinculada aos projetos selecionados." />', 'projetos receita adm')
replace_tooltip_by_title(projects, 'Composição Financeira (DRE)', '<InfoTooltip title="Composição Financeira (DRE)" content="Receita, custos, despesas, tributos e valores não classificados dos projetos selecionados." />', 'projetos composicao financeira')
replace_tooltip_by_title(projects, 'Movimentações Não Classificadas', '<InfoTooltip title="Movimentações Não Classificadas" content="Movimentações dos projetos selecionados que ainda não possuem classificação DRE válida." />', 'projetos nao classificados')
replace_tooltip_by_title(projects, 'Resultado e Margem', '<InfoTooltip title="Resultado e Margem" content="Resultado gerencial e margem dos projetos selecionados." />', 'projetos resultado margem')
replace_tooltip_by_title(projects, 'Evolução Financeira 2026', '<InfoTooltip title="Evolução Financeira 2026" content="Receitas, custos e despesas realizados por mês em 2026." />', 'projetos evolucao')
replace_tooltip_by_title(projects, 'Curva ABC', '<InfoTooltip title="Curva ABC" content="Distribuição dos projetos nas classes A, B e C pelo valor contratado." />', 'projetos abc')
replace_tooltip_by_title(projects, '5 Maiores Fontes de Receita — Projetos', '<InfoTooltip title="5 Maiores Fontes de Receita — Projetos" content="Cinco projetos com maior receita recebida no período selecionado." />', 'projetos top receitas')
replace_tooltip_by_title(projects, '5 Maiores Saídas', '<InfoTooltip title="5 Maiores Saídas" content="Cinco projetos com maior volume pago no período selecionado." />', 'projetos top saidas')
replace_tooltip_by_title(projects, 'Tributos sobre Receita e Lucro', '<InfoTooltip title="Tributos sobre Receita e Lucro" content="Tributos sobre receita e lucro vinculados aos projetos selecionados." />', 'projetos tributos')
replace_once(projects, '<InfoTooltip title="Rateio Administrativo Aplicado" content="Valores de receita mapeados do Centro de Custo ADMINISTRAÇÃO com Lançamento correspondente" />', '<InfoTooltip title="Rateio Administrativo Aplicado" content="Receita administrativa vinculada ao projeto selecionado." />', 'projetos rateio drawer')


dre = 'src/app/dre/page.js'
replace_tooltip_by_title(dre, 'Demonstrativo de Resultado', '<InfoTooltip title="Demonstrativo de Resultado" content="Receitas, deduções, custos, despesas e resultados classificados na DRE." />', 'dre descricao')
replace_tooltip_by_title(dre, 'Modo de Visualização', '<InfoTooltip title="Modo de Visualização" content="Define se a DRE mostra realizado, previsão ou realizado + previsão." />', 'dre visao')
replace_tooltip_by_title(dre, 'Retroativo 2026', '<InfoTooltip title="Retroativo 2026" content="Movimentações realizadas em 2025 dos projetos selecionados, exibidas como Retroativo 2026." />', 'dre retroativo')


flux = 'src/app/fluxo-caixa/page.js'
replace_once(flux, 'infoContent={`Exibe o total consolidado por empresa. Clique em uma linha para ver o detalhamento das contas e bancos. (Ref: ${dataBase})`}', 'infoContent={`Saldos bancários consolidados por empresa na data de referência ${dataBase}.`}', 'flux saldos')
replace_once(flux, 'infoContent="Mostra o fluxo de Entradas, Saídas e Resultado (Entradas - Saídas) de acordo com os filtros selecionados no topo da página."', 'infoContent="Entradas, saídas e resultado ao longo do período selecionado."', 'flux evolucao')
replace_once(flux, 'infoContent="Exibe a previsão de caixa para os próximos 7 dias com base nas datas de vencimento. Clique em uma barra para filtrar a tabela principal e ver os detalhes."', 'infoContent="Entradas e saídas previstas para os próximos 7 dias."', 'flux previsao')
replace_once(flux, 'infoContent="Mostra contas a receber e contas a pagar previstas para a data atual. Os valores são calculados a partir dos lançamentos ainda previstos em CR_GERAL e CP_GERAL com vencimento/data correspondente a hoje. Clique nos cards para visualizar os lançamentos que compõem os valores."', 'infoContent="Contas a receber e contas a pagar previstas para hoje."', 'flux hoje')
replace_once(flux, 'infoContent="Mostra, por mês de 2026, Recebido, A receber, Pago e A pagar. A linha Resultado liga o saldo de cada mês: (Recebido + A receber) - (Pago + A pagar). Esta visão anual não é cortada pelo filtro de datas da página."', 'infoContent="Recebido, a receber, pago, a pagar e resultado por mês de 2026."', 'flux anual')


visao = 'src/app/visao-financeira/page.js'
replace_once(visao, 'infoContent="Concentração das saídas por plano de conta. Retiradas dos sócios não entram nesta visão."', 'infoContent="Saídas agrupadas por plano de conta no período selecionado, sem retiradas dos sócios."', 'visao despesas por conta')
