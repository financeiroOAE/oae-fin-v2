from pathlib import Path

path = Path('src/app/projetos/page.js')
text = path.read_text(encoding='utf-8')


def replace_once(old, new, label):
    global text
    if old not in text:
        raise RuntimeError(f'{label}: trecho nao encontrado')
    text = text.replace(old, new, 1)
    print(f'OK {label}')

replace_once('''          <InfoTooltip 
            title="Receita Administrativa Vinculada" 
            content={
              <>
                <p>Parcela da receita de um título lançada em centro de custo administrativo, mas vinculada ao projeto pela correspondência do mesmo Lançamento/Documento/Nome.</p>
                <p style={{ marginTop: '0.5rem' }}>Esta opção adiciona somente receitas administrativas vinculadas; despesas administrativas não são incorporadas ao projeto.</p>
                <ul style={{ paddingLeft: '1rem', marginTop: '0.5rem' }}>
                  <li><strong>Status Atual:</strong> {incluirRateioAdm ? 'Ativado (considerando rateio)' : 'Desativado (somente Receita Direta)'}</li>
                  <li><strong>Receita Adm. Total Vinculada:</strong> {formatCurrency(totalRecebidoAdmGlobal)}</li>
                </ul>
              </>
            } 
          />''', '<InfoTooltip title="Receita Administrativa Vinculada" content="Receita administrativa vinculada aos projetos selecionados." />', 'receita adm')

replace_once('''<InfoTooltip title="Composição Financeira (DRE)" content={<><p>Receita, Custo, Despesa e Tributos são classificados pelo DEPARA/DRE da conta financeira.</p><ul style={{ paddingLeft: '1rem', marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}><li><strong>Receita:</strong> contas classificadas como Receita. Deduções abatem este valor.</li><li><strong>Custo:</strong> contas classificadas como Custos dos Serviços.</li><li><strong>Despesa:</strong> demais saídas com DEPARA válido vinculadas às obras.</li><li><strong>Tributos:</strong> PIS, COFINS, ISS, IRPJ, CSLL e previsões de impostos vinculadas aos projetos.</li></ul><p style={{ marginTop: '0.5rem' }}>Movimentações sem classificação ficam em "Não Classificado".</p></>} />''', '<InfoTooltip title="Composição Financeira (DRE)" content="Receita, custos, despesas, tributos e valores não classificados dos projetos selecionados." />', 'composicao')

replace_once('''<InfoTooltip title="Movimentações Não Classificadas" content="Essas movimentações não entram na composição Receita/Custo/Despesa até terem classificação segura. Isso evita que o resultado gerencial seja calculado incorretamente." />''', '<InfoTooltip title="Movimentações Não Classificadas" content="Movimentações dos projetos selecionados que ainda não possuem classificação DRE válida." />', 'nao classificado')

replace_once('''<InfoTooltip title="Resultado e Margem" content={<><p><strong>Fórmula do Resultado:</strong><br />Receita de Projetos - Custos Diretos - Despesas - Tributos.</p><p style={{ marginTop: '0.5rem' }}><strong>Fórmula da Margem:</strong><br />(Resultado / Receita Líquida) × 100</p></>} />''', '<InfoTooltip title="Resultado e Margem" content="Resultado gerencial e margem dos projetos selecionados." />', 'resultado')

replace_once('''<InfoTooltip title="Evolução Financeira 2026" content="Linha mensal dos valores realizados: receitas de projetos, custos dos serviços e demais despesas vinculadas às obras. Tributos são exibidos separadamente na composição financeira e não são somados como despesas nesta linha." />''', '<InfoTooltip title="Evolução Financeira 2026" content="Receitas, custos e despesas realizados por mês em 2026." />', 'evolucao')

replace_once('''<InfoTooltip title="Curva ABC" content={<><p>Classifica os projetos pelo <strong>valor individual do contrato</strong>.</p><ul style={{ paddingLeft: '1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.5rem' }}><li><strong style={{ color: 'var(--success)' }}>Classe A:</strong> acima de R$ 500 mil.</li><li><strong style={{ color: 'var(--warning)' }}>Classe B:</strong> de R$ 100 mil a R$ 500 mil.</li><li><strong style={{ color: 'var(--danger)' }}>Classe C:</strong> abaixo de R$ 100 mil.</li></ul></>} />''', '<InfoTooltip title="Curva ABC" content="Distribuição dos projetos nas classes A, B e C pelo valor contratado." />', 'abc')

replace_once('''<InfoTooltip title="5 Maiores Fontes de Receita — Projetos" content={<><p>Exibe os 5 projetos/obras com maior receita recebida no período. Administração não entra neste ranking.</p><p style={{ marginTop: '0.5rem' }}>Não deduz saídas. Foco exclusivo no volume recebido.</p></>} />''', '<InfoTooltip title="5 Maiores Fontes de Receita — Projetos" content="Cinco projetos com maior receita recebida no período selecionado." />', 'top entradas')

replace_once('''<InfoTooltip title="5 Maiores Saídas" content={<><p>Exibe os 5 projetos com maior total de movimentações de <strong>Saída</strong> realizadas em 2026.</p><p style={{ marginTop: '0.5rem' }}>Não inclui previsões a pagar. Foco exclusivo no valor desembolsado.</p></>} />''', '<InfoTooltip title="5 Maiores Saídas" content="Cinco projetos com maior volume pago no período selecionado." />', 'top saidas')

replace_once('''<InfoTooltip title="Tributos sobre Receita e Lucro" content={<><p>Usa as saídas classificadas como deduções/impostos sobre faturamento e vinculadas aos projetos filtrados.</p><p style={{ marginTop: '0.5rem' }}><strong>Não inclui retenções de fornecedor.</strong></p></>} />''', '<InfoTooltip title="Tributos sobre Receita e Lucro" content="Tributos sobre receita e lucro vinculados aos projetos selecionados." />', 'tributos')

replace_once('''<InfoTooltip title="Progresso de Contrato" content={<><p>A barra total representa o <strong>Valor Contratado</strong> do projeto.</p><p>A parte turquesa representa o quanto já foi <strong>Faturado</strong>.</p><p>A parte amarela representa o <strong>Saldo</strong> restante a faturar.</p><p style={{ marginTop: '0.5rem' }}>Use os botões de filtro para aumentar a quantidade exibida.</p></>} />''', '<InfoTooltip title="Progresso de Contrato" content="Valor contratado, faturado e saldo dos projetos exibidos." />', 'progresso contrato')

replace_once('''<InfoTooltip title="Rateio Administrativo Aplicado" content="Valores de receita mapeados do Centro de Custo ADMINISTRAÇÃO com Lançamento correspondente" />''', '<InfoTooltip title="Rateio Administrativo Aplicado" content="Receita administrativa vinculada ao projeto selecionado." />', 'rateio drawer')

path.write_text(text, encoding='utf-8')
