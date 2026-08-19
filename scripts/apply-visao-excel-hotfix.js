const fs = require('fs');

function replaceOrFail(content, target, replacement, label) {
  if (!content.includes(target)) {
    throw new Error(`Trecho não encontrado: ${label}`);
  }
  return content.replace(target, replacement);
}

const visaoPath = 'src/app/visao-financeira/page.js';
let visao = fs.readFileSync(visaoPath, 'utf8');

const filteredBlock = `  const filteredData = useMemo(() => {
    return baseData.filter(item => {
      if (filterStatus.length > 0 && !filterStatus.includes(item.statusExibicao)) return false;
      if (filterProjetos.length > 0 && !filterProjetos.includes(item.projeto)) return false;
      if (filterNomes.length > 0 && !filterNomes.includes(item.nome)) return false;
      if (filterContas.length > 0 && !filterContas.includes(item.contaDescricao)) return false;
      if (filterDataInicial) {
        const dIni = new Date(filterDataInicial + 'T00:00:00').getTime();
        if (item.dataTimestamp < dIni) return false;
      }
      if (filterDataFinal) {
        const dFim = new Date(filterDataFinal + 'T23:59:59').getTime();
        if (item.dataTimestamp > dFim) return false;
      }
      return true;
    });
  }, [baseData, filterDataInicial, filterDataFinal, filterProjetos, filterStatus, filterNomes, filterContas]);`;

const filteredReplacement = `${filteredBlock}

  // Base de conteúdo sem recorte temporal. É usada nos campos realizados para que
  // um filtro de datas futuras não apague o histórico realizado de 2026.
  const contentFilteredData = useMemo(() => {
    return baseData.filter(item => {
      if (filterStatus.length > 0 && !filterStatus.includes(item.statusExibicao)) return false;
      if (filterProjetos.length > 0 && !filterProjetos.includes(item.projeto)) return false;
      if (filterNomes.length > 0 && !filterNomes.includes(item.nome)) return false;
      if (filterContas.length > 0 && !filterContas.includes(item.contaDescricao)) return false;
      return true;
    });
  }, [baseData, filterProjetos, filterStatus, filterNomes, filterContas]);

  const realized2026Data = useMemo(() => {
    const start2026 = new Date(2026, 0, 1, 0, 0, 0, 0).getTime();
    const endToday = new Date().setHours(23, 59, 59, 999);
    return contentFilteredData.filter(item =>
      item.status === 'Realizado' &&
      item.dataTimestamp >= start2026 &&
      item.dataTimestamp <= endToday
    );
  }, [contentFilteredData]);`;

visao = replaceOrFail(visao, filteredBlock, filteredReplacement, 'filteredData');

const kpisOld = `  const entradasRealizadas = filteredData.filter(r => r.natureza === 'Entrada' && r.status === 'Realizado').reduce((acc, r) => acc + r.valor, 0);
  const entradasARealizar = filteredData.filter(r => r.natureza === 'Entrada' && r.status === 'A realizar').reduce((acc, r) => acc + r.valor, 0);
  const saidasRealizadas = filteredData.filter(r => r.natureza === 'Saída' && r.status === 'Realizado').reduce((acc, r) => acc + r.valor, 0);
  const saidasARealizar = filteredData.filter(r => r.natureza === 'Saída' && r.status === 'A realizar').reduce((acc, r) => acc + r.valor, 0);`;

const kpisNew = `  const entradasRealizadas = realized2026Data.filter(r => r.natureza === 'Entrada').reduce((acc, r) => acc + r.valor, 0);
  const entradasARealizar = filteredData.filter(r => r.natureza === 'Entrada' && r.status === 'A realizar').reduce((acc, r) => acc + r.valor, 0);
  const saidasRealizadas = realized2026Data.filter(r => r.natureza === 'Saída').reduce((acc, r) => acc + r.valor, 0);
  const saidasARealizar = filteredData.filter(r => r.natureza === 'Saída' && r.status === 'A realizar').reduce((acc, r) => acc + r.valor, 0);`;

visao = replaceOrFail(visao, kpisOld, kpisNew, 'KPIs realizados');

const reportRowsOld = `  const reportMovementRows = filteredData.map((item) => ({
    Data: item.data,
    Projeto: item.projeto,
    "Nome / Fornecedor": item.nome,
    Conta: item.contaDescricao,
    Situação: item.statusExibicao,
    Natureza: item.natureza,
    Valor: item.valor,
  }));`;

const reportRowsNew = `  const reportMovementRows = filteredData.map((item) => ({
    Data: item.data,
    Projeto: item.projeto,
    "Nome / Fornecedor": item.nome,
    Conta: item.contaDescricao,
    Documento: item.documento || '',
    Lançamento: item.lancamento || '',
    Situação: item.statusExibicao,
    Natureza: item.natureza,
    Valor: item.valor,
  }));`;

visao = replaceOrFail(visao, reportRowsOld, reportRowsNew, 'linhas do relatório');
fs.writeFileSync(visaoPath, visao);

const exportPath = 'src/lib/reportExport.js';
let reportExport = fs.readFileSync(exportPath, 'utf8');

const excelRowsOld = `  items.forEach((item, index) => {
    const rows = getReportRows(item);
    const worksheet = createWorksheet(XLSX, item, rows);`;

const excelRowsNew = `  items.forEach((item, index) => {
    // Excel é uma exportação de dados, não uma captura visual. Quando o bloco
    // oferece a relação completa filtrada, ela tem prioridade sobre resumo/visível.
    const rows = Array.isArray(item?.dataSets?.all)
      ? item.dataSets.all
      : getReportRows(item);
    const worksheet = createWorksheet(XLSX, item, rows);`;

reportExport = replaceOrFail(reportExport, excelRowsOld, excelRowsNew, 'fonte de dados do Excel');
fs.writeFileSync(exportPath, reportExport);

console.log('Hotfix aplicado com sucesso.');
