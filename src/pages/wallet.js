import { appHeader } from '../components/app-header.js';
import { icon } from '../components/icons.js';
import { toast } from '../components/toast.js';
import {
  getWallet,
  settleShopIncome,
} from '../services/store.js';
import {
  formatDateTime,
  formatMoney,
  formatMoneyDelta,
} from '../services/utils.js';

function transactionIcon(type) {
  if (type === 'salary' || type === 'early-salary') return 'storefront';
  if (type === 'redpacket-out') return 'envelope-simple';
  if (type === 'redpacket-in') return 'gift';
  return 'wallet';
}

export function renderWallet() {
  const payouts = settleShopIncome();
  if (payouts.length) toast('小店工资已到账');
  const wallet = getWallet();

  const screen = document.createElement('section');
  screen.className = 'screen';
  screen.innerHTML = `
    ${appHeader({ title: '钱包', backTo: '#/me' })}
    <main class="page-scroll">
      <div class="page-content page-content--wallet">
        <section class="wallet-card">
          <span class="wallet-card__label">${icon('wallet')}零钱余额</span>
          <strong class="wallet-card__amount">${formatMoney(wallet.balanceFen)}</strong>
          <p>红包往来和小店工资，都存放在这里。</p>
        </section>
        <section class="ledger">
          <h2 class="settings-group__label">明细</h2>
          ${
            wallet.transactions.length
              ? `<div class="ledger-list">
                  ${wallet.transactions
                    .map((transaction) => {
                      const outgoing = transaction.type === 'redpacket-out';
                      return `<div class="ledger-row">
                        <span class="ledger-row__icon">${icon(transactionIcon(transaction.type))}</span>
                        <span class="ledger-row__copy">
                          <strong>${formatDateTime(transaction.createdAt)}</strong>
                          <small>${transaction.label}</small>
                        </span>
                        <span class="ledger-row__amount${outgoing ? ' is-out' : ''}">${formatMoneyDelta(transaction.amountFen, transaction.type)}</span>
                      </div>`;
                    })
                    .join('')}
                </div>`
              : `<p class="settings-empty__text">还没有零钱记录。</p>`
          }
        </section>
      </div>
    </main>`;
  return { element: screen };
}
