import { appHeader } from '../components/app-header.js';
import { profileAvatar } from '../components/avatar.js';
import { bottomNav } from '../components/bottom-nav.js';
import { icon, iconButton } from '../components/icons.js';
import { openMaskEditor } from '../components/mask-editor.js';
import { settingsGroup, settingsRow } from '../components/settings-row.js';
import { openSheet } from '../components/sheet.js';
import { getShopType } from '../data/shop.js';
import {
  getActiveMask,
  getMasks,
  getProfile,
  getShop,
  getStickerPacks,
  getWallet,
} from '../services/store.js';
import { escapeHTML, formatMoney } from '../services/utils.js';

export function renderMe({ refresh }) {
  const profile = getProfile();
  const wallet = getWallet();
  const shop = getShop();
  const shopType = shop ? getShopType(shop.typeId) : null;
  const stickerPacks = getStickerPacks();
  const enabledPacks = stickerPacks.filter((pack) => pack.enabled).length;
  const maskCount = getMasks().length;
  const stickerValue = stickerPacks.length
    ? `${enabledPacks}/${stickerPacks.length} 包开启`
    : '未添加';

  const screen = document.createElement('section');
  screen.className = 'screen screen--me';
  screen.innerHTML = `
    ${appHeader({
      title: '我',
      action: iconButton({ name: 'gear-six', label: '设置', href: '#/settings' }),
    })}
    <main class="page-scroll">
      <div class="page-content page-content--me">
        <section class="profile-card">
          <button class="profile-card__avatar" type="button" data-edit-profile aria-label="编辑头像">
            ${profileAvatar(profile, '2xl')}
          </button>
          <div class="profile-card__copy">
            <h2>${escapeHTML(profile.name)}</h2>
            ${profile.signature ? `<p>${escapeHTML(profile.signature)}</p>` : ''}
            <a class="mask-pill" href="#/masks">
              ${icon('mask-happy')}
              <span>切换面具 · ${maskCount} 个</span>
              ${icon('caret-right')}
            </a>
          </div>
          <button class="profile-card__edit" type="button" data-edit-profile>
            ${icon('pencil-simple')}<span>编辑资料</span>
          </button>
        </section>
        ${settingsGroup({
          label: '我的',
          rows: [
            settingsRow({
              iconName: 'wallet',
              label: '钱包',
              value: formatMoney(wallet.balanceFen),
              action: 'wallet',
            }),
            settingsRow({
              iconName: 'storefront',
              label: '小店',
              value: shopType ? shopType.name : '未开店',
              action: 'shop',
            }),
            settingsRow({
              iconName: 'sticker',
              label: '表情',
              value: stickerValue,
              action: 'stickers',
            }),
          ].join(''),
        })}
        ${settingsGroup({
          label: '更多',
          rows: [
            settingsRow({ iconName: 'mask-happy', label: '面具管理', action: 'masks' }),
            settingsRow({ iconName: 'shield-check', label: '隐私与安全', action: 'privacy' }),
          ].join(''),
        })}
      </div>
    </main>
    ${bottomNav('me')}`;

  screen.querySelectorAll('[data-edit-profile]').forEach((button) => {
    button.addEventListener('click', () => {
      openMaskEditor({
        mask: getActiveMask(),
        onSaved: () => refresh(),
      });
    });
  });

  screen.addEventListener('click', (event) => {
    const row = event.target.closest('[data-setting-action]');
    if (!row) return;
    const action = row.dataset.settingAction;
    if (action === 'wallet') window.location.hash = '#/wallet';
    if (action === 'shop') window.location.hash = '#/shop';
    if (action === 'stickers') window.location.hash = '#/stickers';
    if (action === 'masks') window.location.hash = '#/masks';
    if (action === 'privacy') {
      openSheet({
        title: '隐私与安全',
        content: `<div class="detail-list">
          <div class="detail-row"><span>聊天记录</span><strong>保存在本机</strong></div>
          <div class="detail-row"><span>AI 回复</span><strong>由已配置服务处理</strong></div>
          <div class="detail-row"><span>备份</span><strong>由你主动导出</strong></div>
        </div>`,
      });
    }
  });

  return { element: screen };
}
