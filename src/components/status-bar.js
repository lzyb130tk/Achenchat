let timeTimer = null;

function formatClock() {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date());
}

function signalIcon(strength = 4) {
  const bars = [
    { x: 3.2, y: 13, h: 8 },
    { x: 8.6, y: 10, h: 11 },
    { x: 14, y: 6, h: 15 },
    { x: 19.4, y: 2, h: 19 },
  ];
  const body = bars
    .map((b, i) => {
      const filled = i < strength;
      const fill = filled ? 'currentColor' : 'var(--statusbar-off)';
      return `<rect x="${b.x}" y="${b.y}" width="3.6" height="${b.h}" rx="1.8" fill="${fill}"/>`;
    })
    .join('');
  return `<span class="status-bar__icon status-bar__icon--signal">
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true" focusable="false">${body}</svg>
  </span>`;
}

function wifiIcon() {
  const body = `
    <g fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M 2 10.82 A 15 15 0 0 1 22 10.82"/>
      <path d="M 6 15.3 A 9 9 0 0 1 18 15.3"/>
    </g>
    <circle cx="12" cy="19" r="1.6" fill="currentColor"/>
  `;
  return `<span class="status-bar__icon status-bar__icon--wifi">
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true" focusable="false">${body}</svg>
  </span>`;
}

function batteryIcon(level = 1) {
  const pct = Math.max(0, Math.min(1, level));
  const percent = Math.round(pct * 100);
  const fillColor = pct <= 0.2 ? 'var(--statusbar-battery-low)' : 'currentColor';
  const maxFill = 23.2;
  const fillW = (maxFill * pct).toFixed(2);
  const fillRect =
    pct > 0.001
      ? `<rect x="3.6" y="6.4" width="${fillW}" height="11.2" rx="${Math.min(2.5, fillW / 2)}" fill="${fillColor}"/>`
      : '';
  const textColor = pct >= 0.5 ? 'var(--statusbar-battery-text)' : 'currentColor';
  const body = `
    <rect x="1.2" y="4" width="28" height="16" rx="5"
          fill="none" stroke="currentColor" stroke-width="2.4"/>
    ${fillRect}
    <text x="15.2" y="12.4" text-anchor="middle" dominant-baseline="central"
          font-size="11" font-weight="700"
          fill="${textColor}">${percent}</text>
    <rect x="30.4" y="8.5" width="2.4" height="7" rx="1.2" fill="currentColor"/>
  `;
  return `<span class="status-bar__icon status-bar__icon--battery-wide">
    <svg viewBox="0 0 34 24" width="26" height="18" fill="none" aria-hidden="true" focusable="false">${body}</svg>
  </span>`;
}

function renderBattery(element, level) {
  const percent = Math.round(level * 100);
  element.innerHTML = batteryIcon(level);
  element.setAttribute('aria-label', `电量 ${percent}%`);
}

export function mountStatusBar() {
  const app = document.getElementById('app');
  if (!app || app.querySelector('.status-bar')) return;

  const bar = document.createElement('div');
  bar.className = 'status-bar';
  bar.innerHTML = `<time class="status-bar__time">${formatClock()}</time>
    <span class="status-bar__signals">
      ${signalIcon(4)}
      ${wifiIcon()}
      <span class="status-bar__battery" aria-label="电量"></span>
    </span>`;

  app.prepend(bar);
  const time = bar.querySelector('.status-bar__time');
  const battery = bar.querySelector('.status-bar__battery');
  renderBattery(battery, 1);

  const tick = () => {
    time.textContent = formatClock();
    time.setAttribute('datetime', new Date().toISOString());
  };
  tick();
  timeTimer = window.setInterval(tick, 10000);
  window.addEventListener('focus', tick);

  if (navigator.getBattery) {
    navigator
      .getBattery()
      .then((manager) => {
        const update = () => renderBattery(battery, manager.level);
        update();
        manager.addEventListener('levelchange', update);
        manager.addEventListener('chargingchange', update);
      })
      .catch(() => {});
  }

  return () => {
    window.clearInterval(timeTimer);
    window.removeEventListener('focus', tick);
  };
}
