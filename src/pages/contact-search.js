import { characterAvatar } from '../components/avatar.js';
import { icon } from '../components/icons.js';
import { getAllCharacters } from '../services/store.js';
import { escapeHTML } from '../services/utils.js';

const RECENT_KEY = 'achat.contact-searches.v1';

function readRecent() {
  try {
    const value = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    return Array.isArray(value) ? value.filter((item) => typeof item === 'string').slice(0, 5) : [];
  } catch {
    return [];
  }
}

function writeRecent(values) {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(values.slice(0, 5))); } catch { /* Storage can be unavailable. */ }
}

export function renderContactSearch() {
  const characters = getAllCharacters();
  const screen = document.createElement('section');
  screen.className = 'screen screen--contact-search';
  screen.innerHTML = `
    <header class="contact-search__header">
      <a class="icon-button" href="#/contacts" aria-label="返回联系人">${icon('arrow-left')}</a>
      <label class="contact-search__field">${icon('magnifying-glass')}<input type="search" placeholder="搜索名字或身份" aria-label="搜索名字或身份" autocomplete="off" data-search-input></label>
      <a href="#/contacts">取消</a>
    </header>
    <main class="page-scroll">
      <div class="page-content contact-search__content">
        <section class="contact-search__recent" data-recent-wrap><h2>最近搜索</h2><div data-recent-list></div></section>
        <section class="contact-search__results"><h2>联系人</h2><div data-results></div></section>
      </div>
    </main>`;
  const input = screen.querySelector('[data-search-input]');
  const recentList = screen.querySelector('[data-recent-list]');
  const results = screen.querySelector('[data-results]');
  let recent = readRecent();

  const paintRecent = () => {
    screen.querySelector('[data-recent-wrap]').hidden = !recent.length;
    recentList.innerHTML = recent.map((term) => `<span class="contact-search__chip"><button type="button" data-recent-term="${escapeHTML(term)}">${escapeHTML(term)}</button><button type="button" data-remove-recent="${escapeHTML(term)}" aria-label="删除${escapeHTML(term)}搜索记录">${icon('x')}</button></span>`).join('');
  };
  const saveTerm = (term) => {
    const cleaned = term.trim().slice(0, 24);
    if (!cleaned) return;
    recent = [cleaned, ...recent.filter((item) => item !== cleaned)].slice(0, 5);
    writeRecent(recent);
    paintRecent();
  };
  const paintResults = () => {
    const query = input.value.trim().toLocaleLowerCase();
    const matches = characters.filter((item) => `${item.name} ${item.role} ${item.tagline} ${item.relationship}`.toLocaleLowerCase().includes(query));
    results.innerHTML = matches.length
      ? matches.map((character) => `<a class="contact-search__row" href="#/chat/${character.id}" data-result-name="${escapeHTML(character.name)}">${characterAvatar(character, 'md')}<span><strong>${escapeHTML(character.name)}</strong><small>${escapeHTML(character.tagline)}</small></span>${icon('caret-right')}</a>`).join('')
      : '<p class="contact-search__empty">没有找到这位伙伴</p>';
  };
  input.addEventListener('input', paintResults);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') saveTerm(input.value);
  });
  screen.addEventListener('click', (event) => {
    const remove = event.target.closest('[data-remove-recent]');
    if (remove) {
      recent = recent.filter((term) => term !== remove.dataset.removeRecent);
      writeRecent(recent);
      paintRecent();
      return;
    }
    const chip = event.target.closest('[data-recent-term]');
    if (chip) {
      input.value = chip.dataset.recentTerm;
      paintResults();
      input.focus();
      return;
    }
    const row = event.target.closest('[data-result-name]');
    if (row) saveTerm(input.value || row.dataset.resultName);
  });
  paintRecent();
  paintResults();
  return { element: screen };
}
