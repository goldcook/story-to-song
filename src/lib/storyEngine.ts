import type {
  LyricSection,
  MoodId,
  MoodProfile,
  NarrativeDirection,
  ReplyReference,
  SongResult,
  StoryEmotionAnalysis,
  StoryEmotionDimensions,
  StorySafety,
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
    instruments: ['木吉他', '大提琴', '柔音钢琴'],
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
    instruments: ['原声吉他', '明亮钢琴', '框鼓与沙锤'],
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
    instruments: ['柔音钢琴', '大提琴', '单簧管'],
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
    instruments: ['钢琴', '原声吉他', '轻打击乐'],
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
    instruments: ['原声吉他', '实录框鼓', '大提琴低音'],
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
    instruments: ['原声吉他', '柔和钢琴'],
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
    instruments: ['单簧管', '原声吉他'],
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
    phrases: ['喜极而泣', '开心得哭了', '开心才哭了', '幸福得哭了', '感动得哭了'],
    label: '喜悦的眼泪',
    valence: 0.88,
    arousal: 0.68,
    weight: 4.5,
    moods: { joyful: 1, tender: 0.28 },
    dimensions: { joy: 1, tenderness: 0.42, hope: 0.18 },
  },
  {
    phrases: ['终于自由了', '终于自由', '重获自由', '获得自由', '第一次感到自由', '害怕也可以和自由同时发生'],
    label: '释放与自由',
    valence: 0.74,
    arousal: 0.48,
    weight: 4.1,
    moods: { hopeful: 1, joyful: 0.18 },
    dimensions: { hope: 0.82, agency: 0.76, openness: 1, calm: 0.16 },
  },
  {
    phrases: ['决定好好生活', '继续好好生活', '继续生活', '继续走下去', '带着爱继续', '学会释怀', '学会和解', '接受这一切', '开始新的生活', '往前走'],
    label: '带着经历前行',
    valence: 0.6,
    arousal: 0.38,
    weight: 3.9,
    moods: { hopeful: 1, tender: 0.25 },
    dimensions: { hope: 0.86, agency: 1, tenderness: 0.24, calm: 0.18 },
  },
  {
    phrases: ['感到轻松', '有一点轻松', '松了一口气', '如释重负', '开始期待', '有些期待', '期待下一站', '很期待', '盼望'],
    label: '轻松与期待',
    valence: 0.7,
    arousal: 0.42,
    weight: 3.8,
    moods: { hopeful: 1, joyful: 0.18, calm: 0.12 },
    dimensions: { hope: 1, agency: 0.48, openness: 0.42, calm: 0.36 },
  },
  {
    phrases: ['开始认真吃饭', '好好吃饭', '开始照顾自己', '愿意重新见朋友', '重新见朋友', '重新和人联系', '愿意出门', '愿意再次出门'],
    label: '重新回到生活',
    valence: 0.56,
    arousal: 0.32,
    weight: 3.6,
    moods: { hopeful: 1, tender: 0.2 },
    dimensions: { hope: 0.78, agency: 0.82, calm: 0.22, tenderness: 0.18 },
  },
  {
    phrases: ['再也没有见过', '再也没见过', '再也见不到', '再也回不去了', '永远失去了', '离开这个世界', '离开了我们', '离开了我', '离我而去', '他离开了', '她离开了', '你离开了', '没有说出口', '没说出口', '不在了', '去世', '离世', '失去', '告别', '分手', '错过', '回不去了'],
    label: '失去与告别',
    valence: -0.95,
    arousal: 0.42,
    weight: 4.8,
    moods: { melancholy: 1, nostalgic: 0.22 },
    dimensions: { grief: 1, isolation: 0.58, nostalgia: 0.28 },
  },
  {
    phrases: ['彻底失望', '失望', '被拒绝', '被否定', '被否掉', '被辞退', '被解雇', '落选', '失败了', '失败', '落空'],
    label: '失望与受挫',
    valence: -0.78,
    arousal: 0.5,
    weight: 3.8,
    moods: { melancholy: 1, tense: 0.28 },
    dimensions: { grief: 0.82, tension: 0.42, isolation: 0.18 },
  },
  {
    phrases: ['不再期待', '不抱希望', '失去期待', '没有盼头', '看不到希望'],
    label: '期待落空',
    valence: -0.72,
    arousal: 0.36,
    weight: 3.7,
    moods: { melancholy: 1, nostalgic: 0.12 },
    dimensions: { grief: 0.78, isolation: 0.28, tension: 0.16 },
  },
  {
    phrases: ['舍不得', '不舍', '留恋'],
    label: '不舍与留恋',
    valence: -0.44,
    arousal: 0.26,
    weight: 2.8,
    moods: { nostalgic: 1, melancholy: 0.52, tender: 0.2 },
    dimensions: { nostalgia: 0.82, grief: 0.46, tenderness: 0.22 },
  },
  {
    phrases: ['遭受家暴', '被家暴', '被侵犯', '被伤害', '被殴打', '长期被打', '被虐待', '虐待', '性侵'],
    label: '创伤与伤害',
    valence: -0.92,
    arousal: 0.72,
    weight: 4.4,
    moods: { melancholy: 0.82, tense: 0.65 },
    dimensions: { grief: 0.86, tension: 0.75, isolation: 0.48 },
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
    phrases: ['愤怒', '生气', '怨恨', '恨', '争吵', '冲突', '背叛', '欺骗', '呐喊', '战争', '追赶', '逃跑', '撞击', '着火'],
    label: '冲突与愤怒',
    valence: -0.84,
    arousal: 0.96,
    weight: 4.2,
    moods: { tense: 1 },
    dimensions: { tension: 1, agency: 0.38 },
  },
  {
    phrases: ['终于走出来', '终于放下', '没那么难过了', '不再难过', '不再害怕', '不再孤独', '不再生气', '松了一口气', '熬过来了', '重新站起来', '重新出发', '会好起来', '新的开始', '继续向前'],
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
    phrases: ['终于等到天亮', '熬到天亮', '看到希望', '还有希望', '相信明天', '相信未来', '期待未来', '走向未来', '明天会更好', '相信', '勇气', '坚持', '梦想', '微光'],
    label: '希望与前行',
    valence: 0.67,
    arousal: 0.54,
    weight: 3.1,
    moods: { hopeful: 1, joyful: 0.12 },
    dimensions: { hope: 1, agency: 0.62, openness: 0.24 },
  },
  {
    phrases: ['陪伴', '陪着', '拥抱', '牵手', '照顾', '守着', '温暖', '轻轻', '晚安', '心动', '感动', '爱着', '爱你', '谢谢', '礼物'],
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
    phrases: ['再见', '结束', '沉默'],
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
  dimension: keyof StoryEmotionDimensions
  strength: number
}> = [
  { pattern: /自由|远方|海面|大海|海边|旷野|天空|公路|风里|飞翔/, dimension: 'openness', strength: 0.72 },
  { pattern: /决定|选择|辞职|重新|出发|继续|走向|跨过|奔跑|坚持|下一站/, dimension: 'agency', strength: 0.72 },
  { pattern: /独自|一个人|无人|空荡荡|只剩我|孤身/, dimension: 'isolation', strength: 0.78 },
  { pattern: /外婆|爷爷|奶奶|妈妈|爸爸|孩子|爱人|家人/, dimension: 'tenderness', strength: 0.34 },
  { pattern: /雨夜|下雨|雨里|夜晚|凌晨|月光|星空/, dimension: 'calm', strength: 0.2 },
]

const NEGATION_PATTERN = /并没有|并不|不是|不再|从未|从没|没有|未能|未曾|尚未|还未|别再|别去|别让|别想|不|没/g
const ADVERSE_EVENT_PATTERN = /失望|被拒绝|被否定|被否掉|落选|失败|被辞退|被解雇|落空/
const IRONY_PATTERN = /可真|真是太|呵呵|真够|太好了/
const PAST_RECOVERY_PATTERN = /(曾经|以前|那时|那时候|过去|去年|几年前|一度).{0,24}(不想活|想死|自杀).{0,36}(现在|后来|如今).{0,16}(安全|活下来|走出来|好起来|不再)/
const CRISIS_EXPRESSION_PATTERN = /不想继续活(?:着|下去)?|不想活(?:了|下去)?|想去死|想死(?:了)?|想自杀|活不下去|不如死|一了百了|结束自己|结束生命|活着.{0,5}(?:没意思|没有意义)/
const CRISIS_METHOD_PATTERN = /(?:想|要|准备|准备好|打算|计划|决定|会|就).{0,10}(?:去死|自杀|结束自己|结束生命|从.{0,5}跳下去|跳楼|割腕|吞药|喝药|上吊)/
const CRISIS_FAREWELL_PATTERN = /最后一天.{0,16}(?:告别所有人|跟所有人告别|遗言)/
const CRISIS_PROTECTIVE_PATTERN = /(?:我)?(?:决定|计划|已经|现在)?(?:不再|不会|不想|不愿意|不)(?:去死|死|自杀|结束自己|结束生命|跳楼|割腕|吞药|喝药|上吊)|(?:阻止|劝阻|救下|拦住).{0,8}(?:自杀|跳楼|割腕|吞药)/g
const CRISIS_CURRENT_MARKERS = ['现在', '此刻', '马上', '今天', '今晚']
const CRISIS_PAST_MARKERS = ['曾经', '以前', '过去', '那时', '去年', '几年前', '一度']
const CRISIS_THIRD_PARTY_MARKERS = ['他', '她', '有人', '新闻', '小说', '电影', '角色', '患者']
const TRAUMA_PATTERN = /被侵犯|性侵|强奸|猥亵|家暴|殴打|虐待|长期被打|暴力伤害|被骚扰/
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

export function hasAffirmedStoryTerm(story: string, terms: string[]) {
  return splitClauses(story).some((clause) => terms.some((term) => {
    let index = clause.text.indexOf(term)
    while (index >= 0) {
      if (!isNegated(clause.text, index)) return true
      index = clause.text.indexOf(term, index + term.length)
    }
    return false
  }))
}

function phraseIntensity(text: string, index: number) {
  const prefix = text.slice(Math.max(0, index - 5), index)
  if (INTENSIFIER_PATTERN.test(prefix)) return 1.28
  if (DOWNTONER_PATTERN.test(prefix)) return 0.78
  return 1
}

function isIronicPositive(clauses: StoryClause[], clause: StoryClause, rule: EmotionRule) {
  if (rule.valence <= 0.2 || !IRONY_PATTERN.test(clause.text)) return false
  const nearbyText = `${clause.text} ${clauses[clause.index + 1]?.text ?? ''}`
  return ADVERSE_EVENT_PATTERN.test(nearbyText)
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
          const negated = isNegated(clause.text, index)
          if (negated && rule.valence < 0) continue
          if (!negated && isIronicPositive(clauses, clause, rule)) continue
          occupied.push([index, end])
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

function buildEmotionDimensions(clauses: StoryClause[], hits: EmotionHit[]) {
  const raw = Object.fromEntries(DIMENSION_KEYS.map((key) => [key, 0])) as unknown as StoryEmotionDimensions
  hits.forEach((hit) => {
    Object.entries(hit.dimensions).forEach(([dimension, contribution]) => {
      raw[dimension as keyof StoryEmotionDimensions] += (contribution ?? 0) * hit.strength
    })
  })
  const semanticEvidence: string[] = []
  clauses.forEach((clause) => {
    SEMANTIC_DIMENSIONS.forEach(({ pattern, dimension, strength }) => {
      const matcher = new RegExp(pattern.source, 'g')
      let match = matcher.exec(clause.text)
      while (match) {
        if (!isNegated(clause.text, match.index)) {
          raw[dimension] += strength * clause.weight * 4
          semanticEvidence.push(match[0])
        }
        match = matcher.exec(clause.text)
      }
    })
  })
  const dimensions = Object.fromEntries(DIMENSION_KEYS.map((key) => [
    key,
    clamp(1 - Math.exp(-raw[key] / 4.4), 0, 1),
  ])) as unknown as StoryEmotionDimensions
  return { dimensions, semanticEvidence }
}

function lastMarkerIndex(text: string, markers: string[]) {
  return Math.max(...markers.map((marker) => text.lastIndexOf(marker)))
}

function isCurrentFirstPersonExpression(text: string, index: number, length: number) {
  const before = text.slice(Math.max(0, index - 36), index)
  const around = text.slice(Math.max(0, index - 24), Math.min(text.length, index + length + 18))
  const selfIndex = Math.max(before.lastIndexOf('我'), before.lastIndexOf('自己'))
  const thirdPartyIndex = lastMarkerIndex(before, CRISIS_THIRD_PARTY_MARKERS)
  const currentIndex = lastMarkerIndex(before, CRISIS_CURRENT_MARKERS)
  const pastIndex = lastMarkerIndex(before, CRISIS_PAST_MARKERS)
  const historicalContext = pastIndex > currentIndex
    && !/(但|可是|可我|却|然而|不过)/.test(before.slice(pastIndex))
  if (historicalContext) return false
  if (thirdPartyIndex >= 0 && thirdPartyIndex >= selfIndex) return false
  return selfIndex > thirdPartyIndex || currentIndex >= 0 || lastMarkerIndex(around, CRISIS_THIRD_PARTY_MARKERS) < 0
}

function containsCurrentCrisisExpression(story: string) {
  const crisisText = story
    .replace(/(?:我)?(?:不是|并非)不想(?:死|自杀|结束自己|结束生命|跳楼|割腕)/g, '我想死')
    .replace(PAST_RECOVERY_PATTERN, '')
    .replace(CRISIS_PROTECTIVE_PATTERN, '')
    .replace(/想死心|死了这条心/g, '')
  const patterns = [CRISIS_EXPRESSION_PATTERN, CRISIS_METHOD_PATTERN, CRISIS_FAREWELL_PATTERN]
  return patterns.some((pattern) => {
    const matcher = new RegExp(pattern.source, 'g')
    let match = matcher.exec(crisisText)
    while (match) {
      if (isCurrentFirstPersonExpression(crisisText, match.index, match[0].length)) return true
      match = matcher.exec(crisisText)
    }
    return false
  })
}

export function assessStorySafety(story: string): StorySafety {
  const normalized = story.trim().replace(/\s+/g, ' ')
  if (containsCurrentCrisisExpression(normalized)) return 'crisis'
  if (TRAUMA_PATTERN.test(normalized)) return 'sensitive'
  return 'standard'
}

function weightedValence(hits: EmotionHit[]) {
  const weight = hits.reduce((total, hit) => total + hit.strength, 0)
  if (!weight) return 0
  return hits.reduce((total, hit) => total + hit.valence * hit.strength, 0) / weight
}

function getNarrativeDirection(clauses: StoryClause[], hits: EmotionHit[]): NarrativeDirection {
  if (!clauses.length || !hits.length) return 'steady'
  const hitClauseIndexes = hits.map((hit) => hit.clauseIndex)
  const firstHitIndex = Math.min(...hitClauseIndexes)
  const lastHitIndex = Math.max(...hitClauseIndexes)
  const firstValence = weightedValence(hits.filter((hit) => hit.clauseIndex === firstHitIndex))
  const lastValence = weightedValence(hits.filter((hit) => hit.clauseIndex === lastHitIndex))
  const midpoint = Math.max(1, Math.ceil(clauses.length / 2))
  const earlyHits = hits.filter((hit) => hit.clauseIndex < midpoint)
  const lateHits = hits.filter((hit) => hit.clauseIndex >= midpoint)
  const earlyValence = weightedValence(earlyHits)
  const lateValence = weightedValence(lateHits)
  const positiveStrength = hits.filter((hit) => hit.valence > 0.2).reduce((total, hit) => total + hit.strength, 0)
  const negativeStrength = hits.filter((hit) => hit.valence < -0.2).reduce((total, hit) => total + hit.strength, 0)

  if (lastValence > 0.18 && lastValence - firstValence > 0.42) return 'rising'
  if (lastValence < -0.18 && firstValence - lastValence > 0.42) return 'falling'
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
    joyful: [108, 124],
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
  if (dimensions.nostalgia > 0.3) instruments.push('原声吉他', '柔音钢琴')
  if (dimensions.tension > 0.45) instruments.push('大提琴低音', '实录框鼓')
  if (dimensions.tenderness > 0.34) instruments.push('原声吉他', '柔和钢琴')
  if (dimensions.openness > 0.34) instruments.push('吉他泛音', '单簧管长音')
  if (dimensions.hope > 0.38 && (dimensions.grief <= 0.38 || dimensions.tension > 0.54)) instruments.push('钢琴', '轻打击乐')
  if (dimensions.calm > 0.4 && dimensions.grief < 0.34) instruments.push('单簧管', '原声吉他泛音')
  instruments.push(...mood.instruments)
  return { ...mood, tempo, key, scale, energy, warmth, instruments: [...new Set(instruments)].slice(0, 4) }
}

export function analyzeStoryEmotion(story: string) {
  const clauses = splitClauses(story)
  const hits = collectEmotionHits(clauses)
  const safety = assessStorySafety(story)
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
  const { dimensions, semanticEvidence } = buildEmotionDimensions(clauses, hits)
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
  const analysisBase = {
    valence,
    arousal,
    direction,
    confidence,
    sensitivity: safety === 'standard' ? 'standard' : 'sensitive',
    dimensions,
    evidence,
  } as const
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
  const found = STORY_IMAGES.filter((word) => hasAffirmedStoryTerm(story, [word]))
  const moodWords = mood.words.filter((word) => word.length > 1 && hasAffirmedStoryTerm(story, [word]))
  const unique = [...new Set([...found, ...moodWords])]
  return [...new Set([...unique, mood.label])].slice(0, 5)
}

function shortLine(text: string, max = 13) {
  const stripped = text.replace(/[，,。！？!?]/g, ' ')
  if (stripped.length <= max) return stripped
  return stripped.slice(0, max).trim()
}

function buildStoryExcerpt(story: string, keywords: string[], sensitivity: StoryEmotionAnalysis['sensitivity']) {
  if (sensitivity === 'sensitive') return '这是一段不容易说出口的经历。'
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

function getTheme(story: string, mood: MoodProfile, sensitivity: StoryEmotionAnalysis['sensitivity']) {
  if (sensitivity === 'sensitive') return '关于一段不容易说出的经历'
  const rules = [
    { words: ['妈妈', '爸爸', '外婆', '爷爷', '奶奶', '家人'], theme: '关于家与陪伴' },
    { words: ['生日', '蛋糕', '烛光', '庆祝'], theme: '关于庆祝与长大' },
    { words: ['爱人', '心动', '分手', '拥抱'], theme: '关于爱与错过' },
    { words: ['朋友', '同学'], theme: '关于同行与记得' },
    { words: ['故乡', '老家'], theme: '关于离开与归来' },
    { words: ['梦想', '工作', '辞职', '出发', '重新'], theme: '关于选择与成长' },
  ]
  return rules.find((rule) => hasAffirmedStoryTerm(story, rule.words))?.theme
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

function makeTitleCandidates(
  story: string,
  keywords: string[],
  sensitivity: StoryEmotionAnalysis['sensitivity'] = 'standard',
  moodId: MoodId = 'calm',
  direction: NarrativeDirection = 'steady',
) {
  if (sensitivity === 'sensitive') return ['未命名的那一页', '留在这里的一段话', '这一页没有名字']
  const includes = (...terms: string[]) => hasAffirmedStoryTerm(story, terms)
  const findTerm = (terms: string[]) => terms.find((term) => includes(term))
  const image = keywords.find((keyword) => STORY_IMAGES.includes(keyword) && keyword.length <= 3)
  const detail = keywords.find((keyword) => keyword !== image && STORY_IMAGES.includes(keyword) && keyword.length <= 3)
  const person = findTerm(['外婆', '爷爷', '奶奶', '妈妈', '爸爸', '孩子', '朋友', '爱人'])
  const place = findTerm(['院子', '车站', '站台', '城市', '故乡', '老家', '房间', '教室', '操场', '街道', '海边'])
  const object = findTerm(['蒲扇', '照片', '书信', '日记', '礼物', '蛋糕', '烛光', '咖啡'])
  const scene = findTerm(['夏夜', '星星', '月亮', '阳光', '雨', '雪', '风', '海面', '大海', '山', '灯光', '窗外', '明天', '远方'])
  const candidates: string[] = []

  if (includes('生日', '蛋糕', '烛光')) candidates.push('生日烛光熄灭前')
  if (includes('蒲扇')) candidates.push(story.includes('换我') ? '换我为你扇风' : '蒲扇里的夏夜')
  if (includes('站台') && includes('雨', '下雨')) candidates.push('雨停在站台')
  if (includes('火车') && includes('海', '天亮')) candidates.push('天亮时，海在等我')
  if (includes('火车', '列车') && includes('下一站', '晨光', '车窗')) candidates.push('晨光抵达下一站')
  if (includes('城市') && includes('轻松', '期待', '下一站')) candidates.push('城市退向身后')
  if (includes('窗', '窗外') && includes('灯', '灯光')) candidates.push('窗外最后一盏灯')
  if (includes('照片')) candidates.push('照片背面的那一天')
  if (includes('书信', '信')) candidates.push('一封刚拆开的信')
  if (includes('回家') && includes('外婆', '爷爷', '奶奶', '妈妈', '爸爸', '故乡', '老家', '多年', '去年')) candidates.push('回家以后风还记得')
  if (image && includes('告别', '再见', '离开')) candidates.push(`${image}没说完的再见`)
  if (image && includes('出发', '远方', '自由')) candidates.push(`越过${image}以后`)

  const contextualTitles: Record<MoodId, string[]> = {
    joyful: [
      ...(person ? [`和${person}大笑的那天`] : []),
      ...(place ? [`${place}装满了笑声`] : []),
      ...(object ? [`${object}旁边的笑声`] : []),
      ...(scene ? [`${scene}正好，笑声也在`] : []),
      '笑声落在阳光里',
      '快乐正好发生',
      '今天值得欢呼',
    ],
    hopeful: [
      ...(place ? [`从${place}走向天亮`] : []),
      ...(object ? [`带着${object}重新出发`] : []),
      ...(scene ? [`${scene}之后会有光`] : []),
      '明天从这里开始',
      '下一站会有光',
      '风吹向新的方向',
    ],
    melancholy: [
      ...(place ? [`留在${place}的那句话`] : []),
      ...(object ? [`${object}背后的沉默`] : []),
      ...(scene ? [`${scene}替我记得`] : []),
      '那句话停在夜里',
      '再见没有说完',
      '后来只剩回声',
    ],
    nostalgic: [
      ...(person ? [`${person}还在旧时光里`] : []),
      ...(place ? [`${place}还留着那阵风`] : []),
      ...(object ? [`${object}还记得那一天`] : []),
      ...(scene ? [`${scene}没有走远`] : []),
      '风记得那年夏天',
      '旧时光没有走远',
      '照片里的那阵风',
    ],
    tender: [
      ...(person ? [`把温柔留给${person}`] : []),
      ...(object ? [`${object}里的温柔`] : []),
      ...(scene ? [`轻轻把${scene}接住`] : []),
      '有人轻轻接住我',
      '把温柔留在这里',
      '这一刻被好好记住',
    ],
    calm: [
      ...(place ? [`${place}慢慢安静下来`] : []),
      ...(scene ? [`风停在${scene}旁边`] : []),
      '风经过安静的夜',
      '世界慢慢静下来',
      '此刻不必说话',
    ],
    tense: [
      ...(place ? [`${place}里的心跳声`] : []),
      ...(scene ? [`${scene}之前的心跳`] : []),
      '心跳跑在风暴前',
      '沉默开始发烫',
      '风暴还没有名字',
    ],
  }
  candidates.push(...contextualTitles[moodId])
  if (direction === 'rising') candidates.push('后来，微光抵达', '走到天亮那一边')
  if (direction === 'falling') candidates.push('后来，声音停在夜里')
  if (direction === 'bittersweet') candidates.push('一半温暖，一半告别')
  if (detail) candidates.push(`${detail}没有走远`)
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
  const excerpt = buildStoryExcerpt(normalizedStory, keywords, analysis.sensitivity)
  const { sections, hook } = buildLyrics(normalizedStory, mood, keywords, seed)
  const titleCandidates = makeTitleCandidates(normalizedStory, keywords, analysis.sensitivity, mood.id, analysis.direction)
  const base = {
    id: options.id ?? `${options.createdAt ?? Date.now()}-${seed}`,
    createdAt: options.createdAt ?? Date.now(),
    story: normalizedStory,
    title: options.title ?? titleCandidates[0],
    mood,
    secondaryMood,
    theme: getTheme(normalizedStory, mood, analysis.sensitivity),
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
  const candidates = makeTitleCandidates(
    result.story,
    result.keywords,
    result.analysis.sensitivity,
    result.mood.id,
    result.analysis.direction,
  )
  const currentIndex = Math.max(0, candidates.indexOf(result.title))
  return candidates[(currentIndex + offset) % candidates.length]
}
