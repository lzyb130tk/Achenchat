export const MINI_PROGRAMS = [
  {
    id: 'lucky',
    name: '今日签',
    icon: 'clover',
    tone: 'sage',
    prompt: '今天的一句话',
    results: [
      '会有一件小事，刚好如你所愿。',
      '慢一点也没关系，你走的方向是对的。',
      '今天适合把没说完的话，轻轻说出口。',
      '有人记得你随口提过的那件小事。',
      '先照顾好自己，剩下的都会慢慢顺起来。',
    ],
  },
  {
    id: 'food',
    name: '吃什么',
    icon: 'bowl-food',
    tone: 'apricot',
    prompt: '替你决定这一餐',
    results: [
      '番茄鸡蛋面，加一个溏心蛋。',
      '热乎乎的砂锅粥，配一碟小菜。',
      '街角那家没去过的小店，随便点一份。',
      '一份烤得微焦的吐司，和一杯热牛奶。',
      '寿司拼盘，挑颜色最好看的那盒。',
    ],
  },
  {
    id: 'night',
    name: '晚安签',
    icon: 'moon-stars',
    tone: 'sky',
    prompt: '把今天轻轻放下',
    results: [
      '今天已经很努力了，剩下的明天再想。',
      '把灯调暗一点，世界也会安静一点。',
      '愿你梦到一片很缓的海。',
      '不必把所有人都照顾好，先睡个好觉。',
      '今晚的风很轻，适合什么都不想。',
    ],
  },
  {
    id: 'dice',
    name: '掷骰子',
    icon: 'dice-five',
    tone: 'rose',
    prompt: '让运气做个决定',
    results: [
      '1 · 留在原地，也很好。',
      '2 · 给一个很久没联系的人发消息。',
      '3 · 今天走一条没走过的路。',
      '4 · 点一份平时不会点的东西。',
      '5 · 把想做的事先做五分钟。',
      '6 · 答应自己一件开心的小事。',
    ],
  },
];

export function getMiniProgram(id) {
  return MINI_PROGRAMS.find((program) => program.id === id) || null;
}

export function drawMiniResult(program, random = Math.random) {
  return program.results[Math.floor(random() * program.results.length)];
}
