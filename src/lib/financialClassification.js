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

function accountText(item) {
  return normalizeText([
    item?.contaCodigo,
    item?.contaNome,
    item?.contaDescricao,
    item?.dreDescricao,
    item?.dreClasse,
    item?.drePacote,
    item?.dreLinha,
  ].filter(Boolean).join(' '));
}

function combinedText(item) {
  return normalizeText([
    accountText(item),
    item?.documento,
    item?.nome,
  ].filter(Boolean).join(' '));
}

// PRV e PCT representam documentos de previsao de recebimento. Mesmo que a
// origem traga um status inconsistente, eles nao podem ser tratados como caixa recebido.
export function isForecastOnlyReceivableDocument(item) {
  const document = normalizeText(item?.documento);
  if (!document) return false;
  return /^(PRV|PCT)(?:$|[.\s_/-]|\d)/.test(document);
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
  if (code === '1010107' || accountText(item).includes('REC. ADMINISTRATIVO') || accountText(item).includes('REC ADMINISTRATIVO')) {
    return { type: 'receita_administrativa', label: 'Receita administrativa' };
  }
  if (code === '1010101' || accountText(item).includes('REC. FATURAMENTO') || accountText(item).includes('REC FATURAMENTO')) {
    return { type: 'receita_projeto', label: 'Receita de projeto' };
  }
  if (code === '10302' || accountText(item).includes('ACRESCIMOS RECEBIDOS')) {
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
  const text = accountText(item);
  return code === '2050101' || /\bRETIRAD(?:A|AS)\b.*\bSOCIOS?\b/.test(text);
}

export function isTeamExpense(item) {
  const code = normalizeAccountCode(item);
  const text = accountText(item);

  // Na base oficial, as contas de equipe aparecem como "EQUIP. TÉC.".
  // 201000x = disciplinas técnicas; 20103xx = Big Room/ADM/Coord/Terceiros.
  return code.startsWith('201000') ||
    code.startsWith('20103') ||
    /\bEQUIP\.?\s*TEC\b/.test(text) ||
    text.includes('EQUIPE TECNICA') ||
    text.includes('EQUIPE');
}

const REVENUE_TAX_CODES = new Set([
  '2030101', // PIS
  '2030102', // COFINS
  '2030103', // ISS
  '2030104', // IRPJ
  '2030105', // CSLL
  '2030107', // previsão de impostos
]);

export function isRevenueTax(item) {
  const code = normalizeAccountCode(item);
  const text = accountText(item);

  if (text.includes('RETENCOES FORNECEDORES')) return false;

  // INSS da OAE e recolhido/retido sobre o faturamento e, por isso, pertence ao
  // mesmo grupo gerencial dos tributos sobre receita. A identificacao textual e
  // necessaria porque a conta pode variar na base sem usar os codigos 20301xx.
  if (/\bINSS\b/.test(text)) return true;

  // Para os demais tributos, o codigo financeiro segue como fonte primaria.
  if (code) return REVENUE_TAX_CODES.has(code);

  // Fallback para snapshots antigos sem contaCodigo, olhando somente conta/DRE.
  return /(^|\s)(PIS|COFINS|ISS|IRPJ|CSLL)(\s|$)/.test(text) ||
    text.includes('IMPOSTOS RETIDOS NO FAT');
}

export function getRevenueTaxLabel(item) {
  const code = normalizeAccountCode(item);
  if (code === '2030101') return 'PIS';
  if (code === '2030102') return 'COFINS';
  if (code === '2030103') return 'ISS';
  if (code === '2030104') return 'IRPJ';
  if (code === '2030105') return 'CSLL';
  if (code === '2030107') return 'Impostos retidos / previsão';

  const text = accountText(item);
  if (/\bINSS\b/.test(text)) return 'INSS';
  if (/\bPIS\b/.test(text)) return 'PIS';
  if (/\bCOFINS\b/.test(text)) return 'COFINS';
  if (/\bISS\b/.test(text)) return 'ISS';
  if (/\bIRPJ\b/.test(text)) return 'IRPJ';
  if (/\bCSLL\b/.test(text)) return 'CSLL';
  return item?.contaNome || item?.contaDescricao || 'Tributos';
}
