import { appHeader } from '../components/app-header.js';
import { bottomNav } from '../components/bottom-nav.js';
import { avatar } from '../components/avatar.js';
import { icon } from '../components/icons.js';
import { SCENES, getCharacter } from '../data/characters.js';
import { setPendingPrompt } from '../services/prompt.js';
import { escapeHTML } from '../services/utils.js';

function sceneTitle(scene) {
  return escapeHTML(scene.title).replace('\n', '<br>');
}

export function renderDiscover() {
  const [featured, ...more] = SCENES;
  const character = getCharacter(featured.characterId);
  const screen = document.createElement('section');
  screen.className = 'screen';

  screen.innerHTML = `
    ${appHeader({ title: '发现' })}
    <main class="page-scroll">
      <div class="page-content page-content--discover">
        <a class="discover-feature" href="#/chat/${featured.characterId}" data-scene="${featured.id}">
          <span class="discover-feature__glow" aria-hidden="true"></span>
          <span class="discover-feature__top">
            <span class="discover-feature__badge">${icon(featured.icon)}${escapeHTML(featured.kicker)}</span>
            <span class="discover-feature__arrow">${icon('arrow-up-right')}</span>
          </span>
          <span class="discover-feature__copy">
            <span class="discover-feature__title">${sceneTitle(featured)}</span>
            <span class="discover-feature__subtitle">${escapeHTML(featured.subtitle)}</span>
          </span>
          <span class="discover-feature__cta">
            ${avatar({ mark: character.mark, tone: character.tone, size: 'xs', label: character.name })}
            <span>开始聊天</span>
            <span class="discover-feature__cta-arrow">${icon('arrow-right')}</span>
          </span>
        </a>
        <section class="scenes-block">
          <div class="section-heading"><h2>更多片刻</h2></div>
          <div class="scene-list">
            ${more
              .map((scene) => {
                const sceneCharacter = getCharacter(scene.characterId);
                return `<a class="scene-item" href="#/chat/${scene.characterId}" data-scene="${scene.id}">
                  <span class="scene-item__icon">${icon(scene.icon)}</span>
                  <span class="scene-item__copy">
                    <span class="scene-item__title">${escapeHTML(scene.title)}</span>
                    <span class="scene-item__meta">和${escapeHTML(sceneCharacter.name)} · ${escapeHTML(scene.kicker)}</span>
                  </span>
                  <span class="scene-item__arrow">${icon('caret-right')}</span>
                </a>`;
              })
              .join('')}
          </div>
        </section>
      </div>
    </main>
    ${bottomNav('discover')}`;

  screen.querySelectorAll('[data-scene]').forEach((link) => {
    link.addEventListener('click', () => {
      const scene = SCENES.find((item) => item.id === link.dataset.scene);
      if (scene) setPendingPrompt(scene.starter);
    });
  });

  return { element: screen };
}
