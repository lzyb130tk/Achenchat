import { appHeader } from '../components/app-header.js';
import { icon } from '../components/icons.js';
import { closeActiveSheet, openSheet } from '../components/sheet.js';
import { toast } from '../components/toast.js';
import {
  creditWallet,
  getAllCharacters,
  getWallet,
  sendRedPacket,
  settleShopIncome,
} from '../services/store.js';
import {
  escapeHTML,
  formatDateTime,
  formatMoney,
  formatMoneyDelta,
} from '../services/utils.js';

function transactionIcon(type) {
  if (type === 'salary' || type === 'early-salary' || type === 'order-salary') return 'storefront';
  if (type === 'redpacket-out') return 'envelope-simple';
  if (type === 'redpacket-in') return 'gift';
  return 'wallet';
}

export function renderWallet({ refresh } = {}) {
  const payouts = settleShopIncome();
  if (payouts.length) toast('小店工资已到账');
  const wallet = getWallet();

  const screen = document.createElement('section');
  screen.className = 'screen screen--wallet';
  screen.innerHTML = `
    ${appHeader({ title: '钱包', backTo: '#/me', action: '<button class="wallet-header-detail" type="button" data-wallet-ledger>明细</button>' })}
    <main class="page-scroll">
      <div class="page-content page-content--wallet">
        <section class="wallet-card">
          <span class="wallet-card__label">${icon('wallet')}零钱余额</span>
          <strong class="wallet-card__amount">${formatMoney(wallet.balanceFen)}</strong>
          <p>红包往来和小店工资，都存放在这里。</p>
          <div class="wallet-card__actions">
            <button class="button button--primary" type="button" data-wallet-topup>充值</button>
            <button class="button button--secondary" type="button" data-wallet-transfer>转出</button>
          </div>
        </section>
        <section class="ledger">
          <h2 class="settings-group__label">最近明细</h2>
          ${
            wallet.transactions.length
              ? `<div class="ledger-list">
                  ${wallet.transactions
                    .map((transaction) => {
                      const outgoing = transaction.type === 'redpacket-out';
                      return `<div class="ledger-row">
                        <span class="ledger-row__icon">${icon(transactionIcon(transaction.type))}</span>
                        <span class="ledger-row__copy">
                          <strong>${escapeHTML(transaction.label)}</strong>
                          <small>${formatDateTime(transaction.createdAt)}</small>
                        </span>
                        <span class="ledger-row__amount${outgoing ? ' is-out' : ''}">${formatMoneyDelta(transaction.amountFen, transaction.type)}</span>
                      </div>`;
                    })
                    .join('')}
                </div>`
              : `<p class="settings-empty__text">还没有零钱记录。</p>`
          }
        </section>
        <p class="wallet-privacy">${icon('shield-check')}资金记录仅保存在你的设备上 · 演示零钱不涉及真实支付</p>
      </div>
    </main>`;
  screen.querySelector('[data-wallet-ledger]').addEventListener('click', () => {
    screen.querySelector('.ledger').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  screen.querySelector('[data-wallet-topup]').addEventListener('click', () => {
    openSheet({
      title: '充值演示零钱',
      description: '仅供应用内体验，不会发起真实支付。',
      content: `<label class="field"><span class="field__label">金额（元）</span><span class="field__control"><input class="field__input" type="number" min="1" max="500" step="0.01" value="20" data-topup-amount></span></label>`,
      actions: '<button class="button button--primary" type="button" data-confirm-topup>充值到钱包</button>',
      onMount: (sheet) => {
        sheet.querySelector('[data-confirm-topup]').addEventListener('click', () => {
          const amount = Number(sheet.querySelector('[data-topup-amount]').value);
          if (!Number.isFinite(amount) || amount < 1 || amount > 500) {
            toast('请输入 1–500 元', { tone: 'danger' });
            return;
          }
          creditWallet(Math.round(amount * 100), 'topup', '演示零钱充值');
          closeActiveSheet();
          toast('演示零钱已到账');
          refresh?.();
        });
      },
    });
  });
  screen.querySelector('[data-wallet-transfer]').addEventListener('click', () => {
    const characters = getAllCharacters();
    if (!characters.length) {
      toast('先添加一位伙伴', { tone: 'danger' });
      return;
    }
    openSheet({
      title: '转给伙伴',
      description: '将以红包形式从钱包转出。',
      content: `<label class="field"><span class="field__label">伙伴</span><span class="field__control field__control--select"><select class="field__input field__select" data-transfer-to>${characters.map((item) => `<option value="${escapeHTML(item.id)}">${escapeHTML(item.name)}</option>`).join('')}</select></span></label>
        <label class="field"><span class="field__label">金额（元）</span><span class="field__control"><input class="field__input" type="number" min="0.01" step="0.01" data-transfer-amount></span></label>`,
      actions: '<button class="button button--primary" type="button" data-confirm-transfer>转出</button>',
      onMount: (sheet) => {
        sheet.querySelector('[data-confirm-transfer]').addEventListener('click', () => {
          const amount = Number(sheet.querySelector('[data-transfer-amount]').value);
          if (!Number.isFinite(amount) || amount <= 0) {
            toast('请输入转出金额', { tone: 'danger' });
            return;
          }
          const result = sendRedPacket(sheet.querySelector('[data-transfer-to]').value, Math.round(amount * 100), '心意');
          if (!result.ok) {
            toast(result.message, { tone: 'danger' });
            return;
          }
          closeActiveSheet();
          toast('已转给伙伴');
          refresh?.();
        });
      },
    });
  });
  return { element: screen };
}
