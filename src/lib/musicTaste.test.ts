import { describe, expect, it } from 'vitest'
import { getCompositionPlan } from './audioEngine'
import { COMPOSITION_TASTE_PROFILES, getStoryTasteTarget } from './musicTaste'
import { generateSong } from './storyEngine'

describe('story-directed music taste layer', () => {
  it('preserves clear, audible contrasts between the composition priors', () => {
    expect(COMPOSITION_TASTE_PROFILES.joyful.density).toBeGreaterThan(COMPOSITION_TASTE_PROFILES.calm.density)
    expect(COMPOSITION_TASTE_PROFILES.joyful.brightness).toBeGreaterThan(COMPOSITION_TASTE_PROFILES.melancholy.brightness)
    expect(COMPOSITION_TASTE_PROFILES.tense.tension).toBeGreaterThan(COMPOSITION_TASTE_PROFILES.tender.tension)
    expect(COMPOSITION_TASTE_PROFILES.hopeful.closure).toBeGreaterThan(COMPOSITION_TASTE_PROFILES.melancholy.closure)
  })

  it('adapts the composition target to the actual story rather than treating a mood as static', () => {
    const quietJoy = generateSong('午后我收到一封温暖的信，心里很开心，也终于安静下来。')
    const exuberantJoy = generateSong('我们冲上舞台欢呼大笑，兴奋地跳起来庆祝胜利。')
    const quietTarget = getStoryTasteTarget('joyful', quietJoy.analysis)
    const exuberantTarget = getStoryTasteTarget('joyful', exuberantJoy.analysis)

    expect(exuberantTarget.density).toBeGreaterThan(quietTarget.density)
    expect(exuberantTarget.syncopation).toBeGreaterThan(quietTarget.syncopation)
    expect(quietTarget.sustain).toBeGreaterThan(exuberantTarget.sustain)
  })

  it.each([
    '今天收到录取通知，我和朋友冲到操场大笑，阳光特别亮，所有努力终于有了结果。',
    '妈妈在我加班回家时留了一盏灯，桌上还有一碗热汤，她轻轻陪着我。',
    '清晨我坐在窗边安静地喝咖啡，看风吹动树叶，整个房间都很平静。',
    '我们在雨里的站台告别，从那以后再也没有见过。',
    '门外的争吵越来越近，我握紧手机，害怕得心跳很快。',
    '我终于放下那段过去，准备去新的城市重新生活。',
  ])('selects a scored candidate for “%s”', (story) => {
    const plan = getCompositionPlan(generateSong(story))

    expect(plan.candidateCount).toBeGreaterThanOrEqual(72)
    expect(plan.qualityScore).toBeGreaterThanOrEqual(60)
    expect(['echo', 'answer', 'expansion']).toContain(plan.developmentStyle)
    expect(['intimate', 'flowing', 'driving']).toContain(plan.textureStyle)
  })

  it('changes audible arrangement choices when the same mood has different energy', () => {
    const base = generateSong('今天是值得庆祝的一天。')
    const quietJoy = {
      ...base,
      analysis: {
        ...base.analysis,
        arousal: 0.18,
        dimensions: { ...base.analysis.dimensions, joy: 0.62, calm: 0.82, tension: 0.02 },
      },
    }
    const exuberantJoy = {
      ...base,
      analysis: {
        ...base.analysis,
        arousal: 0.96,
        dimensions: { ...base.analysis.dimensions, joy: 0.96, calm: 0.02, tension: 0.08 },
      },
    }
    const quietPlan = getCompositionPlan(quietJoy)
    const exuberantPlan = getCompositionPlan(exuberantJoy)

    expect(exuberantPlan.arpeggioSteps).toBeGreaterThan(quietPlan.arpeggioSteps)
    expect(exuberantPlan.textureStyle).not.toBe(quietPlan.textureStyle)
    expect(exuberantPlan.dynamics.climax - exuberantPlan.dynamics.intro)
      .toBeGreaterThan(quietPlan.dynamics.climax - quietPlan.dynamics.intro)
  })

  it('does not let raw wording randomness change an otherwise identical plan', () => {
    const original = generateSong('收到好消息后，我终于笑了。')
    const paraphrase = { ...original, story: '完全不同的表面措辞，但复用同一份语义分析。', id: 'paraphrase' }
    const originalPlan = getCompositionPlan(original)
    const paraphrasePlan = getCompositionPlan(paraphrase)
    const signature = (plan: ReturnType<typeof getCompositionPlan>) => JSON.stringify({
      lead: plan.lead,
      harmony: plan.harmony,
      cadence: plan.cadence,
      progression: plan.progression,
      motifIndex: plan.motifIndex,
      developmentStyle: plan.developmentStyle,
      textureStyle: plan.textureStyle,
    })

    expect(signature(paraphrasePlan)).toBe(signature(originalPlan))
  })
})
