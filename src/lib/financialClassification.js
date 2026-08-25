function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

function accountCode(item) {
  return String(item?.contaCodigo || '').replace(/\D/g, '');
}

export function classifyFinancialEntry(item) {
  if (!item || item.natureza !== 'Entrada') {
    return {
      label: item?.natureza === 'Saída' ? 'Saída / Pagamento' : 'Não classificado',
      type: item?.natureza === 'Saída' ? 'saida' : 'outro',
      isRevenue: false,
    };
  }

  const code = accountCode(item);
  const text = normalizeText(`${item.contaNome || ''} ${item.contaDescricao || ''} ${item.dreClasse || ''} ${item.drePacote || ''} ${item.dreLinha || ''}`);

  if (code === '1020101' || text.includes('APORTE')) {
    return { label: 'Aportes', type: 'aporte', isRevenue: false };
  }

  if (
    code === '1020202'
    || text.includes('CAPITAL DE GIRO')
    || text.includes('EMPREST')
    || text.includes('FINANCIAMENTO')
  ) {
    return { label: 'Empréstimos / Financiamentos', type: 'emprestimo', isRevenue: false };
  }

  if (
    code === '1030101'
    || text.includes('RESGATE APLIC')
    || text.includes('APLICACOES FINANCEIRAS')
  ) {
    return { label: 'Movimentações Financeiras', type: 'movimentacao_financeira', isRevenue: false };
  }

  if (code === '1010107' || text.includes('REC. ADMINISTRATIVO') || text.includes('REC ADMINISTRATIVO')) {
    return { label: 'Receitas Administrativas', type: 'receita_administrativa', isRevenue: true };
  }

  // Regra oficial: toda linha classificada como faturamento é Receita de Projetos.
  // A classificação não depende do nome do centro de custo, pois ele pode vir genérico
  // no relatório do Sienge. A parcela administrativa continua tratada acima.
  if (code === '1010101' || text.includes('REC. FATURAMENTO') || text.includes('REC FATURAMENTO')) {
    return { label: 'Receita de Projetos', type: 'receita_projeto', isRevenue: true };
  }

  if (
    text.includes('ESTORNO')
    || text.includes('REC. OPERACIONAL')
    || text.includes('REC OPERACIONAL')
    || code.startsWith('101')
  ) {
    return { label: 'Outras Receitas', type: 'outra_receita', isRevenue: true };
  }

  return { label: 'Outras Entradas', type: 'outra_entrada', isRevenue: false };
}

export function isSupplierTax(item) {
  const code = accountCode(item);
  const text = normalizeText(`${item?.contaNome || ''} ${item?.contaDescricao || ''} ${item?.dreClasse || ''} ${item?.drePacote || ''} ${item?.dreLinha || ''}`);
  return code === '2030303' || text.includes('RETENCOES FORNECEDORES') || text.includes('RETENCAO FORNECEDOR');
}

export function isRevenueTax(item) {
  if (!item || item.natureza !== 'Saída' || isSupplierTax(item)) return false;

  const code = accountCode(item);
  const text = normalizeText(`${item.contaNome || ''} ${item.contaDescricao || ''} ${item.dreClasse || ''} ${item.drePacote || ''} ${item.dreLinha || ''}`);

  return (
    ['2030101', '2030102', '2030103'].includes(code)
    || text.includes('IMPOSTOS SOBRE FATURAMENTO')
    || text.includes('DEDUCOES DA RECEITA')
  );
}

export function getRevenueTaxLabel(item) {
  const code = accountCode(item);
  const text = normalizeText(`${item?.contaNome || ''} ${item?.contaDescricao || ''}`);
  if (code === '2030101' || /(^|\s)PIS(\s|$)/.test(text)) return 'PIS';
  if (code === '2030102' || text.includes('COFINS')) return 'COFINS';
  if (code === '2030103' || text.includes('ISS')) return 'ISS';
  return String(item?.contaNome || item?.contaDescricao || 'Outros impostos').trim();
}

export function getAccountGroup(value) {
  const text = normalizeText(value);
  if (!text) return 'OUTROS';
  if (text.includes('C.D.P') || text.includes('CDP')) return 'C.D.P.';
  if (text.includes('EQUIP')) return 'EQUIPE';
  if (text.includes('IMPOST') || text.includes('ISS') || text.includes('PIS') || text.includes('COFINS') || text.includes('CSLL') || text.includes('IRPJ')) return 'IMPOSTOS';
  if (text.includes('DESP')) return 'DESPESAS';
  if (text.includes('REC')) return 'RECEITAS';
  return 'OUTROS';
}
