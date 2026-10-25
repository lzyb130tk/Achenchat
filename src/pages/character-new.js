import { avatarField, setupAvatarField } from '../components/avatar-field.js';
import { icon } from '../components/icons.js';
import { toast } from '../components/toast.js';
import { createCharacter, getTags } from '../services/store.js';
import { escapeHTML } from '../services/utils.js';

export function renderCharacterNew() {
  const screen = document.createElement('section');
  screen.className = 'screen screen--character-new';
  screen.innerHTML = `
    <header class="creation-header">
      <a class="icon-button" href="#/contacts" aria-label="返回联系人">${icon('arrow-left')}</a>
      <h1>新建伙伴</h1>
      <button type="button" data-create-character>创建</button>
    </header>
    <main class="page-scroll">
      <div class="page-content creation-content">
        <p class="creation-subtitle">先认识一下，再慢慢聊。</p>
        ${avatarField({ mark: '新', name: '新伙伴', tone: 'apricot' })}
        <label class="field"><span class="field__label">名字</span><span class="field__control"><input class="field__input" name="name" maxlength="20" autocomplete="off" placeholder="怎么称呼"></span></label>
        <label class="field"><span class="field__label">标签</span><span class="field__control field__control--select"><select class="field__input field__select" name="tagId"><option value="">未分组</option>${getTags().map((tag) => `<option value="${escapeHTML(tag.id)}">${escapeHTML(tag.name)}</option>`).join('')}</select></span></label>
        <label class="field creation-persona"><span class="field__label">人设</span><span class="field__control field__control--area"><textarea class="field__input field__textarea" name="persona" rows="6" maxlength="500" placeholder="性格、说话方式、你们的相处方式，写多少都可以。"></textarea></span><span class="creation-count" data-persona-count>0/500</span></label>
        <label class="field"><span class="field__label">签名</span><span class="field__control"><input class="field__input" name="tagline" maxlength="24" autocomplete="off" placeholder="写一句话介绍自己吧"></span></label>
      </div>
    </main>
    <div class="creation-footer"><button class="button button--primary" type="button" data-create-character>创建并开始聊天</button></div>`;
  const avatar = setupAvatarField(screen, { initial: '', mark: '新', name: '新伙伴', tone: 'apricot' });
  const persona = screen.querySelector('[name="persona"]');
  persona.addEventListener('input', () => {
    screen.querySelector('[data-persona-count]').textContent = `${persona.value.length}/500`;
  });
  let saving = false;
  screen.querySelectorAll('[data-create-character]').forEach((button) => button.addEventListener('click', () => {
    if (saving) return;
    const nameInput = screen.querySelector('[name="name"]');
    const name = nameInput.value.trim();
    if (!name) {
      toast('给这位伙伴一个名字', { tone: 'danger' });
      nameInput.focus();
      return;
    }
    saving = true;
    const character = createCharacter({
      name,
      tagId: screen.querySelector('[name="tagId"]').value,
      persona: persona.value.trim(),
      tagline: screen.querySelector('[name="tagline"]').value.trim(),
      avatar: avatar.getValue(),
    });
    if (!character) {
      saving = false;
      toast('没有保存成功，请重试', { tone: 'danger' });
      return;
    }
    window.location.hash = `#/chat/${character.id}`;
  }));
  return { element: screen };
}
