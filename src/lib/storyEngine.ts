import type { LyricSection, MoodId, MoodProfile, SongResult } from '../types'

type ScorableMood = MoodProfile & { words: string[] }

const MOODS: Record<MoodId, ScorableMood> = {
  nostalgic: {
    id: 'nostalgic',
    label: '怀念',
    description: '旧时光在心里慢慢回响',
    color: '#d17b55',
    accent: '#f1c596',
    tempo: 76,
    key: 'D 大调 / B 小调',
    scale: 'pentatonic',
    energy: 42,
    warmth: 83,
    genre: '叙事民谣',
    instruments: ['木吉他', '大提琴', '磁带底噪'],
    words: ['曾经', '小时候', '以前', '故乡', '老家', '记得', '回忆', '那年', '过去', '重逢', '照片', '车站', '回家', '旧', '老了'],
  },
  joyful: {
    id: 'joyful',
    label: '雀跃',
    description: '像阳光突然闯进房间',
    color: '#ef9d32',
    accent: '#ffe19b',
    tempo: 118,
    key: 'G 大调',
    scale: 'major',
    energy: 82,
    warmth: 76,
    genre: '轻快流行',
    instruments: ['原声吉他', '手鼓', '口哨'],
    words: ['开心', '快乐', '笑', '阳光', '旅行', '自由', '喜欢', '惊喜', '庆祝', '夏天', '朋友', '奔跑'],
  },
  melancholy: {
    id: 'melancholy',
    label: '低落',
    description: '没说完的话落在夜色里',
    color: '#5e718d',
    accent: '#a9b8ca',
    tempo: 66,
    key: 'A 小调',
    scale: 'minor',
    energy: 28,
    warmth: 38,
    genre: '卧室流行',
    instruments: ['柔音钢琴', '大提琴', '环境雨声'],
    words: ['难过', '悲伤', '离开', '失去', '再见', '孤独', '遗憾', '哭泣', '眼泪', '错过', '分手', '想念', '站台', '没说出口', '没有说出口'],
  },
  hopeful: {
    id: 'hopeful',
    label: '希望',
    description: '越过长夜，远处已有微光',
    color: '#608b6a',
    accent: '#b7d39f',
    tempo: 92,
    key: 'C 大调',
    scale: 'major',
    energy: 61,
    warmth: 72,
    genre: '治愈流行',
    instruments: ['钢琴', '弦乐四重奏', '钟琴'],
    words: ['希望', '未来', '终于', '明天', '重新', '勇气', '坚持', '相信', '梦想', '成长', '出发', '天亮', '终点', '微光'],
  },
  tense: {
    id: 'tense',
    label: '汹涌',
    description: '心跳追着时间向前奔跑',
    color: '#b44c3e',
    accent: '#eaa890',
    tempo: 132,
    key: 'E 小调',
    scale: 'minor',
    energy: 91,
    warmth: 31,
    genre: '另类摇滚',
    instruments: ['失真吉他', '强力鼓组', '合成器低音'],
    words: ['愤怒', '争吵', '逃跑', '追赶', '害怕', '紧张', '疯狂', '战争', '撞击', '着火', '火焰', '冲动', '呐喊'],
  },
  tender: {
    id: 'tender',
    label: '温柔',
    description: '有人把微小的瞬间轻轻接住',
    color: '#c97872',
    accent: '#efbeb2',
    tempo: 72,
    key: 'F 大调',
    scale: 'pentatonic',
    energy: 36,
    warmth: 94,
    genre: '温柔唱作',
    instruments: ['尼龙弦吉他', '柔和钢琴', '弦乐'],
    words: ['爱', '拥抱', '陪伴', '妈妈', '爸爸', '孩子', '温暖', '牵手', '礼物', '照顾', '晚安', '心动'],
  },
  calm: {
    id: 'calm',
    label: '安静',
    description: '风经过，世界留下一点空白',
    color: '#577f80',
    accent: '#a8cbc1',
    tempo: 60,
    key: 'C 五声音阶',
    scale: 'pentatonic',
    energy: 20,
    warmth: 63,
    genre: '氛围民谣',
    instruments: ['电钢琴', '手碟', '自然环境声'],
    words: ['安静', '平静', '风', '海', '山', '夜晚', '星星', '散步', '月亮', '睡着', '湖', '下雨'],
  },
}

const STORY_IMAGES = [
  '外婆', '爷爷', '奶奶', '妈妈', '爸爸', '孩子', '朋友', '爱人',
  '夏夜', '星星', '月亮', '阳光', '雨', '雪', '风', '海面', '大海', '山',
  '院子', '蒲扇', '火车', '车站', '站台', '城市', '故乡', '老家', '房间',
  '照片', '书信', '日记', '礼物', '背影', '笑容', '眼泪', '拥抱', '晚安',
  '梦想', '自由', '青春', '明天', '告别', '重逢', '回家', '远方',
]

export const samples = [
  {
    label: '童年夏夜',
    story: '小时候的夏夜，外婆总带我坐在院子里乘凉。她摇着蒲扇，我数着天上的星星。后来我去了很远的城市，外婆也老了。去年回家，她还是拿出那把旧蒲扇，只是这一次，换我轻轻为她扇风。',
  },
  {
    label: '凌晨出发',
    story: '辞职后的第三天，我买了一张凌晨的火车票。窗外的城市慢慢退后，我不知道终点会有什么，但第一次觉得害怕也可以和自由同时发生。天亮时，远处的海面像一封刚拆开的信。',
  },
  {
    label: '没有告别',
    story: '我们最后一次见面是在雨里。你赶着上车，我说下次再好好聊。车门关上以后，那句再见一直没有说出口。很多年过去，我偶尔还是会在下雨的站台，想起你回头时模糊的笑。',
  },
]

function hashStory(story: string) {
  let hash = 0
  for (let i = 0; i < story.length; i += 1) hash = (hash * 31 + story.charCodeAt(i)) >>> 0
  return hash
}

function pick<T>(items: T[], seed: number, offset = 0): T {
  return items[(seed + offset * 17) % items.length]
}

function cleanSentence(sentence: string) {
  return sentence
    .replace(/[“”"']/g, '')
    .replace(/^(有一天|后来|然后|但是|而且|那时候|我记得)[，,]?/, '')
    .trim()
}

function splitStory(story: string) {
  const sentences = story
    .split(/[。！？!?；;\n]+/)
    .map(cleanSentence)
    .filter((item) => item.length > 2)
  return sentences.length ? sentences : [story.trim()]
}

function scoreMoods(story: string) {
  const entries = Object.values(MOODS).map((mood) => ({
    mood,
    score: mood.words.reduce((score, word) => score + (story.includes(word) ? 2 : 0), 0),
  }))
  if (/[!！]{2,}/.test(story)) {
    entries.find(({ mood }) => mood.id === 'tense')!.score += 2
  }
  if (entries.every(({ score }) => score === 0)) {
    entries.find(({ mood }) => mood.id === 'tender')!.score = 1
  }
  return entries.sort((a, b) => b.score - a.score)
}

function extractKeywords(story: string, mood: ScorableMood) {
  const found = STORY_IMAGES.filter((word) => story.includes(word))
  const moodWords = mood.words.filter((word) => story.includes(word) && word.length > 1)
  const unique = [...new Set([...found, ...moodWords])]
  if (unique.length >= 4) return unique.slice(0, 5)

  const candidates = splitStory(story)
    .flatMap((sentence) => sentence.split(/[，,、\s]/))
    .map((chunk) => chunk.replace(/^(我|你|他|她|我们|他们)/, '').slice(0, 5))
    .filter((chunk) => chunk.length >= 2)

  return [...new Set([...unique, ...candidates, mood.label])].slice(0, 5)
}

function shortLine(text: string, max = 13) {
  const stripped = text.replace(/[，,。！？!?]/g, ' ')
  if (stripped.length <= max) return stripped
  return stripped.slice(0, max).trim()
}

function buildLyrics(story: string, mood: ScorableMood, keywords: string[], seed: number) {
  const sentences = splitStory(story)
  const first = shortLine(sentences[0])
  const middle = shortLine(sentences[Math.floor(sentences.length / 2)] || sentences[0])
  const last = shortLine(sentences.at(-1) || sentences[0])
  const image = keywords[0] || '那一天'
  const detail = keywords[1] || '旧时光'

  const openings = [
    [first, `风把${detail}吹得很远`, middle, '我把沉默留在原点'],
    [`故事从${image}开始`, first, '人群匆匆经过身边', middle],
    ['那天的天空很近', first, `${detail}还停在手心`, '像一句没唱完的声音'],
  ]
  const preChoruses = [
    ['如果时间愿意慢一点', '我会把每个瞬间再看一遍'],
    ['原来最轻的那句话', '要走很远才听得见'],
    [`我沿着记忆往回走`, `又遇见${image}的路口`],
  ]
  const hooks: Record<MoodId, string[]> = {
    nostalgic: [`我还记得 ${image}的风`, '吹过从前 也吹向以后'],
    joyful: [`就让我们 向着${image}奔跑`, '把每次心跳 都唱成拥抱'],
    melancholy: ['如果想念 也有尽头', `为何${image} 还停在胸口`],
    hopeful: ['天亮以前 别松开手', `越过${image} 就会看见以后`],
    tense: [`让所有沉默 燃成${image}的火`, '这一次我 不再退后'],
    tender: [`我会把${image} 轻轻放在心口`, '平凡的爱 也足够长久'],
    calm: [`让风经过 ${image}不必开口`, '此刻安静 就已经足够'],
  }
  const hook = hooks[mood.id]
  const bridges = [
    [last, '原来答案从不在远方', '是我们走过以后', '仍愿意回头望一望'],
    ['多年以后再回头', `${detail}有了新的模样`, '那些来不及说的话', '都在旋律里慢慢生长'],
    ['世界继续向前走', last, '我终于学会把遗憾', '唱成温柔的回响'],
  ]
  const sections: LyricSection[] = [
    { label: '主歌 1', lines: pick(openings, seed) },
    { label: '预副歌', lines: pick(preChoruses, seed, 1) },
    { label: '副歌', lines: [hook[0], hook[1], hook[0], '故事没有结束 只是换一种节奏'] },
    { label: '桥段', lines: pick(bridges, seed, 2) },
    { label: '尾声', lines: [hook[0], hook[1], `${last}，我一直记得`] },
  ]
  return { sections, hook: hook.join(' / ') }
}

function getTheme(story: string, keywords: string[], mood: MoodProfile) {
  const rules = [
    { words: ['妈妈', '爸爸', '外婆', '爷爷', '奶奶', '家人'], theme: '关于家与陪伴' },
    { words: ['爱', '喜欢', '心动', '分手', '拥抱'], theme: '关于爱与错过' },
    { words: ['朋友', '同学', '我们'], theme: '关于同行与告别' },
    { words: ['故乡', '老家', '回家', '城市'], theme: '关于离开与归来' },
    { words: ['梦想', '工作', '辞职', '出发'], theme: '关于选择与成长' },
  ]
  return rules.find((rule) => rule.words.some((word) => story.includes(word)))?.theme
    ?? `关于${keywords[0] || mood.description}`
}

function buildPrompt(result: Omit<SongResult, 'prompt'>) {
  const lyrics = result.lyrics
    .map((section) => `[${section.label}]\n${section.lines.join('\n')}`)
    .join('\n\n')
  return `创作一首中文${result.mood.genre}歌曲。

【情绪与叙事】
核心情绪：${result.mood.label}，辅情绪：${result.secondaryMood}
主题：${result.theme}
整体画面：${result.mood.description}
演唱要克制、真诚，有讲故事的呼吸感，不要过度炫技。

【音乐设计】
速度：${result.mood.tempo} BPM
调性：${result.mood.key}
编制：${result.mood.instruments.join('、')}
结构：短前奏 - 主歌 - 预副歌 - 副歌 - 桥段 - 双副歌 - 留白尾奏
制作：主歌保持近距离人声，副歌拓宽声场；保留动态和真实乐器质感，避免廉价 EDM 音色。

【歌词】
歌名：《${result.title}》
${lyrics}

【输出要求】
歌曲时长 2 分 40 秒至 3 分 20 秒；普通话自然咬字；副歌旋律清晰易记；不要修改核心故事意象“${result.keywords.slice(0, 3).join('、')}”。`
}

function makeTitle(keywords: string[], mood: MoodProfile, seed: number) {
  const keyword = keywords[0] || mood.label
  const patterns = [
    `${keyword}还在唱`,
    `把${keyword}留给风`,
    `${keyword}以后的我们`,
    `第${(seed % 8) + 1}次想起${keyword}`,
    `${keyword}没有说再见`,
  ]
  return pick(patterns, seed, 4)
}

export function generateSong(story: string): SongResult {
  const normalizedStory = story.trim().replace(/\s+/g, ' ')
  const seed = hashStory(normalizedStory)
  const rankedMoods = scoreMoods(normalizedStory)
  const mood = rankedMoods[0].mood
  const secondaryMood = rankedMoods[1].score > 0 ? rankedMoods[1].mood.label : '克制'
  const keywords = extractKeywords(normalizedStory, mood)
  const { sections, hook } = buildLyrics(normalizedStory, mood, keywords, seed)
  const base = {
    id: `${Date.now()}-${seed}`,
    createdAt: Date.now(),
    story: normalizedStory,
    title: makeTitle(keywords, mood, seed),
    mood,
    secondaryMood,
    theme: getTheme(normalizedStory, keywords, mood),
    keywords,
    hook,
    lyrics: sections,
  }
  return { ...base, prompt: buildPrompt(base) }
}
