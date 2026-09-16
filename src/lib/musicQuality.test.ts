import { describe, expect, it } from 'vitest'
import prototypes from '../../research/emotion-prototypes.json'
import type { MoodId } from '../types'
import {
  evaluateCompositionPlanMelody,
  evaluateMotifQuality,
  fingerprintMotif,
  getCompositionPlan,
  type MotifNote,
} from './audioEngine'
import {
  COMPOSITION_TASTE_PROFILES,
  getStoryTasteTarget,
  scoreTasteFit,
  tasteVectorDistance,
} from './musicTaste'
import { generateSong } from './storyEngine'

const MOODS: MoodId[] = ['joyful', 'melancholy', 'hopeful', 'tense', 'tender', 'calm', 'nostalgic']

describe('candidate novelty and musical quality', () => {
  it('uses transposition-invariant interval and rhythm fingerprints', () => {
    const motif: MotifNote[] = [
      { at: 0, degree: 0, length: 0.5 },
      { at: 0.75, degree: 2, length: 0.5 },
      { at: 1.5, degree: 4, length: 0.75 },
      { at: 2.75, degree: 3, length: 0.5 },
    ]
    const transposed = motif.map((note) => ({ ...note, degree: note.degree + 7 }))

    expect(fingerprintMotif(transposed, 'major')).toEqual(fingerprintMotif(motif, 'major'))
  })

  it('rejects broken or excessively leaping melodies and penalizes clichés', () => {
    const invalidOrder: MotifNote[] = [
      { at: 0, degree: 0, length: 0.5 },
      { at: 1, degree: 2, length: 0.5 },
      { at: 0.75, degree: 4, length: 0.5 },
    ]
    const excessiveLeaps: MotifNote[] = [
      { at: 0, degree: 0, length: 0.4 },
      { at: 0.7, degree: 9, length: 0.4 },
      { at: 1.4, degree: -8, length: 0.4 },
      { at: 2.1, degree: 10, length: 0.4 },
    ]
    const cliche: MotifNote[] = [
      { at: 0, degree: 0, length: 0.5 },
      { at: 1, degree: 1, length: 0.5 },
      { at: 2, degree: 2, length: 0.5 },
      { at: 3, degree: 3, length: 0.5 },
    ]
    const shaped: MotifNote[] = [
      { at: 0, degree: 0, length: 0.35 },
      { at: 0.55, degree: 2, length: 0.7 },
      { at: 1.6, degree: 1, length: 0.45 },
      { at: 2.4, degree: 4, length: 0.85 },
    ]

    expect(evaluateMotifQuality(invalidOrder, 'major')).toMatchObject({ hardPass: false })
    expect(evaluateMotifQuality(excessiveLeaps, 'minor')).toMatchObject({ hardPass: false })
    expect(evaluateMotifQuality(cliche, 'major').structuralScore)
      .toBeLessThan(evaluateMotifQuality(shaped, 'major').structuralScore)
  })

  it('rejects a motif when most of its normalized windows overlap a reference set', () => {
    const motif: MotifNote[] = [
      { at: 0, degree: 0, length: 0.4 },
      { at: 0.7, degree: 2, length: 0.55 },
      { at: 1.6, degree: 1, length: 0.45 },
      { at: 2.45, degree: 4, length: 0.8 },
    ]
    const fingerprints = fingerprintMotif(motif, 'major')
    const evaluation = evaluateMotifQuality(motif, 'major', new Set(fingerprints))

    expect(evaluation).toMatchObject({ hardPass: false, noveltyScore: 0, referenceOverlap: 1 })
    expect(evaluation.reasons).toContain('reference-overlap')
  })

  it('selects a structurally valid and novel candidate for every emotion', () => {
    const plans = prototypes.prototypes.map((prototype) => {
      const result = generateSong(prototype.story)
      const plan = getCompositionPlan(result)
      expect(plan.mood, prototype.id).toBe(prototype.mood)
      expect(plan.candidateCount).toBeGreaterThan(0)
      expect(plan.eligibleCandidateCount).toBeGreaterThan(0)
      expect(plan.qualityScore).toBeGreaterThanOrEqual(70)
      expect(plan.tasteFitScore).toBeGreaterThanOrEqual(70)
      expect(plan.structuralScore).toBeGreaterThanOrEqual(60)
      expect(plan.noveltyScore).toBeGreaterThanOrEqual(50)
      return plan
    })

    expect(plans.some((plan) => plan.rejectedCandidateCount > 0)).toBe(true)
    expect(plans.some((plan) => (plan.rejectionReasons['excessive-leaps'] ?? 0) > 0)).toBe(true)
    expect(new Set(plans.map((plan) => plan.noveltyScore)).size).toBeGreaterThan(1)
    expect(plans.some((plan) => plan.noveltyScore < 100)).toBe(true)
  })

  it('keeps every selected 21-story lead plan inside the playback quality gate', () => {
    prototypes.prototypes.forEach((prototype) => {
      const result = generateSong(prototype.story)
      const plan = getCompositionPlan(result)
      const evaluation = evaluateCompositionPlanMelody(result)

      expect(evaluation.phraseCount, prototype.id).toBe(plan.arc.length)
      expect(evaluation.hardPass, `${prototype.id}: ${evaluation.reasons.join(', ')}`).toBe(true)
      expect(evaluation.reasons, prototype.id).not.toContain('excessive-range')
      expect(evaluation.reasons, prototype.id).not.toContain('excessive-leaps')
    })
  })
})

describe('seven-emotion validation matrix', () => {
  it('classifies each canonical story and taste target into its intended top-1 emotion', () => {
    prototypes.prototypes.filter((prototype) => prototype.variant === 'canonical').forEach((prototype) => {
      const result = generateSong(prototype.story)
      const expectedMood = prototype.mood as MoodId
      const target = getStoryTasteTarget(expectedMood, result.analysis)
      const ranked = MOODS
        .map((mood) => ({ mood, score: scoreTasteFit(COMPOSITION_TASTE_PROFILES[mood], target) }))
        .sort((left, right) => right.score - left.score)

      expect(result.mood.id).toBe(expectedMood)
      expect(ranked[0].mood).toBe(expectedMood)
    })
  })

  it('keeps selected audible plans separated across all emotion pairs', () => {
    const plans = prototypes.prototypes.filter((prototype) => prototype.variant === 'canonical').map((prototype) => ({
      mood: prototype.mood,
      plan: getCompositionPlan(generateSong(prototype.story)),
    }))
    const minimumDistance = 0.045

    plans.forEach((left, leftIndex) => {
      plans.slice(leftIndex + 1).forEach((right) => {
        expect(
          tasteVectorDistance(left.plan.tasteVector, right.plan.tasteVector),
          `${left.mood} and ${right.mood} should not collapse into the same audible plan`,
        ).toBeGreaterThan(minimumDistance)
      })
    })
  })

  it('keeps meaningful within-emotion variation across energy and mixed-story variants', () => {
    MOODS.forEach((mood) => {
      const variants = prototypes.prototypes
        .filter((prototype) => prototype.mood === mood)
        .map((prototype) => {
          const result = generateSong(prototype.story)
          return { tempo: result.mood.tempo, plan: getCompositionPlan(result) }
        })
      const distances = variants.slice(1).map((variant) => (
        tasteVectorDistance(variants[0].plan.tasteVector, variant.plan.tasteVector)
          + Math.abs(variants[0].tempo - variant.tempo) / 100
      ))

      expect(Math.max(...distances), `${mood} variants should not all collapse`).toBeGreaterThan(0.01)
    })
  })

  it('preserves high-arousal bittersweet tension instead of averaging it into mild sadness', () => {
    const quietStory = prototypes.prototypes.find((prototype) => prototype.id === 'quiet-good-news')!
    const mixedStory = prototypes.prototypes.find((prototype) => prototype.id === 'nervous-award-release')!
    const quietResult = generateSong(quietStory.story)
    const mixedResult = generateSong(mixedStory.story)
    const quietTarget = getStoryTasteTarget(quietResult.mood.id, quietResult.analysis)
    const mixedTarget = getStoryTasteTarget(mixedResult.mood.id, mixedResult.analysis)

    expect([quietResult.mood.id, mixedResult.mood.id]).toEqual(['joyful', 'joyful'])
    expect(mixedTarget.syncopation).toBeGreaterThan(quietTarget.syncopation)
    expect(mixedTarget.tension).toBeGreaterThan(quietTarget.tension)
    expect(mixedTarget.closure).toBeLessThan(quietTarget.closure)
  })
})
