function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

export function normalizeAccountCode(item) {
  const explicit = String(item?.contaCodigo || '').trim();
  if (explicit) return explicit.replace(/\D/g, '');
  const raw = String(item?.contaDescricao || item?.contaNome || item?.conta || '').trim();
  return raw.match(/^(\d+)/)?.[1] || '';
}

function combinedText(item) {
  return normalizeText([
    item?.contaCodigo,
    item?.contaNome,
    item?.contaDescricao,
    item?.dreDescricao,
    item?.dreClasse,
    item?.drePacote,
    item?.dreLinha,
    item?.documento,
    item?.nome,
  ].filter(Boolean).join(' '));
}

export function classifyFinancialEntry(item) {
  const code = normalizeAccountCode(item);
  const text = combinedText(item);

  if (code === '1020101' || text.includes('APORTE DE SOCIO')) {
    return { type: 'aporte', label: 'Aporte de sócio' };
  }
  if (code === '1020202' || text.includes('CAPITAL DE GIRO') || text.includes('EMPREST') || text.includes('FINANCIAMENTO')) {
    return { type: 'emprestimo', label: 'Empréstimo / financiamento' };
  }
  if (code === '1030101' || text.includes('RESGATE DE APLIC') || text.includes('TRANSFERENCIA ENTRE CONTAS')) {
    return { type: 'movimentacao_financeira', label: 'Movimentação financeira' };
  }
  if (code === '1010107' || text.includes('REC. ADMINISTRATIVO') || text.includes('REC ADMINISTRATIVO')) {
    return { type: 'receita_administrativa', label: 'Receita administrativa' };
  }
  if (code === '1010101' || text.includes('REC. FATURAMENTO') || text.includes('REC FATURAMENTO')) {
    return { type: 'receita_projeto', label: 'Receita de projeto' };
  }
  if (code === '10302' || text.includes('ACRESCIMOS RECEBIDOS')) {
    return { type: 'acrescimo_recebido', label: 'Acréscimo recebido' };
  }
  if (String(item?.natureza || '').toUpperCase() === 'ENTRADA') {
    return { type: 'outra_receita', label: 'Outra entrada' };
  }
  return { type: 'saida', label: 'Saída' };
}

export function isProjectRevenue(item) {
  const classification = classifyFinancialEntry(item);
  return classification.type === 'receita_projeto' || classification.type === 'receita_administrativa';
}

export function isCapitalEntry(item) {
  const type = classifyFinancialEntry(item).type;
  return type === 'emprestimo' || type === 'aporte' || type === 'movimentacao_financeira';
}

export function isPartnerWithdrawal(item) {
  const code = normalizeAccountCode(item);
  const text = combinedText(item);
  return code === '2050101' || text.includes('RETIRADA DOS SOCIOS') || text.includes('RETIRADA DE SOCIO');
}

export function isTeamExpense(item) {
  const code = normalizeAccountCode(item);
  const text = combinedText(item);

  // Na base oficial, as contas de equipe aparecem como "EQUIP. TÉC." e não como "EQUIPE".
  // 201000x = disciplinas técnicas; 20103xx = Big Room/ADM/Coord/Terceiros.
  return code.startsWith('201000') ||
    code.startsWith('20103') ||
    /\bEQUIP\.?\s*TEC\b/.test(text) ||
    text.includes('EQUIPE TECNICA') ||
    text.includes('EQUIPE');
}

export function isRevenueTax(item) {
  const code = normalizeAccountCode(item);
  const text = combinedText(item);

  if (code === '2030303' || text.includes('RETENCOES FORNECEDORES')) return false;

  return ['2030101', '2030102', '2030103', '2030104', '2030105', '2030107'].includes(code) ||
    text.includes('PIS') ||
    text.includes('COFINS') ||
    text.includes('ISS') ||
    text.includes('IRPJ') ||
    text.includes('CSLL') ||
    text.includes('IMPOSTOS RETIDOS NO FAT');
}

export function getRevenueTaxLabel(item) {
  const code = normalizeAccountCode(item);
  const text = combinedText(item);
  if (code === '2030101' || /\bPIS\b/.test(text)) return 'PIS';
  if (code === '2030102' || text.includes('COFINS')) return 'COFINS';
  if (code === '2030103' || /\bISS\b/.test(text)) return 'ISS';
  if (code === '2030104' || text.includes('IRPJ')) return 'IRPJ';
  if (code === '2030105' || text.includes('CSLL')) return 'CSLL';
  if (code === '2030107') return 'Impostos retidos / previsão';
  return item?.contaNome || item?.contaDescricao || 'Tributos';
}
