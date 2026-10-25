import { appHeader } from '../components/app-header.js';
import { setupAvatarField } from '../components/avatar-field.js';
import { icon } from '../components/icons.js';
import { toast } from '../components/toast.js';
import { addMask } from '../services/store.js';

const DEFAULT_AVATAR = 'src/assets/default-person.svg';
const EMPTY_AVATAR = `<img class="mask-avatar-placeholder" src="${DEFAULT_AVATAR}" alt="默认头像">`;

export function renderMaskNew() {
  const screen = document.createElement('section');
  screen.className = 'screen screen--mask-new';
  screen.innerHTML = `
    ${appHeader({ title: '新建面具', backTo: '#/masks', action: '<button class="mask-new__header-save" type="button" data-save-mask disabled>保存</button>' })}
    <main class="page-scroll">
      <div class="page-content page-content--mask-new">
        <p class="mask-new__intro">换一个身份，换一种说话的方式。</p>
        <section class="mask-new__hero">
          <div class="mask-new__avatar-field" data-avatar-field>
            <div class="mask-new__hero-row">
              <div class="avatar-field__preview" data-avatar-preview></div>
              <span class="mask-new__hero-copy"><strong data-hero-name>新的身份</strong><small data-hero-signature>一句话介绍自己</small></span>
            </div>
            <div class="avatar-field__actions">
              <button class="small-button" type="button" data-avatar-upload>${icon('camera-plus')}<span>上传头像</span></button>
              <button class="small-button" type="button" data-avatar-url-toggle>${icon('link-simple')}<span>使用链接</span></button>
              <button class="small-button small-button--muted" type="button" data-avatar-clear hidden>${icon('trash-simple')}<span>移除</span></button>
            </div>
            <input type="file" accept="image/*" data-avatar-file hidden>
            <label class="field avatar-field__url" data-avatar-url-wrap hidden>
              <span class="field__label">头像链接</span>
              <span class="field__control"><input class="field__input" type="url" inputmode="url" spellcheck="false" autocomplete="off" placeholder="https://…" data-avatar-url></span>
            </label>
          </div>
        </section>
        <section class="mask-new__form">
          <label class="field"><span class="field__label">名字</span><span class="field__control"><input class="field__input" name="maskName" maxlength="16" autocomplete="off" placeholder="这个面具叫什么"></span></label>
          <label class="field"><span class="field__label">签名</span><span class="field__control"><input class="field__input" name="maskSignature" maxlength="30" autocomplete="off" placeholder="一句话介绍自己"></span></label>
          <label class="field mask-new__persona"><span class="field__label">人设</span><span class="field__control field__control--area"><textarea class="field__input field__textarea" name="maskPersona" rows="6" maxlength="500" placeholder="你希望 AI 把你当作怎样的人？可以写性格、身份和相处方式。"></textarea></span><span class="mask-new__count" data-persona-count>0/500</span></label>
          <p class="mask-new__note">${icon('info')}人设会影响之后使用这个面具的回复</p>
        </section>
      </div>
    </main>
    <div class="mask-new__footer"><button class="button button--primary" type="button" data-save-mask>保存面具</button></div>`;

  const avatar = setupAvatarField(screen, {
    initial: '', mark: '', name: '新面具', tone: 'ink', emptyPreview: EMPTY_AVATAR,
  });
  const nameInput = screen.querySelector('[name="maskName"]');
  const signatureInput = screen.querySelector('[name="maskSignature"]');
  const personaInput = screen.querySelector('[name="maskPersona"]');
  const topSave = screen.querySelector('.mask-new__header-save');
  nameInput.addEventListener('input', () => {
    screen.querySelector('[data-hero-name]').textContent = nameInput.value.trim() || '新的身份';
    topSave.disabled = !nameInput.value.trim();
  });
  signatureInput.addEventListener('input', () => {
    screen.querySelector('[data-hero-signature]').textContent = signatureInput.value.trim() || '一句话介绍自己';
  });
  personaInput.addEventListener('input', () => {
    screen.querySelector('[data-persona-count]').textContent = `${personaInput.value.length}/500`;
  });
  let saving = false;
  const save = () => {
    if (saving) return;
    const name = nameInput.value.trim();
    if (!name) { toast('给这个面具一个名字', { tone: 'danger' }); nameInput.focus(); return; }
    saving = true;
    const mask = addMask({
      name,
      signature: signatureInput.value.trim(),
      persona: personaInput.value.trim(),
      avatar: avatar.getValue() || DEFAULT_AVATAR,
    });
    if (!mask) { saving = false; toast('面具保存失败', { tone: 'danger' }); return; }
    toast('新面具已戴上');
    window.location.hash = '#/masks';
  };
  screen.querySelectorAll('[data-save-mask]').forEach((button) => button.addEventListener('click', save));
  return { element: screen };
}
