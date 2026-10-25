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

export function localDayKey(timestamp = Date.now()) {
  const day = new Date(timestamp);
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
}

const ORDER_SCENARIOS = {
  coffee: [
    { question: '客人想喝一杯不太甜的咖啡，你会？', choices: ['问清口味，推荐少糖饮品', '直接推荐最贵的甜咖啡', '让客人自己看菜单'] },
    { question: '午后同时来了三位客人，第一位正在等单，你会？', choices: ['说明等待时间，依次制作', '先做最简单的一单', '不回应后来客人的询问'] },
    { question: '客人觉得饮品温度偏低，你会？', choices: ['了解情况并重新制作或加热', '告诉客人温度没有问题', '当作没有听见'] },
  ],
  flower: [
    { question: '客人想送一束温柔的花给朋友，你会？', choices: ['询问喜好和预算，搭配柔和花束', '只推荐店里最贵的花', '随手拿一束让客人结账'] },
    { question: '一枝花在包装时折断了，你会？', choices: ['主动更换，并检查整束花', '藏在花束里面继续包装', '让客人额外付钱换花'] },
    { question: '客人预算有限，却想让花束看起来饱满，你会？', choices: ['选当季花材，认真调整层次', '劝客人必须加钱', '减少花材却按原价收费'] },
  ],
  book: [
    { question: '客人想找一本适合雨天读的书，你会？', choices: ['问问偏好，推荐几本安静的书', '只推荐价格最高的一本', '说书都差不多'] },
    { question: '客人发现旧书中有前主人的笔记，你会？', choices: ['说明书况，询问是否接受', '假装没有看到笔记', '指责客人太挑剔'] },
    { question: '一本预留的书被另一位客人看中，你会？', choices: ['解释已预留，帮对方寻找同款', '直接把预留的书卖掉', '让两位客人自行争论'] },
  ],
  dessert: [
    { question: '客人想带走一份不太甜的点心，你会？', choices: ['介绍甜度较低的口味', '推荐最甜的招牌款', '不回答，让客人自己挑'] },
    { question: '有客人对坚果过敏，你会？', choices: ['核对配料和交叉接触风险', '猜测应该没问题', '不告知配料直接售卖'] },
    { question: '预约的蛋糕需要晚半小时取走，你会？', choices: ['确认时间并妥善冷藏保管', '放在柜台上不管', '直接取消预约'] },
  ],
};

export function getDailyOrderQuestions(typeId) {
  return ORDER_SCENARIOS[typeId] || ORDER_SCENARIOS.coffee;
}
