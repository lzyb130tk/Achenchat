import { getWallet, sendRedPacket } from '../services/store.js';
import { escapeHTML, formatMoney } from '../services/utils.js';
import { icon } from './icons.js';
import { closeActiveSheet, openSheet } from './sheet.js';
import { toast } from './toast.js';

const QUICK_AMOUNTS = [520, 888, 1888];

export function openRedPacketSheet({ character, onSent }) {
  const wallet = getWallet();
  openSheet({
    title: '发红包',
    description: `给${character.name}。红包会从钱包余额扣除。`,
    content: `<div class="red-packet-form">
      <div class="red-packet-balance">
        <span>钱包余额</span>
        <strong>${formatMoney(wallet.balanceFen)}</strong>
      </div>
      <div class="amount-field">
        <span class="amount-field__currency">¥</span>
        <input class="amount-field__input" type="number" inputmode="decimal" min="0.01" step="0.01" placeholder="0.00" aria-label="红包金额" data-amount>
      </div>
      <div class="quick-amounts">
        ${QUICK_AMOUNTS.map(
          (amount) => `<button class="quick-amount" type="button" data-quick="${amount / 100}">¥${(amount / 100).toFixed(2)}</button>`,
        ).join('')}
      </div>
      <label class="field">
        <span class="field__label">留言</span>
        <span class="field__control">
          <input class="field__input" name="note" maxlength="30" autocomplete="off" value="恭喜发财，大吉大利">
        </span>
      </label>
      <p class="red-packet-form__note">${icon('wallet')}发出后立即从钱包扣除，对方可以收下。</p>
    </div>`,
    actions: `<button class="button button--primary" type="button" data-send-packet>发红包</button>`,
    onMount: (sheet) => {
      const amountInput = sheet.querySelector('[data-amount]');
      const noteInput = sheet.querySelector('[name="note"]');

      sheet.querySelectorAll('[data-quick]').forEach((button) => {
        button.addEventListener('click', () => {
          amountInput.value = Number(button.dataset.quick).toFixed(2);
          amountInput.focus();
        });
      });

      sheet.querySelector('[data-send-packet]').addEventListener('click', () => {
        const amount = Number.parseFloat(amountInput.value);
        if (!Number.isFinite(amount) || amount <= 0) {
          toast('请输入红包金额', { tone: 'danger' });
          amountInput.focus();
          return;
        }
        const amountFen = Math.round(amount * 100);
        if (amountFen > getWallet().balanceFen) {
          toast('钱包余额不足', { tone: 'danger' });
          amountInput.focus();
          return;
        }
        const result = sendRedPacket(
          character.id,
          amountFen,
          noteInput.value.trim() || '恭喜发财，大吉大利',
        );
        if (!result.ok) {
          toast(result.message || '红包没有发出去', { tone: 'danger' });
          return;
        }
        closeActiveSheet();
        toast(`已送出 ${formatMoney(amountFen)} 红包`);
        onSent?.(result.message);
      });
    },
  });
}
