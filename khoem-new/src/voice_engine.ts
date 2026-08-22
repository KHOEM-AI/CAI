/**
 * =========================================================
 * KHOEM_AI — VOICE ENGINE (Logic Architecture)
 * =========================================================
 *
 * PURPOSE
 * -------
 * Define 6 voice profiles across gender × age stage and
 * expose a single selectVoice(persona) function that maps
 * a conversation persona to concrete voice parameters.
 *
 * DESIGN PRINCIPLES
 * -----------------
 * • Provider-agnostic: the TTSProvider interface is the only
 *   coupling point to any real TTS service. Swap ElevenLabs,
 *   OpenAI, Coqui, or any other engine by implementing it.
 * • No network code here — this file contains pure logic.
 * • All 6 profiles are plain data — easy to tune or extend.
 *
 * VOICE GRID
 * ----------
 *             Child        Adult        Elder
 *   Male   │ male_child │ male_adult │ male_elder
 *   Female │ fem_child  │ fem_adult  │ fem_elder
 *
 * =========================================================
 */

// ── 1. Core parameter types ───────────────────────────────

/**
 * VoiceParameters are the values you send to any TTS API.
 * Each field is normalised to a 0–1 float so the mapping
 * from profile → API call is a simple numeric translation,
 * regardless of which provider you use.
 *
 *   pitch      — fundamental frequency of the voice
 *                0 = very low (bass/elder), 1 = very high (child)
 *
 *   stability  — how consistent the voice stays across sentences
 *                0 = highly expressive/variable, 1 = robotic/flat
 *                (ElevenLabs calls this "stability";
 *                 OpenAI models this as lower temperature)
 *
 *   style      — degree of stylisation / expressiveness
 *                0 = neutral, 1 = maximum character
 *
 *   tempo      — speaking rate relative to the baseline
 *                0.5 = half speed (very slow),
 *                1.0 = natural pace,
 *                1.5 = fast
 *
 *   tone       — affective quality of the voice
 *                Used as a hint to the TTS provider or as
 *                a system-prompt modifier for LLM-backed TTS.
 */
export interface VoiceParameters {
  pitch:     number; // 0.0 – 1.0
  stability: number; // 0.0 – 1.0
  style:     number; // 0.0 – 1.0
  tempo:     number; // 0.5 – 1.5 (1.0 = natural)
  tone:      "energetic" | "confident" | "deliberate" | "warm" | "light" | "raspy";
}

// ── 2. Voice profile definition ───────────────────────────

export type Gender   = "male" | "female";
export type AgeStage = "child" | "adult" | "elder";
export type ProfileId =
  | "male_child" | "male_adult" | "male_elder"
  | "fem_child"  | "fem_adult"  | "fem_elder";

export interface VoiceProfile {
  id:          ProfileId;
  gender:      Gender;
  ageStage:    AgeStage;
  label:       string;
  description: string;
  params:      VoiceParameters;
}

// ── 3. The 6 voice profiles ───────────────────────────────
//
// Tuning rationale for each profile:
//
//   Child  → pitch HIGH, stability LOW (children are expressive
//             and unpredictable), style HIGH, fast tempo
//
//   Adult  → pitch MID, stability HIGH (professional, controlled),
//             style LOW-MID, natural tempo
//
//   Elder  → pitch LOW, stability HIGH (measured, unhurried),
//             style LOW (character comes from slowness, not flair),
//             tempo SLOW

export const VOICE_PROFILES: Record<ProfileId, VoiceProfile> = {

  male_child: {
    id:          "male_child",
    gender:      "male",
    ageStage:    "child",
    label:       "Young Boy",
    description: "High-pitched, light, and energetic. Curious and playful. " +
                 "Best for learning moments, encouragement, simple explanations.",
    params: {
      pitch:     0.85,
      stability: 0.30,
      style:     0.70,
      tempo:     1.20,
      tone:      "energetic",
    },
  },

  male_adult: {
    id:          "male_adult",
    gender:      "male",
    ageStage:    "adult",
    label:       "Adult Man",
    description: "Full, resonant, and confident. The authoritative default voice. " +
                 "Best for analysis, instruction, and decision-making.",
    params: {
      pitch:     0.50,
      stability: 0.70,
      style:     0.30,
      tempo:     1.00,
      tone:      "confident",
    },
  },

  male_elder: {
    id:          "male_elder",
    gender:      "male",
    ageStage:    "elder",
    label:       "Elder Man",
    description: "Mature, heavy, and deliberate. Slightly raspy with measured pacing. " +
                 "Best for wisdom, counsel, deep analysis, philosophical reflection.",
    params: {
      pitch:     0.20,
      stability: 0.85,
      style:     0.15,
      tempo:     0.82,
      tone:      "raspy",
    },
  },

  fem_child: {
    id:          "fem_child",
    gender:      "female",
    ageStage:    "child",
    label:       "Young Girl",
    description: "Bright, airy, and playful. Warm and non-threatening. " +
                 "Best for onboarding, encouragement, child-focused content.",
    params: {
      pitch:     0.90,
      stability: 0.28,
      style:     0.72,
      tempo:     1.15,
      tone:      "light",
    },
  },

  fem_adult: {
    id:          "fem_adult",
    gender:      "female",
    ageStage:    "adult",
    label:       "Adult Woman",
    description: "Clear, warm, and approachable. Balances professionalism with empathy. " +
                 "Best for guidance, support, and customer-facing interactions.",
    params: {
      pitch:     0.55,
      stability: 0.65,
      style:     0.38,
      tempo:     1.00,
      tone:      "warm",
    },
  },

  fem_elder: {
    id:          "fem_elder",
    gender:      "female",
    ageStage:    "elder",
    label:       "Elder Woman",
    description: "Dignified, calm, deeply assured. The voice of a trusted mentor. " +
                 "Best for advisory roles, storytelling, and philosophical insight.",
    params: {
      pitch:     0.25,
      stability: 0.82,
      style:     0.18,
      tempo:     0.88,
      tone:      "deliberate",
    },
  },

};

// ── 4. Persona definitions ────────────────────────────────
//
// A "persona" is the role KHOEM_AI is playing in a given
// conversation.  It is the bridge between *what the AI is
// doing* (intent/context) and *how it should sound* (voice).

export type Persona =
  | "teacher"      // Instructs clearly — Adult Man
  | "advisor"      // Gives wise counsel — Elder Man
  | "mentor"       // Guides with warmth — Elder Woman
  | "companion"    // Friendly and warm — Adult Woman
  | "storyteller"  // Narrative and rich — Elder Woman
  | "guide"        // Onboarding / simple help — Adult Woman
  | "child_tutor"  // Works with young users — Young Girl
  | "playmate"     // Fun, energetic — Young Boy
  | "analyst"      // Deep, critical thinking — Elder Man
  | "assistant";   // Neutral default — Adult Woman

// ── 5. Persona → Profile mapping table ───────────────────
//
// Editing this table is the only change needed to reassign
// a persona to a different voice profile.

const PERSONA_MAP: Record<Persona, ProfileId> = {
  teacher:     "male_adult",
  advisor:     "male_elder",
  mentor:      "fem_elder",
  companion:   "fem_adult",
  storyteller: "fem_elder",
  guide:       "fem_adult",
  child_tutor: "fem_child",
  playmate:    "male_child",
  analyst:     "male_elder",
  assistant:   "fem_adult",   // default fallback
};

// ── 6. selectVoice — the primary public function ──────────

export interface VoiceSelection {
  persona:   Persona;
  profileId: ProfileId;
  profile:   VoiceProfile;
  params:    VoiceParameters;
}

/**
 * Map a conversation persona to a voice profile and its
 * ready-to-use parameters.
 *
 * @param persona  The role KHOEM_AI is currently playing.
 *                 If unknown or undefined, defaults to "assistant".
 *
 * @returns VoiceSelection — everything needed to call any TTS provider.
 *
 * @example
 *   const { params } = selectVoice("advisor");
 *   // params = { pitch: 0.20, stability: 0.85, style: 0.15,
 *   //            tempo: 0.82, tone: "raspy" }
 */
export function selectVoice(persona?: Persona | string): VoiceSelection {
  // Normalise: unknown personas fall back to "assistant"
  const resolvedPersona: Persona =
    persona && persona in PERSONA_MAP
      ? (persona as Persona)
      : "assistant";

  const profileId = PERSONA_MAP[resolvedPersona];
  const profile   = VOICE_PROFILES[profileId];

  return {
    persona:   resolvedPersona,
    profileId,
    profile,
    params:    profile.params,
  };
}

// ── 7. Generic TTS provider interface ────────────────────
//
// Implement this interface for any TTS backend.
// The voice engine calls provider.speak() and nothing else —
// it never imports or references a specific API.

export interface TTSRequest {
  text:   string;
  params: VoiceParameters;
  /** Human-readable label for logging (e.g. "Elder Woman") */
  label:  string;
}

export interface TTSResponse {
  /** Raw audio bytes (e.g. MP3, WAV, OGG) */
  audio:       Buffer;
  /** MIME type of the audio data */
  contentType: string;
  /** Provider that produced the audio */
  provider:    string;
}

export interface TTSProvider {
  /** A label for logging, e.g. "ElevenLabs" or "OpenAI TTS" */
  name: string;
  /**
   * Synthesise speech from text using the given voice parameters.
   * Translate VoiceParameters (0–1 floats) into whatever the
   * specific API expects.
   */
  speak(request: TTSRequest): Promise<TTSResponse>;
}

// ── 8. synthesise — wires selectVoice to any provider ────

/**
 * High-level convenience: select voice for a persona, then
 * call the provided TTS backend to produce audio.
 *
 * @param text     The text to speak.
 * @param persona  The KHOEM_AI persona for this utterance.
 * @param provider Any object implementing TTSProvider.
 *
 * @example
 *   // Swap in your real provider at the call site:
 *   const audio = await synthesise(
 *     "Wisdom is knowing what you do not know.",
 *     "advisor",
 *     myElevenLabsProvider,   // ← your implementation
 *   );
 */
export async function synthesise(
  text:     string,
  persona:  Persona | string | undefined,
  provider: TTSProvider,
): Promise<TTSResponse> {
  const selection = selectVoice(persona);
  return provider.speak({
    text,
    params: selection.params,
    label:  selection.profile.label,
  });
}

// ── 9. Utility helpers ────────────────────────────────────

/**
 * List every available persona and the profile it maps to.
 * Useful for building UI selectors or API catalogues.
 */
export function listPersonaMappings(): Array<{
  persona:   Persona;
  profileId: ProfileId;
  label:     string;
  gender:    Gender;
  ageStage:  AgeStage;
}> {
  return (Object.entries(PERSONA_MAP) as [Persona, ProfileId][]).map(
    ([persona, profileId]) => ({
      persona,
      profileId,
      label:    VOICE_PROFILES[profileId].label,
      gender:   VOICE_PROFILES[profileId].gender,
      ageStage: VOICE_PROFILES[profileId].ageStage,
    }),
  );
}

/**
 * Get all profiles for a given gender or age stage.
 *
 * @example
 *   filterProfiles({ ageStage: "elder" })
 *   // → [male_elder, fem_elder]
 */
export function filterProfiles(filter: {
  gender?:   Gender;
  ageStage?: AgeStage;
}): VoiceProfile[] {
  return Object.values(VOICE_PROFILES).filter(
    (p) =>
      (!filter.gender   || p.gender   === filter.gender) &&
      (!filter.ageStage || p.ageStage === filter.ageStage),
  );
}
