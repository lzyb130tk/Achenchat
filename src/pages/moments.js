import { appHeader } from '../components/app-header.js';
import { characterAvatar } from '../components/avatar.js';
import { icon } from '../components/icons.js';
import { MOMENTS } from '../data/moments.js';
import {
  getCharacter,
  getLikedMoments,
  toggleMomentLike,
} from '../services/store.js';
import { escapeHTML, formatRelativeTime } from '../services/utils.js';

export function renderMoments() {
  const screen = document.createElement('section');
  screen.className = 'screen';
  const liked = new Set(getLikedMoments());

  const items = MOMENTS.map((moment) => {
    const character = getCharacter(moment.characterId);
    if (!character) return '';
    const timestamp = Date.now() - moment.minutesAgo * 60000;
    const isLiked = liked.has(moment.id);
    return `<article class="moment-card" data-moment="${moment.id}">
      <header class="moment-card__header">
        ${characterAvatar(character, 'md')}
        <span class="moment-card__identity">
          <strong>${escapeHTML(character.name)}</strong>
          <small>${formatRelativeTime(timestamp)}</small>
        </span>
      </header>
      <p class="moment-card__text">${escapeHTML(moment.text)}</p>
      ${
        moment.comments.length
          ? `<div class="moment-card__comments">
              ${moment.comments
                .map(
                  (comment) =>
                    `<p><strong>${escapeHTML(comment.name)}</strong><span>${escapeHTML(comment.text)}</span></p>`,
                )
                .join('')}
            </div>`
          : ''
      }
      <footer class="moment-card__footer">
        <button class="moment-like${isLiked ? ' is-liked' : ''}" type="button" data-like="${moment.id}" aria-pressed="${isLiked}">
          ${icon(isLiked ? 'heart' : 'heart-straight', isLiked ? 'fill' : 'regular')}
          <span data-like-count>${moment.likes + (isLiked ? 1 : 0)}</span>
        </button>
        <span class="moment-comments-count">${icon('chat-circle')}${moment.comments.length}</span>
      </footer>
    </article>`;
  }).join('');

  screen.innerHTML = `
    ${appHeader({ title: '朋友圈', backTo: '#/discover' })}
    <main class="page-scroll">
      <div class="page-content page-content--moments">
        <div class="moments-feed">${items}</div>
      </div>
    </main>`;

  screen.querySelectorAll('[data-like]').forEach((button) => {
    button.addEventListener('click', () => {
      const moment = MOMENTS.find((item) => item.id === button.dataset.like);
      if (!moment) return;
      const nowLiked = toggleMomentLike(moment.id);
      button.classList.toggle('is-liked', nowLiked);
      button.setAttribute('aria-pressed', String(nowLiked));
      button.innerHTML = `${icon(nowLiked ? 'heart' : 'heart-straight', nowLiked ? 'fill' : 'regular')}<span data-like-count>${moment.likes + (nowLiked ? 1 : 0)}</span>`;
    });
  });

  return { element: screen };
}
