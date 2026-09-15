# Music taste methodology

The product does not train on, transcribe, or copy commercial songs. Its music
taste layer is a transparent set of authored composition priors: for each mood,
the code describes desired density, syncopation, contour, range, sustain,
harmonic motion, brightness, tension, closure, and dynamic contrast.

Those priors are adjusted by the story's multi-dimensional emotion analysis.
The renderer then scores combinations of original scale-degree motifs, chord
progressions, development styles, acoustic arrangements, cadences, and texture
shapes. Every scored dimension maps to a parameter that changes the rendered
audio; raw story text is not used as a random ranking signal.

## Listening references

Human listening research may use scores from the
[Mutopia Project](https://www.mutopiaproject.org/), where every edition is
released as a free cultural work under Public Domain, CC BY, or CC BY-SA terms.
Individual source licenses must be checked and recorded before a score is used.
References are used to study broad techniques such as phrase direction,
cadence, register, rhythmic density, and dynamic shape, never to import a note
sequence into the product.

MTG-Jamendo, DEAM, EMOPIA, POP909, and other research-only or
non-commercial datasets are not production inputs. Their metadata, statistics,
audio, lyrics, identifiers, and note sequences are not included in the app.

## Product safeguards

- Candidate melodies come from short, original scale-degree grammars.
- Repetitive common interval fragments and excessive leaps receive a score penalty.
- Story semantics alter audible choices such as texture density, cadence, dynamics, timbre, and motif development.
- Equivalent semantic analysis produces the same plan, regardless of superficial wording changes.
- Human listening tests remain the final quality gate because musical taste cannot be reduced to a score.

## Adding future references

Only use material that clearly permits the intended commercial use. Record the
source URL, exact work or dataset version, license, attribution requirements,
and transformation method. Keep derived outputs reproducible, and keep source
audio, lyrics, and melodic sequences out of the runtime unless their license
and product need have been reviewed explicitly.
