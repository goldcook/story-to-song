import type {
  LyricSection,
  MoodId,
  MoodProfile,
  NarrativeDirection,
  ReplyReference,
  SongResult,
  StoryEmotionAnalysis,
  StoryEmotionDimensions,
} from '../types'

type MoodDefinition = MoodProfile & { words: string[] }

const MOODS: Record<MoodId, MoodDefinition> = {
  nostalgic: {
    id: 'nostalgic',
    label: '怀念',
    description: '旧时光在心里慢慢回响',
    color: '#d17b55',
    accent: '#f1c596',
    tempo: 70,
    key: 'D 小调',
    scale: 'minor',
    energy: 42,
    warmth: 83,
    genre: '叙事民谣',
    instruments: ['木吉他', '大提琴', '磁带底噪'],
    words: ['曾经', '小时候', '以前', '故乡', '老家', '记得', '回忆', '那年', '过去', '重逢', '照片', '往事', '青春'],
  },
  joyful: {
    id: 'joyful',
    label: '雀跃',
    description: '像阳光突然闯进房间',
    color: '#ef9d32',
    accent: '#ffe19b',
    tempo: 108,
    key: 'G 大调',
    scale: 'major',
    energy: 82,
    warmth: 76,
    genre: '轻快流行',
    instruments: ['原声吉他', '大提琴', '低鼓与沙锤'],
    words: ['开心', '快乐', '喜悦', '兴奋', '幸福', '惊喜', '庆祝', '欢呼', '大笑'],
  },
  melancholy: {
    id: 'melancholy',
    label: '低落',
    description: '没说完的话落在夜色里',
    color: '#5e718d',
    accent: '#a9b8ca',
    tempo: 62,
    key: 'A 小调',
    scale: 'minor',
    energy: 28,
    warmth: 38,
    genre: '卧室流行',
    instruments: ['柔音钢琴', '大提琴', '雨幕空气感'],
    words: ['难过', '悲伤', '离开', '失去', '告别', '孤独', '遗憾', '哭泣', '眼泪', '错过', '分手', '想念', '没说出口', '没有说出口'],
  },
  hopeful: {
    id: 'hopeful',
    label: '希望',
    description: '越过长夜，远处已有微光',
    color: '#608b6a',
    accent: '#b7d39f',
    tempo: 88,
    key: 'C 大调',
    scale: 'major',
    energy: 61,
    warmth: 72,
    genre: '治愈流行',
    instruments: ['钢琴', '大提琴和声', '木琴'],
    words: ['希望', '未来', '终于', '明天', '重新', '勇气', '坚持', '相信', '梦想', '成长', '出发', '天亮', '终点', '微光'],
  },
  tense: {
    id: 'tense',
    label: '汹涌',
    description: '心跳追着时间向前奔跑',
    color: '#b44c3e',
    accent: '#eaa890',
    tempo: 120,
    key: 'E 小调',
    scale: 'minor',
    energy: 91,
    warmth: 31,
    genre: '另类摇滚',
    instruments: ['原声吉他', '实录低鼓', '大提琴低音'],
    words: ['愤怒', '争吵', '逃跑', '追赶', '害怕', '紧张', '恐惧', '战争', '撞击', '着火', '冲突', '呐喊'],
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
    instruments: ['原声吉他', '柔和钢琴', '大提琴'],
    words: ['拥抱', '陪伴', '温暖', '牵手', '礼物', '照顾', '晚安', '心动', '守着', '轻轻'],
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
    instruments: ['木琴泛音', '原声吉他', '大提琴'],
    words: ['安静', '平静', '宁静', '安心', '释然', '放下', '散步', '睡着', '慢慢', '静静'],
  },
}

const STORY_IMAGES = [
  '外婆', '爷爷', '奶奶', '妈妈', '爸爸', '孩子', '朋友', '爱人',
  '夏夜', '星星', '月亮', '阳光', '雨', '雪', '风', '海面', '大海', '山',
  '院子', '蒲扇', '火车', '车站', '站台', '城市', '故乡', '老家', '房间',
  '照片', '书信', '日记', '礼物', '背影', '笑容', '眼泪', '拥抱', '晚安',
  '生日', '蛋糕', '烛光', '灯光', '窗外', '咖啡', '教室', '操场', '街道', '餐桌',
  '梦想', '自由', '青春', '明天', '告别', '重逢', '回家', '远方',
]

interface EmotionRule {
  phrases: string[]
  label: string
  valence: number
  arousal: number
  weight: number
  moods: Partial<Record<MoodId, number>>
  dimensions: Partial<StoryEmotionDimensions>
}

interface StoryClause {
  text: string
  weight: number
  index: number
}

interface EmotionHit {
  phrase: string
  label: string
  valence: number
  arousal: number
  strength: number
  clauseIndex: number
  moods: Partial<Record<MoodId, number>>
  dimensions: Partial<StoryEmotionDimensions>
}

const EMOTION_RULES: EmotionRule[] = [
  {
    phrases: ['再也没有见过', '再也没见过', '再也见不到', '再也回不去了', '永远失去了', '离我而去', '离开了我', '没有说出口', '没说出口', '不在了', '去世', '离世', '失去', '告别', '分手', '错过', '回不去了'],
    label: '失去与告别',
    valence: -0.95,
    arousal: 0.42,
    weight: 4.8,
    moods: { melancholy: 1, nostalgic: 0.22 },
    dimensions: { grief: 1, isolation: 0.58, nostalgia: 0.28 },
  },
  {
    phrases: ['没有希望', '从此没有', '再也没有', '无法挽回', '来不及了', '只剩下', '再也不', '一个人', '独自一人'],
    label: '无法挽回',
    valence: -0.86,
    arousal: 0.38,
    weight: 4.1,
    moods: { melancholy: 1, nostalgic: 0.15 },
    dimensions: { grief: 0.9, isolation: 1 },
  },
  {
    phrases: ['心碎', '痛苦', '绝望', '崩溃', '窒息', '受不了', '撑不住'],
    label: '强烈痛苦',
    valence: -0.96,
    arousal: 0.84,
    weight: 4.5,
    moods: { melancholy: 0.7, tense: 0.72 },
    dimensions: { grief: 0.92, tension: 0.78, isolation: 0.35 },
  },
  {
    phrases: ['难过', '悲伤', '伤心', '遗憾', '后悔', '眼泪', '哭泣', '哭了', '想念', '孤独', '寂寞', '低落'],
    label: '悲伤与想念',
    valence: -0.82,
    arousal: 0.34,
    weight: 3.7,
    moods: { melancholy: 1, nostalgic: 0.2 },
    dimensions: { grief: 1, isolation: 0.32, nostalgia: 0.18 },
  },
  {
    phrases: ['恐惧', '害怕', '紧张', '不安', '担心', '惊慌', '噩梦'],
    label: '害怕与不安',
    valence: -0.68,
    arousal: 0.82,
    weight: 3.7,
    moods: { tense: 1, melancholy: 0.25 },
    dimensions: { tension: 1, isolation: 0.22 },
  },
  {
    phrases: ['愤怒', '生气', '争吵', '冲突', '背叛', '欺骗', '呐喊', '战争', '追赶', '逃跑', '撞击', '着火'],
    label: '冲突与愤怒',
    valence: -0.84,
    arousal: 0.96,
    weight: 4.2,
    moods: { tense: 1 },
    dimensions: { tension: 1, agency: 0.38 },
  },
  {
    phrases: ['终于走出来', '终于放下', '没那么难过了', '不再害怕', '熬过来了', '重新站起来', '重新出发', '会好起来', '新的开始', '继续向前'],
    label: '走出低谷',
    valence: 0.78,
    arousal: 0.56,
    weight: 4.4,
    moods: { hopeful: 1, calm: 0.18 },
    dimensions: { hope: 1, agency: 1, calm: 0.18, openness: 0.28 },
  },
  {
    phrases: ['开心', '快乐', '喜悦', '兴奋', '幸福', '惊喜', '庆祝', '欢呼', '大笑', '如愿以偿'],
    label: '快乐与喜悦',
    valence: 0.9,
    arousal: 0.76,
    weight: 3.9,
    moods: { joyful: 1, tender: 0.12 },
    dimensions: { joy: 1, hope: 0.22, agency: 0.24 },
  },
  {
    phrases: ['终于等到', '看到希望', '还有希望', '相信', '勇气', '坚持', '梦想', '未来', '明天', '天亮', '微光', '出发'],
    label: '希望与前行',
    valence: 0.67,
    arousal: 0.54,
    weight: 3.1,
    moods: { hopeful: 1, joyful: 0.12 },
    dimensions: { hope: 1, agency: 0.62, openness: 0.24 },
  },
  {
    phrases: ['陪伴', '拥抱', '牵手', '照顾', '守着', '温暖', '轻轻', '晚安', '心动', '爱着', '爱你', '谢谢', '礼物'],
    label: '爱与陪伴',
    valence: 0.62,
    arousal: 0.28,
    weight: 3.1,
    moods: { tender: 1, nostalgic: 0.12 },
    dimensions: { tenderness: 1, calm: 0.18 },
  },
  {
    phrases: ['安静', '平静', '宁静', '安心', '释然', '放下', '睡着', '散步', '慢慢', '静静'],
    label: '平静与释然',
    valence: 0.18,
    arousal: 0.09,
    weight: 2.8,
    moods: { calm: 1, tender: 0.08 },
    dimensions: { calm: 1, tenderness: 0.12 },
  },
  {
    phrases: ['小时候', '曾经', '从前', '以前', '那年', '往事', '回忆', '记得', '想起', '旧照片', '故乡', '老家', '多年以后', '青春', '重逢'],
    label: '回忆与时间',
    valence: -0.06,
    arousal: 0.2,
    weight: 2.5,
    moods: { nostalgic: 1, tender: 0.08 },
    dimensions: { nostalgia: 1, tenderness: 0.08 },
  },
  {
    phrases: ['离开', '再见', '结束', '沉默'],
    label: '离开与沉默',
    valence: -0.38,
    arousal: 0.34,
    weight: 1.6,
    moods: { melancholy: 1, nostalgic: 0.22 },
    dimensions: { grief: 0.46, nostalgia: 0.28, isolation: 0.18 },
  },
]

const SEMANTIC_DIMENSIONS: Array<{
  pattern: RegExp
  label: string
  dimension: keyof StoryEmotionDimensions
  strength: number
}> = [
  { pattern: /自由|远方|海面|大海|海边|旷野|天空|公路|风里|飞翔/, label: '自由与空间', dimension: 'openness', strength: 0.72 },
  { pattern: /决定|选择|辞职|重新|出发|继续|走向|跨过|奔跑|坚持/, label: '行动与选择', dimension: 'agency', strength: 0.72 },
  { pattern: /独自|一个人|无人|空荡荡|只剩我|孤身/, label: '孤独与留白', dimension: 'isolation', strength: 0.78 },
  { pattern: /外婆|爷爷|奶奶|妈妈|爸爸|孩子|爱人|家人/, label: '亲密关系', dimension: 'tenderness', strength: 0.34 },
  { pattern: /雨夜|下雨|雨里|夜晚|凌晨|月光|星空/, label: '夜色与空气', dimension: 'calm', strength: 0.2 },
]

const NEGATION_PATTERN = /并没有|并不|不是|不再|从未|从没|没有|未能|不|没|未|别/g
const INTENSIFIER_PATTERN = /非常|特别|真的|实在|太|极其|无比|越来越|很$/
const DOWNTONER_PATTERN = /有点|一点|稍微|偶尔$/
const PRE_CONTRAST_PATTERN = /^(虽然|尽管|即使)/
const CONTRAST_PATTERN = /^(但是|但|可是|却|然而|其实|不过)/
const RESOLUTION_PATTERN = /^(终于|最终|最后|后来)/
const DIMENSION_KEYS: Array<keyof StoryEmotionDimensions> = [
  'joy', 'grief', 'tension', 'tenderness', 'nostalgia', 'hope', 'calm', 'agency', 'openness', 'isolation',
]
const DIMENSION_LABELS: Record<keyof StoryEmotionDimensions, string> = {
  joy: '喜悦',
  grief: '失落',
  tension: '紧张',
  tenderness: '温柔',
  nostalgia: '怀念',
  hope: '希望',
  calm: '平静',
  agency: '行动感',
  openness: '空间感',
  isolation: '孤独感',
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}

function splitClauses(story: string): StoryClause[] {
  const parts = story
    .split(/[，,。！？!?；;：:\n]+/)
    .map((text) => text.trim())
    .filter(Boolean)
  const clauses = parts.length ? parts : [story]
  return clauses.map((text, index) => {
    const recency = 0.88 + index / Math.max(1, clauses.length - 1) * 0.24
    const markerWeight = PRE_CONTRAST_PATTERN.test(text)
      ? 0.68
      : CONTRAST_PATTERN.test(text)
        ? 1.48
        : RESOLUTION_PATTERN.test(text)
          ? 1.28
          : 1
    const nextIsContrast = CONTRAST_PATTERN.test(clauses[index + 1] ?? '')
    return {
      text,
      index,
      weight: recency * markerWeight * (nextIsContrast ? 0.72 : 1),
    }
  })
}

function isNegated(text: string, index: number) {
  const prefix = text.slice(Math.max(0, index - 6), index)
  const negations = prefix.match(NEGATION_PATTERN) ?? []
  return negations.length % 2 === 1
}

function phraseIntensity(text: string, index: number) {
  const prefix = text.slice(Math.max(0, index - 5), index)
  if (INTENSIFIER_PATTERN.test(prefix)) return 1.28
  if (DOWNTONER_PATTERN.test(prefix)) return 0.78
  return 1
}

function collectEmotionHits(clauses: StoryClause[]) {
  const hits: EmotionHit[] = []
  clauses.forEach((clause) => {
    const occupied: Array<[number, number]> = []
    EMOTION_RULES.forEach((rule) => {
      const phrases = [...rule.phrases].sort((a, b) => b.length - a.length)
      phrases.forEach((phrase) => {
        let fromIndex = 0
        while (fromIndex < clause.text.length) {
          const index = clause.text.indexOf(phrase, fromIndex)
          if (index < 0) break
          const end = index + phrase.length
          fromIndex = end
          if (occupied.some(([start, finish]) => index < finish && end > start)) continue
          occupied.push([index, end])
          const negated = isNegated(clause.text, index)
          if (negated && rule.valence < 0) continue
          const intensity = phraseIntensity(clause.text, index)
          const strength = rule.weight * clause.weight * intensity * (negated ? 0.9 : 1)
          hits.push({
            phrase,
            label: negated && rule.valence > 0 ? `缺少${rule.label}` : rule.label,
            valence: negated ? -Math.max(0.55, rule.valence) : rule.valence,
            arousal: negated ? Math.max(0.32, rule.arousal) : rule.arousal,
            strength,
            clauseIndex: clause.index,
            moods: negated
              ? { melancholy: 1, tense: rule.arousal > 0.7 ? 0.25 : 0 }
              : rule.moods,
            dimensions: negated
              ? { grief: 0.72, isolation: 0.28, tension: rule.arousal > 0.7 ? 0.24 : 0 }
              : rule.dimensions,
          })
        }
      })
    })
  })
  return hits
}

function buildEmotionDimensions(story: string, hits: EmotionHit[]) {
  const raw = Object.fromEntries(DIMENSION_KEYS.map((key) => [key, 0])) as unknown as StoryEmotionDimensions
  hits.forEach((hit) => {
    Object.entries(hit.dimensions).forEach(([dimension, contribution]) => {
      raw[dimension as keyof StoryEmotionDimensions] += (contribution ?? 0) * hit.strength
    })
  })
  const semanticEvidence: string[] = []
  SEMANTIC_DIMENSIONS.forEach(({ pattern, dimension, strength }) => {
    const match = story.match(pattern)?.[0]
    if (!match) return
    raw[dimension] += strength * 4
    semanticEvidence.push(match)
  })
  const dimensions = Object.fromEntries(DIMENSION_KEYS.map((key) => [
    key,
    clamp(1 - Math.exp(-raw[key] / 4.4), 0, 1),
  ])) as unknown as StoryEmotionDimensions
  return { dimensions, semanticEvidence }
}

function weightedValence(hits: EmotionHit[]) {
  const weight = hits.reduce((total, hit) => total + hit.strength, 0)
  if (!weight) return 0
  return hits.reduce((total, hit) => total + hit.valence * hit.strength, 0) / weight
}

function getNarrativeDirection(clauses: StoryClause[], hits: EmotionHit[]): NarrativeDirection {
  if (!clauses.length) return 'steady'
  const midpoint = Math.max(1, Math.ceil(clauses.length / 2))
  const earlyHits = hits.filter((hit) => hit.clauseIndex < midpoint)
  const lateHits = hits.filter((hit) => hit.clauseIndex >= midpoint)
  const earlyValence = weightedValence(earlyHits)
  const lateValence = weightedValence(lateHits)
  const positiveStrength = hits.filter((hit) => hit.valence > 0.2).reduce((total, hit) => total + hit.strength, 0)
  const negativeStrength = hits.filter((hit) => hit.valence < -0.2).reduce((total, hit) => total + hit.strength, 0)

  if (lateValence > 0.18 && lateValence - earlyValence > 0.42) return 'rising'
  if (lateValence < -0.18 && earlyValence - lateValence > 0.42) return 'falling'
  if (positiveStrength > 2.4 && negativeStrength > 2.4) return 'bittersweet'
  return 'steady'
}

function buildAnalysisSummary(
  direction: NarrativeDirection,
  evidence: string[],
  mood: MoodDefinition,
  dimensions: StoryEmotionDimensions,
) {
  const directionText: Record<NarrativeDirection, string> = {
    rising: '故事在结尾转向微光',
    falling: '故事在结尾明显下沉',
    bittersweet: '故事同时保留温暖与失落',
    steady: `故事的${mood.label}情绪贯穿始终`,
  }
  const dimensionText = DIMENSION_KEYS
    .map((key) => ({ key, value: dimensions[key] }))
    .filter(({ value }) => value >= 0.18)
    .sort((a, b) => b.value - a.value)
    .slice(0, 3)
    .map(({ key }) => DIMENSION_LABELS[key])
    .join('、')
  if (!evidence.length) return `${directionText[direction]}，以${dimensionText || '留白'}组织旋律和配器。`
  return `${directionText[direction]}；从“${evidence.slice(0, 3).join('、')}”读出${dimensionText || mood.label}，再决定调式、速度与乐器。`
}

function deriveMoodProfile(mood: MoodDefinition, analysis: Omit<StoryEmotionAnalysis, 'summary'>): MoodProfile {
  const { valence, arousal, direction, dimensions } = analysis
  const tempoRanges: Record<MoodId, [number, number]> = {
    nostalgic: [64, 76],
    joyful: [98, 116],
    melancholy: [56, 70],
    hopeful: [78, 96],
    tense: [106, 128],
    tender: [62, 76],
    calm: [54, 66],
  }
  const [minimumTempo, maximumTempo] = tempoRanges[mood.id]
  const compositionalArousal = clamp(
    arousal * 0.54 + dimensions.tension * 0.28 + dimensions.agency * 0.18 - dimensions.calm * 0.12,
    0,
    1,
  )
  const tempo = Math.round(clamp(
    minimumTempo + (maximumTempo - minimumTempo) * compositionalArousal + (direction === 'rising' ? 3 : direction === 'falling' ? -2 : 0),
    minimumTempo,
    maximumTempo,
  ))
  const darkDimensions = dimensions.grief + dimensions.tension * 0.72 + dimensions.isolation * 0.36
  const lightDimensions = dimensions.hope + dimensions.joy + dimensions.tenderness * 0.32
  const shouldUseMinor = valence < -0.2 && darkDimensions > lightDimensions && mood.id !== 'hopeful'
  const scale = shouldUseMinor ? 'minor' : mood.scale
  const minorKeys: Partial<Record<MoodId, string>> = {
    nostalgic: 'D 小调',
    melancholy: 'A 小调',
    tense: 'E 小调',
    calm: 'C 小调',
    tender: 'D 小调',
  }
  const key = scale === 'minor' ? minorKeys[mood.id] ?? 'A 小调' : mood.key
  const energy = Math.round(clamp(12 + compositionalArousal * 70 + dimensions.agency * 12 + (direction === 'rising' ? 4 : 0), 12, 94))
  const warmth = Math.round(clamp(
    48 + valence * 22 + dimensions.tenderness * 28 + dimensions.nostalgia * 15 - dimensions.tension * 18,
    24,
    96,
  ))
  const instruments: string[] = []
  if (dimensions.grief > 0.34) instruments.push('柔音钢琴', '大提琴弓弦')
  if (dimensions.nostalgia > 0.3) instruments.push('原声吉他', '磁带空气感')
  if (dimensions.tension > 0.45) instruments.push('大提琴低音', '实录低鼓')
  if (dimensions.tenderness > 0.34) instruments.push('原声吉他', '大提琴和声')
  if (dimensions.openness > 0.34) instruments.push('吉他泛音', '开阔空气层')
  if (dimensions.hope > 0.38) instruments.push('钢琴', '轻打击乐')
  if (dimensions.calm > 0.4 && dimensions.grief < 0.34) instruments.push('木琴泛音', '大提琴长音')
  instruments.push(...mood.instruments)
  return { ...mood, tempo, key, scale, energy, warmth, instruments: [...new Set(instruments)].slice(0, 4) }
}

export function analyzeStoryEmotion(story: string) {
  const clauses = splitClauses(story)
  const hits = collectEmotionHits(clauses)
  const moodScores = Object.fromEntries(Object.keys(MOODS).map((id) => [id, 0])) as Record<MoodId, number>
  hits.forEach((hit) => {
    Object.entries(hit.moods).forEach(([moodId, score]) => {
      moodScores[moodId as MoodId] += (score ?? 0) * hit.strength
    })
  })

  const valence = clamp(weightedValence(hits), -1, 1)
  const totalStrength = hits.reduce((total, hit) => total + hit.strength, 0)
  const arousal = totalStrength
    ? clamp(hits.reduce((total, hit) => total + hit.arousal * hit.strength, 0) / totalStrength, 0, 1)
    : 0.18
  const direction = getNarrativeDirection(clauses, hits)
  const { dimensions, semanticEvidence } = buildEmotionDimensions(story, hits)
  if (!hits.length && semanticEvidence.length === 0) dimensions.calm = 0.42

  if (direction === 'rising') {
    if (dimensions.hope + dimensions.agency > 0.62) moodScores.hopeful += 4.2
    else if (dimensions.tenderness > 0.34) moodScores.tender += 2.8
    else moodScores.hopeful += 1.2
  }
  if (direction === 'falling') moodScores.melancholy += 3.6
  if (direction === 'bittersweet') {
    moodScores.nostalgic += 2.8
    moodScores.melancholy += 1.2
  }
  if (valence < -0.34) moodScores.melancholy += Math.abs(valence) * 3.2
  if (valence < -0.28 && arousal > 0.68) moodScores.tense += arousal * 2.8
  if (valence > 0.38 && arousal > 0.58) moodScores.joyful += valence * 2.2
  if (!hits.length) moodScores.calm = 1

  const ranked = (Object.keys(MOODS) as MoodId[])
    .map((id) => ({ mood: MOODS[id], score: moodScores[id] }))
    .sort((a, b) => b.score - a.score)
  const evidenceCandidates = [...new Set([
    ...hits.sort((a, b) => b.strength - a.strength).map((hit) => hit.phrase),
    ...semanticEvidence,
  ])]
  const evidence = evidenceCandidates.reduce<string[]>((items, candidate) => {
    if (items.some((item) => item.includes(candidate) || candidate.includes(item))) return items
    return [...items, candidate]
  }, []).slice(0, 5)
  const margin = ranked[0].score - ranked[1].score
  const confidence = clamp(0.42 + Math.min(0.34, totalStrength / 24) + Math.min(0.18, margin / 18), 0.42, 0.94)
  const analysisBase = { valence, arousal, direction, confidence, dimensions, evidence }
  const mood = deriveMoodProfile(ranked[0].mood, analysisBase)
  return {
    analysis: {
      ...analysisBase,
      summary: buildAnalysisSummary(direction, evidence, ranked[0].mood, dimensions),
    } satisfies StoryEmotionAnalysis,
    mood,
    ranked,
  }
}

export const samples = [
  {
    label: '想起一个人',
    story: '小时候的夏夜，外婆总带我坐在院子里乘凉。她摇着蒲扇，我数着天上的星星。后来我去了很远的城市，外婆也老了。去年回家，她还是拿出那把旧蒲扇，只是这一次，换我轻轻为她扇风。',
  },
  {
    label: '记住一次出发',
    story: '辞职后的第三天，我买了一张凌晨的火车票。窗外的城市慢慢退后，我不知道终点会有什么，但第一次觉得害怕也可以和自由同时发生。天亮时，远处的海面像一封刚拆开的信。',
  },
  {
    label: '留住没说完的话',
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

function extractKeywords(story: string, mood: MoodDefinition) {
  const found = STORY_IMAGES.filter((word) => story.includes(word))
  const moodWords = mood.words.filter((word) => story.includes(word) && word.length > 1)
  const unique = [...new Set([...found, ...moodWords])]
  return [...new Set([...unique, mood.label])].slice(0, 5)
}

function shortLine(text: string, max = 13) {
  const stripped = text.replace(/[，,。！？!?]/g, ' ')
  if (stripped.length <= max) return stripped
  return stripped.slice(0, max).trim()
}

function buildStoryExcerpt(story: string, keywords: string[]) {
  const sentences = story
    .split(/[。！？!?；;\n]+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 6)
  const ranked = sentences
    .map((sentence, index) => ({
      sentence,
      score: index
        + (/(只是|这一次|终于|原来|天亮|回头|换我|没说出口)/.test(sentence) ? 8 : 0)
        + keywords.reduce((total, keyword) => total + (sentence.includes(keyword) ? 2 : 0), 0),
    }))
    .sort((a, b) => b.score - a.score)
  const excerpt = ranked[0]?.sentence || story.trim()
  return excerpt.length > 46 ? `${excerpt.slice(0, 45)}…` : excerpt
}

function buildLyrics(story: string, mood: MoodProfile, keywords: string[], seed: number) {
  const sentences = splitStory(story)
  const first = shortLine(sentences[0])
  const middle = shortLine(sentences[Math.floor(sentences.length / 2)] || sentences[0])
  const last = shortLine(sentences.at(-1) || sentences[0])
  const image = keywords.find((keyword) => STORY_IMAGES.includes(keyword)) || '那一天'
  const detail = keywords.find((keyword) => keyword !== image && STORY_IMAGES.includes(keyword)) || '旧时光'

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
    nostalgic: [`我还记得${image}的风`, '吹过从前，也吹向以后'],
    joyful: [`就让我们向着${image}奔跑`, '把每次心跳都唱成拥抱'],
    melancholy: ['如果想念也有尽头', `为何${image}还停在胸口`],
    hopeful: ['天亮以前别松开手', `走过${image}就会看见以后`],
    tense: [`让所有沉默燃成${image}的火`, '这一次我不再退后'],
    tender: [`我会把${image}轻轻放在心口`, '平凡的爱也足够长久'],
    calm: [`让风经过，${image}不必开口`, '此刻安静就已经足够'],
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

function getTheme(story: string, mood: MoodProfile) {
  const rules = [
    { words: ['妈妈', '爸爸', '外婆', '爷爷', '奶奶', '家人'], theme: '关于家与陪伴' },
    { words: ['生日', '蛋糕', '烛光', '庆祝'], theme: '关于庆祝与长大' },
    { words: ['爱人', '心动', '分手', '拥抱'], theme: '关于爱与错过' },
    { words: ['朋友', '同学'], theme: '关于同行与记得' },
    { words: ['故乡', '老家'], theme: '关于离开与归来' },
    { words: ['梦想', '工作', '辞职', '出发', '重新'], theme: '关于选择与成长' },
  ]
  return rules.find((rule) => rule.words.some((word) => story.includes(word)))?.theme
    ?? ({
      nostalgic: '关于想念与时间',
      joyful: '关于快乐的瞬间',
      melancholy: '关于没说完的话',
      hopeful: '关于继续向前',
      tense: '关于心里的风暴',
      tender: '关于日常里的温柔',
      calm: '关于安静的一刻',
    } satisfies Record<MoodId, string>)[mood.id]
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
文字判断：${result.analysis.summary}
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

function makeTitleCandidates(story: string, keywords: string[]) {
  const image = keywords.find((keyword) => STORY_IMAGES.includes(keyword) && keyword.length <= 3)
  const detail = keywords.find((keyword) => keyword !== image && STORY_IMAGES.includes(keyword) && keyword.length <= 3)
  const candidates: string[] = []

  if (/(生日|蛋糕|烛光)/.test(story)) candidates.push('生日烛光熄灭前')
  if (story.includes('蒲扇')) candidates.push(story.includes('换我') ? '换我为你扇风' : '蒲扇里的夏夜')
  if (story.includes('站台') && story.includes('雨')) candidates.push('雨停在站台')
  if (story.includes('火车') && /(海|天亮)/.test(story)) candidates.push('天亮时，海在等我')
  if (/(窗|窗外)/.test(story) && /(灯|灯光)/.test(story)) candidates.push('窗外最后一盏灯')
  if (story.includes('照片')) candidates.push('照片背面的那一天')
  if (/(书信|信)/.test(story)) candidates.push('一封刚拆开的信')
  if (story.includes('回家') && /(外婆|爷爷|奶奶|妈妈|爸爸|故乡|老家|多年|去年)/.test(story)) candidates.push('回家以后风还记得')
  if (image && /(告别|再见|离开)/.test(story)) candidates.push(`${image}没说完的再见`)
  if (image && /(出发|远方|自由)/.test(story)) candidates.push(`越过${image}以后`)

  candidates.push(
    ...(image ? [`${image}还在风里`, `把${image}留给夜色`] : []),
    ...(detail ? [`${detail}没有走远`] : []),
    '那一天没有走远',
    '平凡的一天值得记住',
    '故事留在夜色里',
  )
  return [...new Set(candidates)].filter((title) => title.length <= 10)
}

interface GenerateSongOptions {
  id?: string
  createdAt?: number
  replyTo?: ReplyReference
  title?: string
  moodId?: MoodId
}

function getSecondaryMood(
  primaryMood: MoodId,
  rankedMoods: Array<{ mood: MoodDefinition; score: number }>,
  analysis: StoryEmotionAnalysis,
) {
  if (analysis.direction === 'rising'
    && analysis.valence > 0
    && analysis.dimensions.grief + analysis.dimensions.tension > 0.34) return '余悸'
  if (analysis.direction === 'falling') return '失落'
  if (analysis.direction === 'bittersweet') return primaryMood === 'melancholy' ? '怀念' : '遗憾'
  const secondary = rankedMoods.find(({ mood, score }) => mood.id !== primaryMood && score > 0)
  return secondary?.mood.label ?? '克制'
}

export function generateSong(story: string, options: GenerateSongOptions = {}): SongResult {
  const normalizedStory = story.trim().replace(/\s+/g, ' ')
  const seed = hashStory(normalizedStory)
  const emotionResult = analyzeStoryEmotion(normalizedStory)
  const moodDefinition = options.moodId ? MOODS[options.moodId] : emotionResult.ranked[0].mood
  const mood = options.moodId ? deriveMoodProfile(moodDefinition, emotionResult.analysis) : emotionResult.mood
  const analysis = options.moodId
    ? {
        ...emotionResult.analysis,
        summary: buildAnalysisSummary(
          emotionResult.analysis.direction,
          emotionResult.analysis.evidence,
          moodDefinition,
          emotionResult.analysis.dimensions,
        ),
      }
    : emotionResult.analysis
  const secondaryMood = getSecondaryMood(mood.id, emotionResult.ranked, analysis)
  const keywords = extractKeywords(normalizedStory, moodDefinition)
  const excerpt = buildStoryExcerpt(normalizedStory, keywords)
  const { sections, hook } = buildLyrics(normalizedStory, mood, keywords, seed)
  const titleCandidates = makeTitleCandidates(normalizedStory, keywords)
  const base = {
    id: options.id ?? `${options.createdAt ?? Date.now()}-${seed}`,
    createdAt: options.createdAt ?? Date.now(),
    story: normalizedStory,
    title: options.title ?? titleCandidates[0],
    mood,
    secondaryMood,
    theme: getTheme(normalizedStory, mood),
    keywords,
    excerpt,
    hook,
    lyrics: sections,
    analysis,
    replyTo: options.replyTo,
  }
  return { ...base, prompt: buildPrompt(base) }
}

export function getAlternateTitle(result: SongResult, offset: number) {
  const candidates = makeTitleCandidates(result.story, result.keywords)
  const currentIndex = Math.max(0, candidates.indexOf(result.title))
  return candidates[(currentIndex + offset) % candidates.length]
}
