import { describe, expect, it } from 'vitest'
import { getArrangementTracks } from './audioEngine'
import { generateSong } from './storyEngine'

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
    expect(getArrangementTracks(result).map((track) => track.label)).toEqual(expect.arrayContaining([
      '大提琴弓弦层',
      '开阔吉他泛音',
    ]))
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
})
