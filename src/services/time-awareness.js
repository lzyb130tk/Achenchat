/**
 * 时间感知与设备状态。
 *
 * 设置里打开「时间感知」后，每次回复前会读取本机时间和电量，拼成一段
 * 隐藏的 System Prompt，让 AI 的状态和话题能贴合真实当下：
 * 深夜可以犯困，电量见底时可以提醒对方充电。
 */

const LATE_NIGHT_START = 23;
const LATE_NIGHT_END = 5;
const LOW_BATTERY_LEVEL = 20;

function withTimeout(promise, ms) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
    );
  });
}

export function periodForHour(hour) {
  if (hour >= LATE_NIGHT_START || hour < LATE_NIGHT_END) return '深夜';
  if (hour < 8) return '清晨';
  if (hour < 11) return '上午';
  if (hour < 13) return '中午';
  if (hour < 17) return '下午';
  if (hour < 19) return '傍晚';
  return '晚上';
}

export function describeTime(date = new Date()) {
  const hour = date.getHours();
  const label = new Intl.DateTimeFormat('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
  return {
    label,
    period: periodForHour(hour),
    isLateNight: hour >= LATE_NIGHT_START || hour < LATE_NIGHT_END,
  };
}

async function readBattery() {
  if (
    typeof navigator === 'undefined' ||
    typeof navigator.getBattery !== 'function'
  ) {
    return null;
  }
  const manager = await withTimeout(navigator.getBattery(), 500);
  if (!manager || !Number.isFinite(manager.level)) return null;
  return {
    level: Math.max(0, Math.min(100, Math.round(manager.level * 100))),
    charging: Boolean(manager.charging),
  };
}

export async function collectAmbientContext(date = new Date()) {
  return {
    ...describeTime(date),
    battery: await readBattery(),
  };
}

export function buildTimeAwarenessBlock(ambient) {
  if (!ambient) return '';
  const lines = [
    '【此刻 · 时间感知】',
    `现在是${ambient.label}（${ambient.period}）。把时间当成真实发生的：你的状态、作息和话题可以自然贴合当下，但不要生硬报时，也不要解释这是设定。`,
  ];

  if (ambient.isLateNight) {
    lines.push(
      '已经很晚了。如果对方还在聊天，你可以自然地带上一点困意，比如“怎么还不睡，我都困了”，也可以轻声劝对方早点睡。不要每句话都提这件事。',
    );
  }

  const battery = ambient.battery;
  if (battery && battery.level < LOW_BATTERY_LEVEL && !battery.charging) {
    lines.push(
      `对方手机电量只剩 ${battery.level}%，而且没有在充电。如果话题允许，可以顺口提醒一句“你手机快没电了，先去充电吧，我在这等你”。不要打断对方正在说的事，也不要反复提醒。`,
    );
  }

  return lines.join('\n');
}

export function currentPeriodLabel(date = new Date()) {
  return describeTime(date).period;
}
