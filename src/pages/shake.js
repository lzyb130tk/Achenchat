import { appHeader } from '../components/app-header.js';
import { avatar } from '../components/avatar.js';
import { icon } from '../components/icons.js';
import { toast } from '../components/toast.js';
import { createRandomStranger } from '../data/random-ai.js';
import {
  addMessage,
  createCharacter,
  ensureConversation,
  getAllCharacters,
  updateMessage,
} from '../services/store.js';
import { escapeHTML } from '../services/utils.js';

function strangerMessages(messages) {
  return `<div class="stranger-chat">
    ${messages
      .map(
        (message) =>
          `<div class="stranger-chat__row stranger-chat__row--${message.role}">
            <span>${escapeHTML(message.content)}</span>
          </div>`,
      )
      .join('')}
  </div>`;
}

export function renderShake() {
  const screen = document.createElement('section');
  screen.className = 'screen screen--shake';

  screen.innerHTML = `
    ${appHeader({ title: '摇一摇', backTo: '#/discover' })}
    <main class="page-scroll">
      <div class="page-content page-content--shake">
        <section class="shake-stage">
          <button class="shake-stage__button" type="button" data-shake aria-label="摇一摇，随机遇见一个人">
            <span class="shake-stage__waves" aria-hidden="true"></span>
            <span class="shake-stage__icon">${icon('device-mobile')}</span>
          </button>
          <h2>摇一摇，遇见一个人</h2>
          <p>轻轻摇一下手机，或者点上面的按钮。<br>每次都是新的偶遇。</p>
        </section>
        <div class="shake-result" data-shake-result></div>
      </div>
    </main>`;

  const stage = screen.querySelector('.shake-stage');
  const resultSlot = screen.querySelector('[data-shake-result]');
  let pending = null;
  let lastShake = 0;

  const renderResult = () => {
    if (!pending) {
      resultSlot.innerHTML = '';
      return;
    }
    const { character, messages } = pending;
    resultSlot.innerHTML = `<section class="stranger-card">
      <div class="stranger-card__head">
        ${avatar({ mark: character.mark, tone: character.tone, size: 'lg', label: character.name })}
        <div class="stranger-card__identity">
          <h3>${escapeHTML(character.name)}</h3>
          <p>${escapeHTML(character.role)} · ${escapeHTML(character.relationship)}</p>
        </div>
      </div>
      <p class="stranger-card__persona">${escapeHTML(character.persona)}</p>
      ${strangerMessages(messages)}
      <div class="stranger-card__actions">
        <button class="button button--primary" type="button" data-add-stranger>加为好友</button>
        <button class="button button--secondary" type="button" data-drop-stranger>删除对话</button>
      </div>
    </section>`;

    resultSlot.querySelector('[data-add-stranger]').addEventListener('click', () => {
      if (!pending) return;
      const created = createCharacter({ ...pending.character, tagId: '' });
      if (!created) {
        toast('没有保存成功', { tone: 'danger' });
        return;
      }
      ensureConversation(created.id);
      pending.messages.forEach((message) => {
        const added = addMessage(created.id, message.role, message.content);
        updateMessage(created.id, added.id, { createdAt: message.createdAt });
      });
      pending = null;
      toast('已加为好友');
      window.location.hash = `#/chat/${created.id}`;
    });

    resultSlot.querySelector('[data-drop-stranger]').addEventListener('click', () => {
      pending = null;
      renderResult();
      toast('对话已删除');
    });
  };

  const shake = () => {
    const now = Date.now();
    if (now - lastShake < 1100) return;
    lastShake = now;
    const existingNames = getAllCharacters().map((character) => character.name);
    pending = createRandomStranger({ existingNames });
    stage.classList.remove('is-shaking');
    void stage.offsetWidth;
    stage.classList.add('is-shaking');
    renderResult();
    navigator.vibrate?.([12, 40, 18]);
  };

  screen.querySelector('[data-shake]').addEventListener('click', async () => {
    if (
      typeof DeviceMotionEvent !== 'undefined' &&
      typeof DeviceMotionEvent.requestPermission === 'function'
    ) {
      try {
        await DeviceMotionEvent.requestPermission();
      } catch {
        // The tap gesture still works without motion access.
      }
    }
    shake();
  });

  const onMotion = (event) => {
    const acceleration = event.accelerationIncludingGravity;
    if (!acceleration) return;
    const magnitude = Math.hypot(
      acceleration.x || 0,
      acceleration.y || 0,
      acceleration.z || 0,
    );
    if (magnitude > 24) shake();
  };
  window.addEventListener('devicemotion', onMotion);

  return {
    element: screen,
    cleanup() {
      window.removeEventListener('devicemotion', onMotion);
    },
  };
}
