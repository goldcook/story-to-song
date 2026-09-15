import { describe, expect, it } from 'vitest'
import { fitMotifToChord, getArrangementTracks, getCompositionArc, getSongPreviewDuration } from './audioEngine'
import { assessStorySafety, generateSong, getAlternateTitle } from './storyEngine'

describe('story emotion and composition direction', () => {
  it.each([
    ['朋友离开了我，夏天结束以后再也没有见过', 'melancholy'],
    ['我笑着说没关系，其实心里很难过', 'melancholy'],
    ['没有希望，也再也回不去了', 'melancholy'],
    ['我们在雨里告别，从此没有见过', 'melancholy'],
    ['他们愤怒地争吵，我害怕地逃跑', 'tense'],
    ['下雨的夜晚很安静', 'calm'],
    ['虽然害怕，但终于重新出发', 'hopeful'],
  ])('maps “%s” to %s', (story, expectedMood) => {
    expect(generateSong(story).mood.id).toBe(expectedMood)
  })

  it('does not let bright scenery overpower loss', () => {
    const result = generateSong('阳光很好，朋友说要去旅行，可他离开了我，从此再也没有见过。')

    expect(result.mood.id).toBe('melancholy')
    expect(result.mood.scale).toBe('minor')
    expect(result.analysis.dimensions.grief).toBeGreaterThan(0.65)
    expect(result.analysis.dimensions.joy).toBeLessThan(0.2)
  })

  it('understands negation and emotional concealment', () => {
    const result = generateSong('我笑着说没关系，其实心里非常难过。')

    expect(result.mood.id).toBe('melancholy')
    expect(result.analysis.direction).toBe('falling')
    expect(result.analysis.valence).toBeLessThan(-0.6)
  })

  it('keeps fear, openness and agency as separate dimensions', () => {
    const result = generateSong('虽然害怕离开熟悉的城市，但第一次感到自由。天亮后，我决定重新出发。')

    expect(result.mood.id).toBe('hopeful')
    expect(result.analysis.direction).toBe('rising')
    expect(result.analysis.dimensions.tension).toBeGreaterThan(0.25)
    expect(result.analysis.dimensions.openness).toBeGreaterThan(0.35)
    expect(result.analysis.dimensions.agency).toBeGreaterThan(0.55)
    const trackLabels = getArrangementTracks(result).map((track) => track.label)
    expect(trackLabels.some((label) => label.includes('吉他'))).toBe(true)
    expect(trackLabels).toContain('开阔吉他泛音')
  })

  it('uses a minor, restrained palette for low-arousal grief', () => {
    const result = generateSong('很多年过去，我还是会想起那次告别。那句话没有说出口。')

    expect(result.mood.scale).toBe('minor')
    expect(result.mood.tempo).toBeLessThanOrEqual(66)
    expect(result.mood.instruments).toContain('柔音钢琴')
    expect(result.analysis.dimensions.grief).toBeGreaterThan(result.analysis.dimensions.tension)
  })

  it('treats relief as a hopeful resolution rather than sadness', () => {
    const result = generateSong('我已经不再害怕，也没那么难过了，终于放下过去重新出发。')

    expect(result.mood.id).toBe('hopeful')
    expect(result.analysis.dimensions.hope).toBeGreaterThan(result.analysis.dimensions.grief)
    expect(result.mood.scale).toBe('major')
  })

  it('does not confuse a tender family gesture with generic hope', () => {
    const result = generateSong('小时候的夏夜，外婆总带我坐在院子里乘凉。后来我去了很远的城市。去年回家，换我轻轻为她扇风。')

    expect(['tender', 'nostalgic']).toContain(result.mood.id)
    expect(result.analysis.dimensions.tenderness).toBeGreaterThan(0.5)
    expect(result.analysis.dimensions.nostalgia).toBeGreaterThan(0.3)
  })

  it.each([
    '我已经不再害怕了，终于可以重新往前走。',
    '现在已经没那么难过了，我开始期待明天。',
  ])('recognizes recovery language in “%s”', (story) => {
    const result = generateSong(story)

    expect(result.mood.id).toBe('hopeful')
    expect(result.analysis.dimensions.hope).toBeGreaterThan(result.analysis.dimensions.grief)
  })

  it('does not turn negated loneliness into an isolation layer', () => {
    const result = generateSong('我已经不再孤独，朋友一直陪着我。')

    expect(result.analysis.dimensions.isolation).toBeLessThan(0.12)
    expect(result.analysis.dimensions.tenderness).toBeGreaterThan(0.3)
    expect(getArrangementTracks(result).map((track) => track.id)).not.toContain('silence')
  })

  it('does not infer isolation when the story says someone is accompanied', () => {
    const result = generateSong('我不是一个人，家人都陪着我。')

    expect(result.analysis.dimensions.isolation).toBeLessThan(0.12)
    expect(result.analysis.dimensions.tenderness).toBeGreaterThan(0.3)
  })

  it('does not infer openness or agency from explicitly negated wishes', () => {
    const result = generateSong('我没有自由，也不想出发。')

    expect(result.analysis.dimensions.openness).toBeLessThan(0.12)
    expect(result.analysis.dimensions.agency).toBeLessThan(0.12)
  })

  it('treats dawn in a caregiving scene as tenderness rather than generic hope', () => {
    const result = generateSong('我整夜守着病床，直到天亮，只想让他睡得安稳。')

    expect(result.mood.id).toBe('tender')
    expect(result.analysis.dimensions.tenderness).toBeGreaterThan(result.analysis.dimensions.hope)
  })

  it('understands a mixed departure story as movement toward relief', () => {
    const result = generateSong('离开生活十年的城市，我很舍不得，也害怕新的生活，但列车开动时，晨光照进车窗，我突然有一点轻松，也开始期待下一站。')

    expect(['hopeful', 'nostalgic']).toContain(result.mood.id)
    expect(['rising', 'bittersweet']).toContain(result.analysis.direction)
    expect(result.analysis.dimensions.hope).toBeGreaterThan(0.35)
    expect(result.analysis.dimensions.openness).toBeGreaterThan(0.2)
    expect(result.analysis.dimensions.agency).toBeGreaterThan(0.35)
  })

  it('recognizes happy tears without mistaking them for sadness', () => {
    const result = generateSong('收到录取通知时，我开心才哭了。')

    expect(result.mood.id).toBe('joyful')
    expect(result.analysis.dimensions.joy).toBeGreaterThan(result.analysis.dimensions.grief)
  })

  it('gives clearly joyful stories a light, rhythmic arrangement', () => {
    const result = generateSong('毕业那天，我和朋友在操场开心地大笑，终于实现了期待很久的愿望。')
    const tracks = getArrangementTracks(result).map((track) => track.label)

    expect(result.mood.id).toBe('joyful')
    expect(result.mood.scale).toBe('major')
    expect(result.mood.tempo).toBeGreaterThanOrEqual(108)
    expect(tracks).toContain('实录原声吉他')
    expect(tracks).toContain('实录框鼓、木块与沙锤')
  })

  it.each([54, 62, 88, 112, 128])('builds a 20–30 second musical arc at %s BPM', (tempo) => {
    const arc = getCompositionArc(tempo, tempo >= 108)

    expect(getSongPreviewDuration(tempo)).toBeGreaterThanOrEqual(20)
    expect(getSongPreviewDuration(tempo)).toBeLessThanOrEqual(30)
    expect(arc[0]).toBe('intro')
    expect(arc.at(-1)).toBe('outro')
    expect(arc.indexOf('turn')).toBeGreaterThan(arc.indexOf('intro'))
    expect(arc.indexOf('turn')).toBeLessThan(arc.indexOf('climax'))
  })

  it('anchors strong melody beats to the active chord', () => {
    const fitted = fitMotifToChord([
      { at: 0, degree: 1, length: 0.5 },
      { at: 0.8, degree: 1, length: 0.4 },
      { at: 2.05, degree: 3, length: 0.6 },
      { at: 3.2, degree: 6, length: 0.5 },
    ], [0, 2, 4], 7)

    expect([0, 2, 4]).toContain(((fitted[0].degree % 7) + 7) % 7)
    expect([0, 2, 4]).toContain(((fitted[2].degree % 7) + 7) % 7)
    expect([0, 2, 4]).toContain(((fitted[3].degree % 7) + 7) % 7)
  })

  it('uses an acoustic clarinet voice instead of bell-like tones for calm stories', () => {
    const result = generateSong('夜里很安静，我坐在窗边慢慢看着月光，心里也渐渐平静下来。')
    const tracks = getArrangementTracks(result).map((track) => track.label)

    expect(result.mood.id).toBe('calm')
    expect(tracks).toContain('实录单簧管')
    expect(tracks.join('、')).not.toMatch(/木琴|钟声|电子|空气层/)
  })

  it('keeps alternate titles tied to the story instead of generic placeholders', () => {
    const result = generateSong('毕业那天，我和朋友在操场开心地大笑，终于实现了期待很久的愿望。')
    const titles = [result.title]
    for (let index = 0; index < 4; index += 1) {
      titles.push(getAlternateTitle({ ...result, title: titles.at(-1)! }, 1))
    }

    expect(new Set(titles).size).toBe(5)
    expect(titles.every((title) => /朋友|操场|笑|快乐|欢呼/.test(title))).toBe(true)
    expect(titles).not.toContain('平凡的一天值得记住')
  })

  it('does not take ironic happiness literally after rejection', () => {
    const result = generateSong('真是太开心了，又被拒绝了一次。')

    expect(result.mood.id).not.toBe('joyful')
    expect(result.analysis.valence).toBeLessThan(0)
  })

  it('lets disappointment survive a negated anger phrase', () => {
    const result = generateSong('我并不生气，只是彻底失望了。')

    expect(result.mood.id).toBe('melancholy')
    expect(result.analysis.dimensions.grief).toBeGreaterThan(result.analysis.dimensions.tension)
  })

  it('preserves grief while recognizing an active resolution', () => {
    const result = generateSong('他去世了，但我决定带着爱继续好好生活。')

    expect(['rising', 'bittersweet']).toContain(result.analysis.direction)
    expect(result.analysis.dimensions.grief).toBeGreaterThan(0.35)
    expect(result.analysis.dimensions.hope).toBeGreaterThan(0.35)
    expect(result.analysis.dimensions.agency).toBeGreaterThan(0.35)
  })

  it('separates immediate crisis language from historical recovery', () => {
    expect(assessStorySafety('我现在真的撑不住了，不想活了，已经准备结束生命。')).toBe('crisis')
    expect(assessStorySafety('我曾经想死，后来活下来，现在已经慢慢走出来了。')).toBe('standard')
    expect(assessStorySafety('我以前想死，后来走出来了，但现在又不想活了。')).toBe('crisis')
    expect(assessStorySafety('我不想死，我想好好活着。')).toBe('standard')
    expect(assessStorySafety('我终于对这件事死了这条心。')).toBe('standard')
  })

  it.each([
    '我准备去死，谁也别拦我。',
    '活着没意思，我打算吞药。',
    '我现在想从楼上跳下去。',
    '我今晚就去死。',
    '我想从楼上跳下去。',
    '我要割腕。',
    '我想结束自己。',
    '我不是不想死。',
    '我已经买好了药，不想继续活着。',
    '今天就是最后一天了，我想跟所有人告别。',
  ])('intercepts common immediate crisis phrasing in “%s”', (story) => {
    expect(assessStorySafety(story)).toBe('crisis')
  })

  it.each([
    '他已经自杀离世了，我一直很想念他。',
    '新闻里说有人准备自杀。',
    '小说里的角色决定跳楼。',
    '我决定不再自杀。',
    '我已经阻止他自杀。',
    '以前我想死，但那已经是过去的事了。',
  ])('does not intercept third-person, quoted or protective phrasing in “%s”', (story) => {
    expect(assessStorySafety(story)).toBe('standard')
  })

  it.each([
    '我决定不自杀。',
    '我计划不自杀。',
    '我不会割腕。',
    '我不想割腕。',
    '我决定不跳楼。',
  ])('does not intercept protective first-person phrasing in “%s”', (story) => {
    expect(assessStorySafety(story)).toBe('standard')
  })

  it.each([
    '以前我很快乐，但我想死。',
    '过去我从没这样过，可我想死。',
  ])('lets a new first-person crisis statement override earlier history in “%s”', (story) => {
    expect(assessStorySafety(story)).toBe('crisis')
  })

  it('protects trauma stories in their shareable packaging', () => {
    const result = generateSong('那段被家暴的经历，我很久都没有告诉任何人。')

    expect(result.analysis.sensitivity).toBe('sensitive')
    expect(['melancholy', 'tense']).toContain(result.mood.id)
    expect(result.theme).toBe('关于一段不容易说出的经历')
    expect(result.excerpt).toBe('这是一段不容易说出口的经历。')
    expect(['未命名的那一页', '留在这里的一段话', '这一页没有名字']).toContain(result.title)
  })

  it('keeps displayed celestial and restrained rhythm tracks consistent with the score', () => {
    const grief = generateSong('在月光下，我失去了最重要的人，再也见不到了。')
    const labels = getArrangementTracks(grief).map((track) => track.label)

    expect(labels).not.toContain('木琴星点')
    expect(labels).not.toContain('实录细沙锤')
  })

  it('keeps negated imagery out of titles, themes and scene tracks', () => {
    const result = generateSong('我没有自由，也不想出发。')

    expect(result.keywords).not.toEqual(expect.arrayContaining(['自由', '出发']))
    expect(result.title).not.toMatch(/自由|出发/)
    expect(result.theme).not.toBe('关于选择与成长')
    expect(getArrangementTracks(result).map((track) => track.id)).not.toContain('transit')
  })

  it.each([
    ['离开公司以后，我终于自由了。', 'hopeful'],
    ['不是因为难过，而是太开心才哭了。', 'joyful'],
    ['我恨他，也无法原谅那次背叛。', 'tense'],
    ['我不相信未来会好起来。', 'melancholy'],
  ])('handles adversarial phrasing in “%s”', (story, expectedMood) => {
    expect(generateSong(story).mood.id).toBe(expectedMood)
  })

  it.each([
    ['后来我开始认真吃饭，也愿意重新见朋友。', 'hopeful'],
    ['我没生气，只是忽然不再期待了。', 'melancholy'],
  ])('recognizes implicit emotional movement in “%s”', (story, expectedMood) => {
    expect(generateSong(story).mood.id).toBe(expectedMood)
  })
})
