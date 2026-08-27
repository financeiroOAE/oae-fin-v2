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
  if (text.includes('valor contratado') || text === 'contratado') return 'Representa o valor total dos contratos selecionados e o tamanho da carteira contratada.';
  if (text.includes('faturado em 2026')) return 'Representa quanto dos contratos foi faturado especificamente durante o exercício de 2026.';
  if (text.includes('% faturado')) return 'Indica quanto do valor total contratado já foi convertido em faturamento.';
  if (text.includes('faturado')) return 'Representa a parcela dos contratos já transformada em faturamento ao cliente. Faturado não significa necessariamente recebido.';
  if (text.includes('saldo contrat')) return 'Representa a parcela dos contratos ainda não faturada e o potencial restante da carteira.';
  if (text.includes('a receber')) return 'Representa valores reconhecidos para recebimento que ainda não entraram no caixa.';
  if (text.includes('recebido')) return 'Representa o valor que efetivamente entrou no caixa após descontos, retenções ou diferenças entre faturado e recebido.';
  if (text.includes('a pagar')) return 'Representa compromissos financeiros previstos ou assumidos que ainda não foram pagos.';
  if (text.includes('pago')) return 'Representa as saídas financeiras já efetivamente pagas.';
  if (text.includes('saldo banc')) return 'Representa a posição disponível nas contas bancárias consideradas no painel.';
  if (text.includes('curva abc')) return 'Mostra a concentração financeira dos projetos por classes, ajudando a identificar dependência dos maiores contratos.';
  if (text.includes('progresso') && text.includes('contrat')) return 'Compara o contratado, o faturado e o saldo, permitindo acompanhar o avanço comercial dos contratos.';
  if (text.includes('imposto') || text.includes('tributo')) return 'Representa impostos e encargos relacionados à operação e evidencia seu impacto financeiro.';
  if (text.includes('margem')) return 'Indica proporcionalmente quanto da receita permanece como resultado após as saídas consideradas.';
  if (text.includes('resultado')) return 'Representa a diferença entre entradas e saídas consideradas na análise, demonstrando o saldo gerado no período.';
  if (text.includes('receita') || text.includes('fonte')) return 'Mostra a origem e a concentração das receitas no período selecionado.';
  if (text.includes('despesa') || text.includes('custo') || text.includes('saída') || text.includes('saida')) return 'Representa os recursos consumidos na operação no período analisado.';
  if (text.includes('status')) return 'Compara valores realizados e ainda em aberto para apoiar decisões de caixa.';
  if (text.includes('fluxo') || text.includes('evolução') || text.includes('evolucao')) return 'Mostra a evolução das entradas e saídas ao longo do período, facilitando a leitura de tendências.';
  return 'Resume o indicador selecionado e apoia sua interpretação gerencial.';
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
  if (card.querySelector('.info-tooltip-container')) return false;
  if (card.querySelector('button, [role="button"], a, input, select, textarea')) return false;
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
  const width = Math.min(250, Math.max(180, window.innerWidth - 24));
  const left = Math.min(Math.max(12, rect.right + 8), Math.max(12, window.innerWidth - width - 12));
  const fitsRight = rect.right + 8 + width <= window.innerWidth - 12;
  popover.style.width = `${width}px`;
  popover.style.left = `${fitsRight ? rect.right + 8 : Math.max(12, rect.left - width - 8)}px`;
  popover.style.top = `${Math.min(Math.max(12, rect.top - 2), window.innerHeight - 80)}px`;
  popover.style.transform = 'none';
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
    help.setAttribute('aria-label', `Informação sobre ${title}`);
    help.textContent = 'i';

    const popover = document.createElement('div');
    popover.setAttribute('data-card-popover', 'true');
    popover.setAttribute('data-ui-help-portal', 'true');
    popover.className = 'card-help-popover card-help-popover-portal';
    popover.hidden = true;
    popover.innerHTML = `<p style="margin:0">${explanation}</p>`;

    const open = () => {
      closeOtherPopovers(popover);
      positionPopover(help, popover);
      popover.hidden = false;
    };
    const close = () => { popover.hidden = true; };

    help.addEventListener('mouseenter', open);
    help.addEventListener('mouseleave', close);
    help.addEventListener('focus', open);
    help.addEventListener('blur', close);
    help.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (window.matchMedia?.('(hover: none)').matches) {
        const willOpen = popover.hidden;
        closeOtherPopovers(popover);
        if (willOpen) open();
      }
    };

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
