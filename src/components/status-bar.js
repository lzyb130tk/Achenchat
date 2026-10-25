import { icon } from './icons.js';

let timeTimer = null;

function formatClock() {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date());
}

function batteryIcon(level) {
  if (level >= 0.8) return 'battery-full';
  if (level >= 0.55) return 'battery-high';
  if (level >= 0.3) return 'battery-medium';
  if (level >= 0.12) return 'battery-low';
  return 'battery-empty';
}

function renderBattery(element, level) {
  const percent = Math.round(level * 100);
  element.innerHTML = `${icon(batteryIcon(level))}<span>${percent}%</span>`;
  element.setAttribute('aria-label', `电量 ${percent}%`);
}

export function mountStatusBar() {
  const app = document.getElementById('app');
  if (!app || app.querySelector('.status-bar')) return;

  const bar = document.createElement('div');
  bar.className = 'status-bar';
  bar.innerHTML = `<time class="status-bar__time">${formatClock()}</time>
    <span class="status-bar__signals">
      <span class="status-bar__signal">${icon('cell-signal-high')}${icon('wifi-high')}</span>
      <span class="status-bar__battery" aria-label="电量">${icon('battery-full')}<span>100%</span></span>
    </span>`;

  app.prepend(bar);
  const time = bar.querySelector('.status-bar__time');
  const battery = bar.querySelector('.status-bar__battery');

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
