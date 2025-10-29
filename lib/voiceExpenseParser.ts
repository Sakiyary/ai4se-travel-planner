const CATEGORY_KEYWORDS: Array<{ category: string; keywords: string[] }> = [
  {
    category: '餐饮',
    keywords: ['吃', '餐', '饭', '早餐', '午餐', '晚餐', '宵夜', '美食', '餐厅', '餐馆', '点餐', '饮料', '奶茶']
  },
  {
    category: '交通',
    keywords: ['打车', '出租', '地铁', '公交', '滴滴', '高铁', '动车', '火车', '飞机', '车票', '船票', '交通', '机票']
  },
  {
    category: '住宿',
    keywords: ['酒店', '民宿', '住宿', '房费', '旅馆', '入住']
  },
  {
    category: '门票',
    keywords: ['门票', '景区', '景点', '入园', '展览', '博物馆']
  },
  {
    category: '购物',
    keywords: ['购物', '买', '买了', '纪念品', '特产', '免税', '商场']
  },
  {
    category: '娱乐',
    keywords: ['歌剧', '演出', '娱乐', '游玩', '体验', '项目']
  }
];

const METHOD_KEYWORDS: Array<{ method: string; keywords: string[] }> = [
  { method: '移动支付', keywords: ['微信', '支付宝', '扫码', '二维码', '花呗'] },
  { method: '信用卡', keywords: ['信用卡', '刷卡', 'visa', 'master', 'amex'] },
  { method: '现金', keywords: ['现金', '付现金', '零钱', '钞票'] }
];

const CURRENCY_PATTERNS: Array<{ matcher: RegExp; code: string }> = [
  { matcher: /(美元|美金|usd)/i, code: 'USD' },
  { matcher: /(日元|日币|jpy)/i, code: 'JPY' },
  { matcher: /(欧元|eur)/i, code: 'EUR' },
  { matcher: /(港币|hkd)/i, code: 'HKD' },
  { matcher: /(新台币|ntd|twd)/i, code: 'TWD' },
  { matcher: /(韩元|krw)/i, code: 'KRW' }
];

const DEFAULT_CURRENCY = 'CNY';

export interface ParsedVoiceExpense {
  amount: number | null;
  currency: string;
  category: string | null;
  method: string | null;
  notes: string;
}

export function parseExpenseFromTranscript(transcript: string | null | undefined): ParsedVoiceExpense {
  const safeTranscript = (transcript ?? '').trim();
  const normalized = safeTranscript.replace(/[，,]/g, ' ');

  const currency = detectCurrency(normalized);
  const amount = detectAmount(normalized);
  const category = detectCategory(normalized);
  const method = detectMethod(normalized);

  return {
    amount,
    currency,
    category,
    method,
    notes: safeTranscript
  };
}

function detectCurrency(text: string): string {
  for (const pattern of CURRENCY_PATTERNS) {
    if (pattern.matcher.test(text)) {
      return pattern.code;
    }
  }
  if (/(人民币|rmb|¥|￥|元|块)/i.test(text)) {
    return 'CNY';
  }
  return DEFAULT_CURRENCY;
}

function detectAmount(text: string): number | null {
  const currencyLeading = text.match(/(?:¥|￥|人民币|RMB|美元|美金|USD|日元|JPY|欧元|EUR|港币|HKD|新台币|NTD|TWD|韩元|KRW)\s*(\d+(?:\.\d+)?)/i);
  if (currencyLeading?.[1]) {
    const parsed = Number(currencyLeading[1]);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  const currencyTrailing = text.match(/(\d+(?:\.\d+)?)(?:\s*(?:元|块|人民币|RMB|美元|美金|USD|日元|JPY|欧元|EUR|港币|HKD|新台币|NTD|TWD|韩元|KRW))/i);
  if (currencyTrailing?.[1]) {
    const parsed = Number(currencyTrailing[1]);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  const allNumbers = text.match(/\d+(?:\.\d+)?/g);
  if (allNumbers) {
    for (const match of allNumbers) {
      const parsed = Number(match);
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }
  }

  return null;
}

function detectCategory(text: string): string | null {
  const lowerText = text.toLowerCase();
  for (const item of CATEGORY_KEYWORDS) {
    if (item.keywords.some((keyword) => lowerText.includes(keyword))) {
      return item.category;
    }
  }
  return null;
}

function detectMethod(text: string): string | null {
  const lowerText = text.toLowerCase();
  for (const item of METHOD_KEYWORDS) {
    if (item.keywords.some((keyword) => lowerText.includes(keyword))) {
      return item.method;
    }
  }
  return null;
}
