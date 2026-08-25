"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function markNegativeDreValues() {
  document.querySelectorAll('[data-report-section] td, [data-report-section] strong').forEach((element) => {
    if (element.children.length > 0) return;
    const text = cleanText(element.textContent);
    const isNegative = /^-\s*R\$/.test(text) || /^R\$\s*-/.test(text) || /^-\s*\d/.test(text);
    element.classList.toggle('dre-negative-value', isNegative);
  });
}

const demonstrativeCardPattern = /(saldo|contrat|fatur|receb|entrada|receita|pagamento|pago|pagar|resultado|margem|curva|progresso|imposto|custo|despesa|status|ranking|top\s|evolução|evolucao|composição|composicao|distribuição|distribuicao|financeiro|fluxo)/i;

function cardExplanation(title) {
  const text = cleanText(title).toLowerCase();
  if (text.includes('saldo banc')) return { what: 'Soma dos saldos bancários considerados no painel.', read: 'Mostra quanto há disponível nas contas. Valores negativos indicam saldo bancário devedor.' };
  if (text.includes('saldo contrat')) return { what: 'Valor dos contratos que ainda não foi faturado.', read: 'Quanto maior o saldo, maior o valor que ainda resta faturar.' };
  if (text.includes('curva abc')) return { what: 'Agrupa os projetos pelo valor total de cada contrato.', read: 'A: acima de R$ 500 mil. B: de R$ 100 mil a R$ 500 mil. C: abaixo de R$ 100 mil.' };
  if (text.includes('progresso') && text.includes('contrat')) return { what: 'Compara o contrato com o que já foi faturado.', read: 'Quanto maior o percentual faturado, mais avançado está o contrato.' };
  if (text.includes('imposto')) return { what: 'Mostra os impostos associados ao faturamento dos projetos.', read: 'PIS, COFINS, ISS, IRPJ, CSLL e outros impostos de faturamento aparecem separados. Retenções de fornecedores não entram.' };
  if (text.includes('a receber')) return { what: 'Valores registrados que ainda devem entrar no caixa.', read: 'São títulos em aberto; não significa que o dinheiro já entrou.' };
  if (text.includes('recebido') || text.includes('entradas realizadas')) return { what: 'Valores que já entraram no caixa.', read: 'Em visões gerais, empréstimos e aportes são separados das receitas para não confundir entrada de caixa com receita.' };
  if (text.includes('a pagar')) return { what: 'Valores registrados que ainda precisam ser pagos.', read: 'Mostra compromissos futuros de saída do caixa.' };
  if (text === 'pago' || text.includes('pagamentos realizados')) return { what: 'Valores que já saíram do caixa.', read: 'Quanto maior o valor, maior foi o desembolso realizado.' };
  if (text.includes('anual')) return { what: 'Mostra as movimentações financeiras mês a mês no ano.', read: 'Entradas realizadas já aconteceram. Entradas programadas são títulos a receber, não meta nem orçamento. Saídas representam pagamentos.' };
  if (text.includes('receita') || text.includes('fonte')) return { what: 'Mostra as receitas ou suas principais fontes.', read: 'Quanto maior a barra ou valor, maior a participação daquela fonte ou projeto.' };
  if (text.includes('despesa') || text.includes('custo') || text.includes('saída') || text.includes('saida')) return { what: 'Mostra onde os gastos estão concentrados.', read: 'Quanto maior a barra ou valor, maior o gasto naquele projeto, conta ou grupo.' };
  if (text.includes('resultado') || text.includes('margem')) return { what: 'Resume o resultado financeiro e sua relação com a receita.', read: 'Resultado positivo indica receita maior que custos e despesas. A margem mostra quanto desse resultado representa sobre a receita.' };
  if (text.includes('status')) return { what: 'Divide os valores conforme a situação financeira atual.', read: 'Compare realizado e pendente para ver o que já aconteceu e o que ainda está em aberto.' };
  if (text.includes('fluxo') || text.includes('evolução') || text.includes('evolucao')) return { what: 'Mostra como entradas e saídas evoluem ao longo do período.', read: 'Compare os períodos e os valores para identificar concentração de entradas, saídas e mudanças no resultado.' };
  return { what: 'Resume visualmente este indicador.', read: 'Compare o valor principal com os demais dados do card para entender a posição apresentada.' };
}

function getCardTitle(card) {
  const heading = card.querySelector('h2, h3');
  if (heading) return cleanText(heading.textContent);
  const label = Array.from(card.querySelectorAll(':scope > p, :scope > div > p')).find((node) => {
    const text = cleanText(node.textContent);
    return text && /[A-Za-zÀ-ÿ]/.test(text) && text.length <= 100;
  });
  return cleanText(label?.textContent);
}

function isDemonstrativeCard(card) {
  if (!card || card.querySelector('[data-card-help]')) return false;
  if (card.querySelector('input, select, textarea')) return false;
  if (card.querySelector(':scope .card')) return false;
  const title = getCardTitle(card);
  if (!title) return false;
  const hasChart = Boolean(card.querySelector('.recharts-wrapper, canvas'));
  const hasMetric = /R\$|%/.test(cleanText(card.textContent));
  return hasChart || (hasMetric && demonstrativeCardPattern.test(title));
}

function closeOtherPopovers(current) {
  document.querySelectorAll('[data-card-popover]').forEach((popover) => {
    if (popover !== current) popover.hidden = true;
  });
}

function installCardHelp() {
  document.querySelectorAll('.card').forEach((card) => {
    if (!isDemonstrativeCard(card)) return;
    const title = getCardTitle(card) || 'Indicador';
    const explanation = cardExplanation(title);
    card.classList.add('has-demonstrative-help');

    const wrap = document.createElement('span');
    wrap.setAttribute('data-card-help', 'true');
    wrap.className = 'card-help-wrap';

    const help = document.createElement('button');
    help.type = 'button';
    help.className = 'card-help-icon';
    help.setAttribute('aria-label', `Informações sobre ${title}`);
    help.setAttribute('title', 'Informações');
    help.textContent = 'i';

    const popover = document.createElement('div');
    popover.setAttribute('data-card-popover', 'true');
    popover.className = 'card-help-popover';
    popover.hidden = true;
    popover.innerHTML = `<strong>O que é</strong><p>${explanation.what}</p><strong>Leitura</strong><p>${explanation.read}</p>`;

    const open = () => {
      closeOtherPopovers(popover);
      popover.hidden = false;
    };
    const close = () => { popover.hidden = true; };
    wrap.addEventListener('mouseenter', open);
    wrap.addEventListener('mouseleave', close);
    help.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      const willOpen = popover.hidden;
      closeOtherPopovers(popover);
      popover.hidden = !willOpen;
    };

    wrap.appendChild(help);
    wrap.appendChild(popover);
    card.appendChild(wrap);
  });
}

export default function UiEnhancements() {
  const pathname = usePathname();
  useEffect(() => {
    let frame;
    const apply = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (pathname.startsWith('/dre')) markNegativeDreValues();
        installCardHelp();
      });
    };
    const handleDocumentClick = () => closeOtherPopovers(null);
    document.addEventListener('click', handleDocumentClick);
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener('click', handleDocumentClick);
    };
  }, [pathname]);
  return null;
}
