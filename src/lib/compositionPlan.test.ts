import { describe, expect, it } from 'vitest'
import { getArrangementTracks, getCompositionPlan } from './audioEngine'
import { generateSong } from './storyEngine'

const SCENARIOS = [
  ['庆祝', '今天收到录取通知，我和朋友冲到操场大笑，阳光特别亮，所有努力终于有了结果。', 'joyful'],
  ['童趣', '周末带孩子去海边追浪花，他一边跑一边开心地大笑，把鞋子都甩在了沙滩上。', 'joyful'],
  ['温柔', '妈妈在我加班回家时留了一盏灯，桌上还有一碗热汤，她轻轻陪着我，什么也没问。', 'tender'],
  ['平静', '清晨我坐在窗边安静地喝咖啡，看风吹动树叶，整个房间都很平静。', 'calm'],
  ['怀念', '翻到旧照片，我又想起小时候和外婆在院子里乘凉的夏夜。', 'nostalgic'],
  ['悲伤', '我们在雨里的站台告别，从那以后再也没有见过。', 'melancholy'],
  ['紧张', '门外的争吵越来越近，我握紧手机，害怕得心跳很快，几乎喘不过气。', 'tense'],
  ['释然', '我终于放下那段过去，收拾好行李，准备去新的城市重新生活。', 'hopeful'],
] as const

describe('emotion-specific composition plans', () => {
  it.each(SCENARIOS)('maps the %s scenario to a distinct musical direction', (_label, story, expectedMood) => {
    expect(generateSong(story).mood.id).toBe(expectedMood)
  })

  it('uses genuinely different musical grammars across emotional categories', () => {
    const signatures = SCENARIOS.map(([, story]) => {
      const plan = getCompositionPlan(generateSong(story))
      return [
        plan.mood,
        plan.lead,
        plan.harmony,
        plan.bass,
        plan.percussion,
        plan.motifFamily,
        plan.cadence,
        plan.arpeggioSteps,
        plan.reverbLevel,
        plan.arc.join('-'),
      ].join('|')
    })

    expect(new Set(signatures).size).toBeGreaterThanOrEqual(7)
  })

  it('keeps bright joy out of the wistful cello-and-reverb palette', () => {
    const joyful = generateSong(SCENARIOS[0][1])
    const grief = generateSong(SCENARIOS[5][1])
    const joyfulPlan = getCompositionPlan(joyful)
    const griefPlan = getCompositionPlan(grief)
    const joyfulTracks = getArrangementTracks(joyful).map((track) => track.label).join('、')

    expect(joyfulPlan.motifFamily).toBe('buoyant')
    expect(joyfulPlan.cadence).toBe('lifted')
    expect(joyfulPlan.bass).toBe('none')
    expect(joyfulPlan.arpeggioSteps).toBeGreaterThan(griefPlan.arpeggioSteps)
    expect(joyfulPlan.reverbLevel).toBeLessThan(griefPlan.reverbLevel)
    expect(joyfulPlan.dynamics.outro).toBeGreaterThan(griefPlan.dynamics.outro)
    expect(joyfulTracks).not.toMatch(/大提琴|弓弦/)
  })

  it('gives grief, tension, calm and tenderness different endings and pulse languages', () => {
    const grief = getCompositionPlan(generateSong(SCENARIOS[5][1]))
    const tension = getCompositionPlan(generateSong(SCENARIOS[6][1]))
    const calm = getCompositionPlan(generateSong(SCENARIOS[3][1]))
    const tender = getCompositionPlan(generateSong(SCENARIOS[2][1]))

    expect(grief).toMatchObject({ motifFamily: 'descending', cadence: 'unresolved', harmony: 'cello', bass: 'cello' })
    expect(tension).toMatchObject({ motifFamily: 'restless', cadence: 'suspended', percussion: 'restless' })
    expect(calm).toMatchObject({ motifFamily: 'spacious', cadence: 'resting', lead: 'clarinet', bass: 'none' })
    expect(tender).toMatchObject({ motifFamily: 'gentle', cadence: 'warm', harmony: 'piano', bass: 'none' })
  })
})
