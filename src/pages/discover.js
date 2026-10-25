import { appHeader } from '../components/app-header.js';
import { bottomNav } from '../components/bottom-nav.js';
import { avatar } from '../components/avatar.js';
import { icon } from '../components/icons.js';
import { sectionHeading } from '../components/section-heading.js';
import { openSheet } from '../components/sheet.js';
import {
  MINI_PROGRAMS,
  drawMiniResult,
  getMiniProgram,
} from '../data/mini-programs.js';
import { MOMENTS } from '../data/moments.js';
import { escapeHTML, formatRelativeTime } from '../services/utils.js';

function openMiniProgram(id) {
  const program = getMiniProgram(id);
  if (!program) return;
  let result = drawMiniResult(program);

  const content = () => `<div class="mini-result mini-result--${program.tone}">
    <span class="mini-result__icon">${icon(program.icon)}</span>
    <span class="mini-result__prompt">${escapeHTML(program.prompt)}</span>
    <p class="mini-result__text">${escapeHTML(result)}</p>
  </div>`;

  openSheet({
    title: program.name,
    content: content(),
    actions: `<button class="button button--primary" type="button" data-reroll>再来一次</button>`,
    onMount: (sheet) => {
      sheet.querySelector('[data-reroll]').addEventListener('click', () => {
        let next = drawMiniResult(program);
        if (program.results.length > 1) {
          while (next === result) next = drawMiniResult(program);
        }
        result = next;
        sheet.querySelector('.mini-result').outerHTML = content();
      });
    },
  });
}

function momentsEntry() {
  const lead = MOMENTS[0];
  const timestamp = Date.now() - lead.minutesAgo * 60000;

  return `<a class="moments-entry" href="#/moments">
    <img class="moments-entry__image" src="src/assets/moments-sunlit-sketch.png" alt="阳光落在桌上的画册与白花" loading="lazy">
    <span class="moments-entry__copy">
      <span class="moments-entry__title">朋友圈</span>
      <span class="moments-entry__preview">${escapeHTML(lead.text)}</span>
      <span class="moments-entry__time">${formatRelativeTime(timestamp)}</span>
    </span>
    <span class="moments-entry__arrow">${icon('caret-right')}</span>
  </a>`;
}

function shakeEntry() {
  return `<a class="shake-entry" href="#/shake">
    <span class="shake-entry__icon">${avatar({ mark: '遇', tone: 'sky', size: 'md', label: '摇一摇', src: 'src/assets/avatars/stranger.svg' })}</span>
    <span class="shake-entry__copy">
      <strong>摇一摇</strong>
      <small>随机遇见一个人，从一次偶遇开始。</small>
    </span>
    <span class="shake-entry__arrow">${icon('caret-right')}</span>
  </a>`;
}

export function renderDiscover() {
  const screen = document.createElement('section');
  screen.className = 'screen screen--discover';

  screen.innerHTML = `
    ${appHeader({ title: '发现' })}
    <main class="page-scroll">
      <div class="page-content page-content--discover">
        ${momentsEntry()}
        <section class="mini-block">
          ${sectionHeading({ title: '今天可以做什么', aside: '随手用一下' })}
          <div class="mini-grid">
            ${MINI_PROGRAMS.map(
              (program) => `<button class="mini-tile mini-tile--${program.tone}" type="button" data-mini="${program.id}">
                <span class="mini-tile__icon">${icon(program.icon)}</span>
                <span class="mini-tile__name">${escapeHTML(program.name)}</span>
                <span class="mini-tile__arrow">${icon('caret-right')}</span>
              </button>`,
            ).join('')}
          </div>
        </section>
        <section class="shake-block">
          ${shakeEntry()}
        </section>
      </div>
    </main>
    ${bottomNav('discover')}`;

  screen.querySelectorAll('[data-mini]').forEach((button) => {
    button.addEventListener('click', () => openMiniProgram(button.dataset.mini));
  });

  return { element: screen };
}
