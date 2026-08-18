const fs = require('fs');

async function run() {
  try {
    const res = await fetch('http://localhost:3001/api/sync');
    const result = await res.json();
    
    if(!result || !result.data) {
      console.log("No data returned from API.");
      return;
    }
    
    const allData = result.data;
    const receitas = allData.filter(d => d.natureza === 'Entrada');
    const projetosRaw = result.projetos || [];
    
    // Filtra projetos "normais"
    let projList = projetosRaw.filter(p => p.OBRA && !p.OBRA.toUpperCase().includes('ADMINISTRATIVO') && !p.OBRA.toUpperCase().includes('ADMINISTRAÇÃO'));
    
    // Map base
    let projMap = {};
    projList.forEach(p => {
      projMap[p.OBRA] = { ...p, recebido: 0, aReceber: 0, recebidoAdm: 0, aReceberAdm: 0, transacoesAdm: [] };
    });

    let transacoesAdm = [];
    let transacoesDiretas = [];
    
    receitas.forEach(r => {
      const pName = r.projeto || '';
      if (pName.toUpperCase().includes('ADMINISTRATIVO') || pName.toUpperCase().includes('ADMINISTRAÇÃO')) {
        transacoesAdm.push(r);
      } else if (projMap[pName]) {
        transacoesDiretas.push(r);
        if (r.status === 'Recebido') projMap[pName].recebido += r.valor;
        else projMap[pName].aReceber += r.valor;
      }
    });

    let admMatchCount = 0;
    let admMatchValue = 0;
    let ambiguousCount = 0;
    let exemplos = [];

    // Tenta associar
    transacoesAdm.forEach(tAdm => {
      const keyAdm = `${(tAdm.lancamento||'').trim()}|${(tAdm.documento||'').trim()}|${(tAdm.nome||'').trim()}`;
      if (keyAdm === '||') return; // Sem dados pra cruzar

      // Acha diretas com mesma chave
      const matches = transacoesDiretas.filter(tDir => {
        const keyDir = `${(tDir.lancamento||'').trim()}|${(tDir.documento||'').trim()}|${(tDir.nome||'').trim()}`;
        return keyDir === keyAdm;
      });

      // Pega projetos únicos associados a esses matches
      const projetosMatched = [...new Set(matches.map(m => m.projeto))].filter(Boolean);

      if (projetosMatched.length === 1) {
        const pName = projetosMatched[0];
        admMatchCount++;
        admMatchValue += tAdm.valor;
        if (tAdm.status === 'Recebido') projMap[pName].recebidoAdm += tAdm.valor;
        else projMap[pName].aReceberAdm += tAdm.valor;
        
        projMap[pName].transacoesAdm.push(tAdm);

        if (exemplos.length < 3) {
          exemplos.push({
            Projeto: pName,
            Chave: keyAdm,
            ValorAdm: tAdm.valor,
            Status: tAdm.status,
            Origem: tAdm.origem
          });
        }
      } else if (projetosMatched.length > 1) {
        ambiguousCount++;
      }
    });

    console.log("=== RELATÓRIO DA REGRA RECEITA ADM ===");
    console.log(`Receitas adm encontradas: ${transacoesAdm.length}`);
    console.log(`Receitas adm associadas: ${admMatchCount}`);
    console.log(`Valor total associado: R$ ${admMatchValue.toFixed(2)}`);
    console.log(`Casos ambíguos não associados: ${ambiguousCount}`);
    console.log(`\nExemplos de Associação:`);
    console.log(JSON.stringify(exemplos, null, 2));

  } catch(e) {
    console.error(e);
  }
}

run();
