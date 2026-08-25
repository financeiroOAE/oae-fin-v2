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

const demonstrativeCardPattern = /(saldo|contrat|fatur|receb|entrada|receita|pagamento|pago|pagar|resultado|margem|curva|progresso|imposto|tributo|custo|despesa|status|ranking|top\s|evolução|evolucao|composição|composicao|distribuição|distribuicao|financeiro|fluxo)/i;

function cardExplanation(title) {
  const text = cleanText(title).toLowerCase();
  if (text.includes('valor contratado') || text === 'contratado') return { what: 'Soma do valor dos contratos ativos cadastrados em PROJETOS_2026.', read: 'É o valor contratual total dos projetos exibidos no filtro atual.' };
  if (text.includes('faturado')) return { what: 'Soma do valor já faturado dos projetos na relação PROJETOS_2026.', read: 'Compara o que já foi faturado com o valor contratado.' };
  if (text.includes('saldo contrat')) return { what: 'Valor contratado menos o valor faturado.', read: 'Mostra quanto ainda resta faturar nos contratos exibidos.' };
  if (text.includes('recebido')) return { what: 'Receitas de projetos já realizadas na CR_GERAL.', read: 'Inclui faturamento da obra e receita administrativa vinculada; empréstimos e aportes não entram.' };
  if (text.includes('a receber')) return { what: 'Receitas de projetos com status A realizar na CR_GERAL.', read: 'Mostra títulos ainda em aberto, inclusive vencimentos futuros.' };
  if (text.includes('pago')) return { what: 'Saídas já realizadas na CP_GERAL para os projetos.', read: 'Não inclui despesas do centro de custo Administração como custo do projeto.' };
  if (text.includes('a pagar')) return { what: 'Previsões com status A realizar na CP_GERAL.', read: 'Inclui valores alocados nas obras e, na visão consolidada, a previsão geral registrada em PROJETOS.' };
  if (text.includes('saldo banc')) return { what: 'Soma dos saldos bancários considerados no painel.', read: 'Mostra a posição disponível nas contas bancárias cadastradas.' };
  if (text.includes('curva abc')) return { what: 'Agrupa os projetos pelo valor contratado.', read: 'Classe A: acima de R$ 500 mil; B: de R$ 100 mil a R$ 500 mil; C: abaixo de R$ 100 mil.' };
  if (text.includes('progresso') && text.includes('contrat')) return { what: 'Compara o valor contratado com o valor faturado.', read: 'O percentual indica quanto do contrato já foi faturado.' };
  if (text.includes('imposto') || text.includes('tributo')) return { what: 'Tributos relacionados aos projetos conforme DEPARA.', read: 'PIS, COFINS e ISS são deduções da receita; IRPJ e CSLL são tributos sobre o lucro.' };
  if (text.includes('receita') || text.includes('fonte')) return { what: 'Receitas registradas para os projetos.', read: 'Quanto maior a barra ou valor, maior a participação daquela obra no recebimento.' };
  if (text.includes('despesa') || text.includes('custo') || text.includes('saída') || text.includes('saida')) return { what: 'Saídas classificadas conforme o DEPARA.', read: 'Custos pertencem às obras; equipe e fornecedores lançados em Administração ficam na despesa administrativa da DRE.' };
  if (text.includes('resultado') || text.includes('margem')) return { what: 'Resultado depois de custos, despesas e tributos considerados na visão.', read: 'A margem representa o resultado em relação à receita de projetos.' };
  if (text.includes('status')) return { what: 'Separa valores realizados dos valores ainda em aberto.', read: 'Receitas usam Recebido/A receber; saídas usam Pago/A pagar.' };
  if (text.includes('fluxo') || text.includes('evolução') || text.includes('evolucao')) return { what: 'Evolução das entradas e saídas no período.', read: 'As barras mostram os valores por data ou mês, conforme o recorte selecionado.' };
  return { what: 'Indicador calculado a partir da base financeira oficial.', read: 'Use o valor e os filtros ativos para interpretar esta visão.' };
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
  // Cards que já têm o InfoTooltip antigo conservam somente aquele padrão.
  if (card.querySelector('.info-tooltip-container')) return false;
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

function positionPopover(help, popover) {
  if (!help || !popover) return;
  const rect = help.getBoundingClientRect();
  const width = Math.min(300, Math.max(230, window.innerWidth - 24));
  const left = Math.min(Math.max(12, rect.right - width), Math.max(12, window.innerWidth - width - 12));
  const showBelow = rect.top < 190;
  popover.style.width = `${width}px`;
  popover.style.left = `${left}px`;
  popover.style.top = showBelow ? `${rect.bottom + 8}px` : `${rect.top - 8}px`;
  popover.style.transform = showBelow ? 'none' : 'translateY(-100%)';
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
    popover.setAttribute('data-ui-help-portal', 'true');
    popover.className = 'card-help-popover card-help-popover-portal';
    popover.hidden = true;
    popover.innerHTML = `<strong>O que é</strong><p>${explanation.what}</p><strong>Leitura</strong><p>${explanation.read}</p>`;

    const open = () => {
      closeOtherPopovers(popover);
      positionPopover(help, popover);
      popover.hidden = false;
    };

    help.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      const willOpen = popover.hidden;
      closeOtherPopovers(popover);
      if (willOpen) open();
      else popover.hidden = true;
    };
    help.onfocus = open;

    const reposition = () => {
      if (!popover.hidden) positionPopover(help, popover);
    };
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);

    wrap.appendChild(help);
    card.appendChild(wrap);
    document.body.appendChild(popover);
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
      document.querySelectorAll('[data-ui-help-portal="true"]').forEach((popover) => popover.remove());
    };
  }, [pathname]);
  return null;
}
