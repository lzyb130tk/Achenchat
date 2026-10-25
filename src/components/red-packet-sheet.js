import { getWallet, sendRedPacket } from '../services/store.js';
import { escapeHTML, formatMoney } from '../services/utils.js';
import { icon } from './icons.js';
import { closeActiveSheet, openSheet } from './sheet.js';
import { toast } from './toast.js';

const QUICK_AMOUNTS = [520, 888, 1888];

export function openRedPacketSheet({ character, onSent }) {
  const wallet = getWallet();
  openSheet({
    title: '红包',
    description: `给${character.name}，从零钱里扣。`,
    content: `<div class="packet-compose">
      <div class="packet-envelope">
        <span class="packet-envelope__to">给 ${escapeHTML(character.name)}</span>
        <label class="packet-envelope__amount">
          <span>¥</span>
          <input type="number" inputmode="decimal" min="0.01" step="0.01" placeholder="0.00" aria-label="红包金额" data-amount>
        </label>
        <label class="packet-envelope__note">
          <span class="sr-only">红包留言</span>
          <input type="text" maxlength="30" autocomplete="off" value="恭喜发财，大吉大利" data-note>
        </label>
        <div class="packet-envelope__quick">
          ${QUICK_AMOUNTS.map(
            (amount) => `<button type="button" data-quick="${amount / 100}">¥${(amount / 100).toFixed(2)}</button>`,
          ).join('')}
        </div>
        <span class="packet-envelope__balance">${icon('wallet')}零钱 ${formatMoney(wallet.balanceFen)}</span>
      </div>
      <p class="packet-compose__hint">对方收下后，金额会进入对方的零钱。</p>
    </div>`,
    actions: `<button class="button button--primary" type="button" data-send-packet>塞钱进红包</button>`,
    onMount: (sheet) => {
      const amountInput = sheet.querySelector('[data-amount]');
      const noteInput = sheet.querySelector('[data-note]');

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
          toast('零钱不足', { tone: 'danger' });
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
