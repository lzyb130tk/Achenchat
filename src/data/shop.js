export const SHOP_TYPES = [
  {
    id: 'coffee',
    name: '咖啡小馆',
    icon: 'coffee',
    tone: 'apricot',
    blurb: '一杯一杯，把日子慢慢攒起来。',
    minFen: 2800,
    maxFen: 5200,
  },
  {
    id: 'flower',
    name: '街角花店',
    icon: 'flower',
    tone: 'rose',
    blurb: '每天包一束花，也留一枝给自己。',
    minFen: 3600,
    maxFen: 6800,
  },
  {
    id: 'book',
    name: '旧书店',
    icon: 'book-open-text',
    tone: 'sand',
    blurb: '不急着卖完，等人来翻一翻。',
    minFen: 2200,
    maxFen: 4400,
  },
  {
    id: 'dessert',
    name: '甜品小铺',
    icon: 'cake',
    tone: 'sage',
    blurb: '把普通的一天，做甜一点。',
    minFen: 3200,
    maxFen: 6000,
  },
];

export function getShopType(id) {
  return SHOP_TYPES.find((type) => type.id === id) || null;
}

export function nextNoon(timestamp = Date.now()) {
  const date = new Date(timestamp);
  date.setHours(12, 0, 0, 0);
  if (date.getTime() <= timestamp) date.setDate(date.getDate() + 1);
  return date.getTime();
}

export function generateShopIncome(type, random = Math.random) {
  const span = type.maxFen - type.minFen;
  const base = type.minFen + Math.round(span * random());
  const tip = random() > 0.72 ? Math.round((300 + random() * 700) / 100) * 100 : 0;
  return base + tip;
}

export function formatPayrollTime(timestamp, now = Date.now()) {
  const target = new Date(timestamp);
  const today = new Date(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(today.getDate() + 1);
  const sameDay = (a, b) => a.toDateString() === b.toDateString();
  if (sameDay(target, today)) return '今天 12:00';
  if (sameDay(target, tomorrow)) return '明天 12:00';
  return `${target.getMonth() + 1} 月 ${target.getDate()} 日 12:00`;
}
