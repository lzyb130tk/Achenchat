const DAY = 24 * 60 * 60 * 1000;

export function createSeedConversations(now = Date.now()) {
  return {
    'su-mian': {
      unread: 2,
      messages: [
        {
          id: 'seed-su-1',
          role: 'assistant',
          content: '今天路过一家旧唱片店，看到一张你可能会喜欢的专辑。',
          createdAt: now - DAY - 3 * 60 * 60 * 1000,
        },
        {
          id: 'seed-su-2',
          role: 'user',
          content: '什么专辑？',
          createdAt: now - DAY - 2.9 * 60 * 60 * 1000,
        },
        {
          id: 'seed-su-3',
          role: 'assistant',
          content: '先不告诉你。等见面的时候，放给你听。',
          createdAt: now - DAY - 2.8 * 60 * 60 * 1000,
        },
        {
          id: 'seed-su-4',
          role: 'assistant',
          content: '不过现在，更想听你说说今天。',
          createdAt: now - 38 * 60 * 1000,
        },
      ],
    },
    'lin-ye': {
      unread: 0,
      messages: [
        {
          id: 'seed-lin-1',
          role: 'user',
          content: '今天的云很好看。',
          createdAt: now - 2.2 * 60 * 60 * 1000,
        },
        {
          id: 'seed-lin-2',
          role: 'assistant',
          content: '风把云推开了，拍到了很好的光。',
          createdAt: now - 2 * 60 * 60 * 1000,
        },
      ],
    },
    'chi-xia': {
      unread: 1,
      messages: [
        {
          id: 'seed-chi-1',
          role: 'assistant',
          content: '桂花布丁给你留了一份。',
          createdAt: now - DAY - 40 * 60 * 1000,
        },
        {
          id: 'seed-chi-2',
          role: 'user',
          content: '等我。',
          createdAt: now - DAY - 32 * 60 * 1000,
        },
        {
          id: 'seed-chi-3',
          role: 'assistant',
          content: '嗯，慢慢来。',
          createdAt: now - DAY - 30 * 60 * 1000,
        },
      ],
    },
    'jiang-yu': {
      unread: 0,
      messages: [
        {
          id: 'seed-jiang-1',
          role: 'assistant',
          content: '图画完了，第一眼想给你看。',
          createdAt: now - 4 * DAY,
        },
      ],
    },
  };
}

export const DEFAULT_PROFILE = {
  name: '阿念',
  signature: '慢慢聊，认真喜欢。',
  createdAt: Date.now() - 12 * DAY,
};
