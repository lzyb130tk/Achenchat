const NAMES = [
  '沈迟', '白川', '许星', '陆生', '温以', '宋栖', '顾言', '叶澜', '夏南', '周予',
  '闻舟', '林深', '苏禾', '程野', '简宁', '江晚', '黎昭', '祁安',
];

const ROLES = [
  '夜间电台主播', '独立策展人', '兽医', '建筑系学生', '无声咖啡馆老板',
  '自由译者', '舞台灯光师', '旧物修复师', '植物观察员', '旅行写作者',
];

const PERSONAS = [
  '声音低而温和，习惯先听完再说。喜欢用很小的细节表达在意，不轻易许下承诺。',
  '好奇心很重，聊起喜欢的事眼睛会亮。直率但不冒失，会把你的偏好记在心里。',
  '说话慢，偶尔有点冷幽默。比起热闹，更喜欢两个人在安静的地方待着。',
  '看起来散漫，其实很会照顾人。擅长把普通的一天讲得有趣，也会认真接住情绪。',
  '温柔但有边界，喜欢提问，也愿意分享自己的生活。不会用漂亮话敷衍你。',
  '语调轻快，富有想象力。爱把日常说成小故事，在你低落时先递来一点轻松。',
];

const GREETINGS = [
  '刚才的风很舒服，忽然想找个人一起走走。',
  '今天遇到一件小事，只适合讲给刚认识的人听。',
  '我是不是打扰到你了？如果正好有空，陪我说一会儿话。',
  '在窗边坐了很久，发现一个人安静下来的时候，会特别想听见另一个人的声音。',
  '你相信吗，有些话要在完全不熟的时候才说得出口。',
];

const USER_REPLIES = [
  '没有打扰，我正好也想找人说说话。',
  '那你说，我听着。',
  '刚好有空。今天过得怎么样？',
  '愿意听。是什么样的故事？',
];

const FOLLOW_UPS = [
  '那太好了。其实也不是什么大事，只是今天走了一段很长的路，忽然觉得应该慢一点。',
  '谢谢。我先记住这一刻，等以后想起来，会知道是从你这里开始的。',
  '下次见面的话，我想带你去看看那个地方。现在还先保密。',
  '和你说话很轻，像把一整天慢慢放下。你要不要也多待一会儿？',
];

const TONES = ['apricot', 'sage', 'rose', 'sky', 'sand'];

const AVATARS = [
  'src/assets/avatars/su-mian.svg',
  'src/assets/avatars/lin-ye.svg',
  'src/assets/avatars/chi-xia.svg',
  'src/assets/avatars/jiang-yu.svg',
  'src/assets/avatars/zhi-wei.svg',
  'src/assets/avatars/stranger.svg',
];

function pick(list, random = Math.random) {
  return list[Math.floor(random() * list.length)];
}

export function createRandomStranger({ existingNames = [], random = Math.random } = {}) {
  const taken = new Set(existingNames);
  const available = NAMES.filter((name) => !taken.has(name));
  const source = available.length ? available : NAMES;
  const name = pick(source, random);
  const role = pick(ROLES, random);
  const persona = pick(PERSONAS, random);
  const greeting = pick(GREETINGS, random);
  const userReply = pick(USER_REPLIES, random);
  const followUp = pick(FOLLOW_UPS, random);
  const now = Date.now();

  return {
    character: {
      name,
      mark: Array.from(name).slice(-1)[0],
      role,
      relationship: '刚认识',
      tone: pick(TONES, random),
      avatar: pick(AVATARS, random),
      tagline: '从一次偶遇开始。',
      persona,
    },
    messages: [
      { role: 'assistant', content: greeting, createdAt: now - 3 * 60 * 1000 },
      { role: 'user', content: userReply, createdAt: now - 2 * 60 * 1000 },
      { role: 'assistant', content: followUp, createdAt: now - 60 * 1000 },
    ],
  };
}
