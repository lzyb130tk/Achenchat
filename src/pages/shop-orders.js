import { appHeader } from '../components/app-header.js';
import { icon } from '../components/icons.js';
import { toast } from '../components/toast.js';
import { evaluateShopOrders } from '../services/api.js';
import { getDailyOrderQuestions, getShopType } from '../data/shop.js';
import { getShop, getTodayShopOrder, hasApiConfig, settleDailyShopOrder } from '../services/store.js';
import { escapeHTML, formatMoney } from '../services/utils.js';

export function renderShopOrders() {
  const shop = getShop();
  const type = shop && getShopType(shop.typeId);
  if (!type) return null;
  const questions = getDailyOrderQuestions(type.id);
  const screen = document.createElement('section');
  screen.className = 'screen screen--shop-orders';

  const paint = () => {
    const settled = getTodayShopOrder();
    screen.innerHTML = `
      ${appHeader({ title: '今日订单', backTo: '#/shop' })}
      <main class="page-scroll">
        <div class="page-content page-content--shop-orders">
          <p class="orders-intro">${escapeHTML(type.name)} · 每天完成一次，三笔订单一起结算</p>
          ${settled
            ? `<section class="orders-result">
                <span class="orders-result__icon">${icon('check-circle')}</span>
                <h2>今天的订单已完成</h2>
                <strong>${formatMoney(settled.wageFen)}</strong>
                <p>${escapeHTML(settled.feedback || '辛苦了，明天再来。')}</p>
                <a class="button button--primary" href="#/shop">返回小店</a>
              </section>`
            : `<div class="orders-questions">
                ${questions.map((item, index) => `<fieldset class="orders-question" data-order-question="${index}">
                  <legend><span>订单 ${index + 1}</span>${escapeHTML(item.question)}</legend>
                  ${item.choices.map((choice, option) => `<label class="orders-choice">
                    <input type="radio" name="order-${index}" value="${option}">
                    <span>${escapeHTML(choice)}</span>
                  </label>`).join('')}
                </fieldset>`).join('')}
              </div>
              <p class="orders-api-note">提交后将三道选择发送给你配置的 AI 服务评估，并将虚拟订单工资存入钱包。${hasApiConfig() ? '' : '请先到<a href="#/settings/api">API 配置</a>完成设置。'}</p>
              <button class="button button--primary orders-submit" type="button" data-submit-orders>提交并结算</button>`}
        </div>
      </main>`;

    screen.querySelector('[data-submit-orders]')?.addEventListener('click', async (event) => {
      const button = event.currentTarget;
      const answers = questions.map((_, index) => {
        const selected = screen.querySelector(`input[name="order-${index}"]:checked`);
        return selected ? Number(selected.value) : null;
      });
      if (answers.some((answer) => answer === null)) {
        toast('请完成三笔订单的选择', { tone: 'danger' });
        return;
      }
      if (!hasApiConfig()) {
        toast('先在设置里配置 API 和模型', { tone: 'danger' });
        return;
      }
      button.disabled = true;
      button.textContent = '正在评估订单…';
      try {
        const result = await evaluateShopOrders({ typeId: type.id, answers });
        const saved = settleDailyShopOrder({ answers, ...result });
        if (!saved.ok) throw new Error(saved.message);
        toast(`${formatMoney(saved.record.wageFen)} 已存入钱包`);
        if (screen.isConnected) paint();
      } catch (error) {
        toast(error.message || '订单结算失败，请重试', { tone: 'danger' });
        if (button.isConnected) {
          button.disabled = false;
          button.textContent = '提交并结算';
        }
      }
    });
  };

  paint();
  return { element: screen };
}
