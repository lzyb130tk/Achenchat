import { appHeader } from '../components/app-header.js';
import { icon } from '../components/icons.js';
import { closeActiveSheet, openSheet } from '../components/sheet.js';
import { toast } from '../components/toast.js';
import {
  SHOP_TYPES,
  formatPayrollTime,
  getShopType,
} from '../data/shop.js';
import {
  claimEarlySalary,
  getShop,
  openShop,
  settleShopIncome,
} from '../services/store.js';
import { escapeHTML, formatMoney } from '../services/utils.js';

function shopOption(type) {
  const min = Math.round(type.minFen / 100);
  const max = Math.round(type.maxFen / 100);
  return `<button class="shop-option shop-option--${type.tone}" type="button" data-shop-type="${type.id}">
    <span class="shop-option__icon">${icon(type.icon)}</span>
    <span class="shop-option__copy">
      <strong>${escapeHTML(type.name)}</strong>
      <small>${escapeHTML(type.blurb)}</small>
    </span>
    <span class="shop-option__income">¥${min}–${max}<small>每天</small></span>
  </button>`;
}

function chooseShop(type, refresh) {
  openSheet({
    title: `开一家${type.name}？`,
    description: '开店免费。每天中午 12:00 结算工资，直接存入钱包。',
    content: `<div class="shop-confirm shop-confirm--${type.tone}">
      <span class="shop-confirm__icon">${icon(type.icon)}</span>
      <h3>${escapeHTML(type.name)}</h3>
      <p>${escapeHTML(type.blurb)}</p>
      <span class="shop-confirm__range">每天约 ¥${Math.round(type.minFen / 100)}–${Math.round(type.maxFen / 100)}</span>
    </div>`,
    actions: `<button class="button button--primary" type="button" data-confirm-open>开店</button>`,
    onMount: (sheet) => {
      sheet.querySelector('[data-confirm-open]').addEventListener('click', () => {
        const opened = openShop(type.id);
        if (!opened) {
          toast('现在还不能开店', { tone: 'danger' });
          return;
        }
        closeActiveSheet();
        toast(`${type.name}开张了`);
        refresh();
      });
    },
  });
}

function openEarlyClaim(shop, type, refresh) {
  const gross = shop.pendingFen;
  const fee = Math.round(gross * 0.1);
  const net = gross - fee;
  openSheet({
    title: '提前领取工资',
    description: '现在领取，需要扣除 10% 手续费。',
    content: `<div class="salary-breakdown">
      <div><span>本轮工资</span><strong>${formatMoney(gross)}</strong></div>
      <div><span>手续费</span><strong class="is-fee">−${formatMoney(fee)}</strong></div>
      <div class="salary-breakdown__total"><span>到账</span><strong>${formatMoney(net)}</strong></div>
    </div>`,
    actions: `<button class="button button--primary" type="button" data-confirm-early>领取 ${formatMoney(net)}</button>`,
    onMount: (sheet) => {
      sheet.querySelector('[data-confirm-early]').addEventListener('click', () => {
        const result = claimEarlySalary();
        if (!result.ok) {
          toast(result.message || '现在还不能领取', { tone: 'danger' });
          return;
        }
        closeActiveSheet();
        toast(`${formatMoney(result.netFen)} 已到账，手续费 ${formatMoney(result.feeFen)}`);
        refresh();
      });
    },
  });
}

export function renderShop({ refresh }) {
  const payouts = settleShopIncome();
  if (payouts.length) toast('小店工资已到账');
  const shop = getShop();
  const type = shop ? getShopType(shop.typeId) : null;

  const screen = document.createElement('section');
  screen.className = 'screen';

  if (!shop || !type) {
    screen.innerHTML = `
      ${appHeader({ title: '小店', backTo: '#/me' })}
      <main class="page-scroll">
        <div class="page-content page-content--shop">
          <section class="shop-intro">
            <span class="shop-intro__icon">${icon('storefront')}</span>
            <h2>开一家自己的小店</h2>
            <p>每天中午 12:00 发一次工资。想早点拿到，也可以付 10% 手续费提前领取。</p>
          </section>
          <div class="shop-options">
            ${SHOP_TYPES.map(shopOption).join('')}
          </div>
        </div>
      </main>`;
    screen.querySelectorAll('[data-shop-type]').forEach((button) => {
      button.addEventListener('click', () => {
        const option = SHOP_TYPES.find((item) => item.id === button.dataset.shopType);
        if (option) chooseShop(option, refresh);
      });
    });
    return { element: screen };
  }

  const earlyClaimed = shop.earlyClaimedAt === shop.payrollAt;
  const canClaimEarly = shop.pendingFen > 0 && !earlyClaimed;
  const fee = Math.round(shop.pendingFen * 0.1);

  screen.innerHTML = `
    ${appHeader({ title: '小店', backTo: '#/me' })}
    <main class="page-scroll">
      <div class="page-content page-content--shop">
        <section class="shop-store shop-store--${type.tone}">
          <span class="shop-store__wash" aria-hidden="true"></span>
          <span class="shop-store__icon">${icon(type.icon)}</span>
          <div class="shop-store__copy">
            <span class="shop-store__eyebrow">营业中</span>
            <h2>${escapeHTML(type.name)}</h2>
            <p>${escapeHTML(type.blurb)}</p>
          </div>
        </section>
        <section class="salary-card">
          <div class="salary-card__head">
            <span>本轮工资</span>
            <span class="salary-card__time">${icon('clock')}${formatPayrollTime(shop.payrollAt)}</span>
          </div>
          <strong class="salary-card__amount">${earlyClaimed ? '已提前领取' : formatMoney(shop.pendingFen)}</strong>
          <p class="salary-card__hint">${earlyClaimed ? '下一轮工资会在明天中午重新开始计算。' : `提前领取会扣除 ${formatMoney(fee)} 手续费，到账 ${formatMoney(shop.pendingFen - fee)}。`}</p>
          <button class="button button--primary salary-card__button" type="button" data-early-claim ${canClaimEarly ? '' : 'disabled'}>
            ${earlyClaimed ? '本轮已领取' : '提前领取'}
          </button>
        </section>
        <div class="shop-meta">
          <div><span>上次到账</span><strong>${shop.lastIncomeFen ? formatMoney(shop.lastIncomeFen) : '还没有'}</strong></div>
          <div><span>结算时间</span><strong>每天 12:00</strong></div>
        </div>
      </div>
    </main>`;

  screen.querySelector('[data-early-claim]')?.addEventListener('click', () => {
    if (!canClaimEarly) return;
    openEarlyClaim(getShop(), type, refresh);
  });

  return { element: screen };
}
