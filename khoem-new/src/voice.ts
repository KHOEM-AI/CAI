/**
 * =========================================================
 * PILLAR 4 — VOICE SYNTHESIS ENGINE
 * Multi-Persona Voice Synthesis for KHOEM_AI
 *
 * Supports 6 distinct voice profiles based on gender × age:
 *
 *   Gender  │  Age Stage  │  Profile ID
 *   ────────┼─────────────┼─────────────────
 *   Male    │  Child      │  male_child
 *   Male    │  Adult      │  male_adult
 *   Male    │  Elder      │  male_elder
 *   Female  │  Child      │  female_child
 *   Female  │  Adult      │  female_adult
 *   Female  │  Elder      │  female_elder
 *
 * The engine does two things:
 *   1. selectVoiceProfile() — picks the right profile given a
 *      persona or Brain Engine intent/complexity signal.
 *   2. buildTTSParams() — maps the profile to ready-to-send
 *      API parameters for ElevenLabs or OpenAI TTS.
 *
 * To activate real audio: set ELEVENLABS_API_KEY or
 * OPENAI_API_KEY in your environment.
 * =========================================================
 */

import { logger } from "../lib/logger.js";
import type { Complexity } from "./brain.js";

// ── Voice profile types ───────────────────────────────────

export type Gender = "male" | "female";
export type AgeStage = "child" | "adult" | "elder";
export type ProfileId =
  | "male_child"
  | "male_adult"
  | "male_elder"
  | "female_child"
  | "female_adult"
  | "female_elder";

export type ConversationPersona =
  | "teacher"      // → adult
  | "advisor"      // → elder
  | "companion"    // → adult (warm)
  | "storyteller"  // → elder (female)
  | "assistant"    // → adult (default)
  | "child_guide"; // → child

/**
 * Acoustic characteristics — documented so designers know
 * what each profile should *feel* like.
 */
export interface VoiceCharacteristics {
  pitch: "very_high" | "high" | "medium" | "low" | "very_low";
  tempo: "fast" | "slightly_fast" | "normal" | "slightly_slow" | "slow";
  energy: "light" | "energetic" | "confident" | "warm" | "deliberate" | "raspy";
  description: string;
}

export interface VoiceProfile {
  id: ProfileId;
  gender: Gender;
  ageStage: AgeStage;
  displayName: string;
  characteristics: VoiceCharacteristics;
  /** Best-suited conversation personas for this voice */
  suggestedPersonas: ConversationPersona[];
  /**
   * ElevenLabs voice configuration.
   * voice_id values are illustrative — replace with real
   * ElevenLabs voice IDs from your account.
   * stability: 0–1 (higher = more consistent, less expressive)
   * similarity_boost: 0–1 (higher = closer to original voice)
   * style: 0–1 (higher = more stylised/exaggerated)
   * use_speaker_boost: true = enhanced clarity
   */
  elevenLabs: {
    voice_id: string;
    stability: number;
    similarity_boost: number;
    style: number;
    use_speaker_boost: boolean;
  };
  /**
   * OpenAI TTS voice configuration.
   * voice: one of alloy | echo | fable | onyx | nova | shimmer
   * speed: 0.25–4.0
   */
  openAI: {
    voice: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";
    speed: number;
  };
}

// ── The 6 voice profiles ──────────────────────────────────

export const VOICE_PROFILES: Record<ProfileId, VoiceProfile> = {
  // ── Male profiles ──────────────────────────────────────

  male_child: {
    id: "male_child",
    gender: "male",
    ageStage: "child",
    displayName: "Young Boy",
    characteristics: {
      pitch: "very_high",
      tempo: "fast",
      energy: "energetic",
      description:
        "High-pitched, light, and energetic. Conveys excitement, curiosity, and playfulness. " +
        "Best for simple explanations, learning moments, or encouraging tones.",
    },
    suggestedPersonas: ["child_guide", "companion"],
    elevenLabs: {
      voice_id: "ElevenLabs_male_child_placeholder",
      stability: 0.35,
      similarity_boost: 0.75,
      style: 0.6,
      use_speaker_boost: true,
    },
    openAI: { voice: "echo", speed: 1.2 },
  },

  male_adult: {
    id: "male_adult",
    gender: "male",
    ageStage: "adult",
    displayName: "Adult Man",
    characteristics: {
      pitch: "medium",
      tempo: "normal",
      energy: "confident",
      description:
        "Full, resonant, and confident. The authoritative default voice — clear, stable, " +
        "and professional. Best for analysis, instruction, and decision-making contexts.",
    },
    suggestedPersonas: ["teacher", "assistant"],
    elevenLabs: {
      voice_id: "ElevenLabs_male_adult_placeholder",
      stability: 0.65,
      similarity_boost: 0.82,
      style: 0.3,
      use_speaker_boost: false,
    },
    openAI: { voice: "onyx", speed: 1.0 },
  },

  male_elder: {
    id: "male_elder",
    gender: "male",
    ageStage: "elder",
    displayName: "Elder Man",
    characteristics: {
      pitch: "low",
      tempo: "slow",
      energy: "deliberate",
      description:
        "Mature, heavy, and deliberate — carries the weight of experience. " +
        "Slightly raspy with measured pacing. Best for wisdom, counsel, deep analysis, " +
        "and philosophical reflection.",
    },
    suggestedPersonas: ["advisor", "storyteller"],
    elevenLabs: {
      voice_id: "ElevenLabs_male_elder_placeholder",
      stability: 0.80,
      similarity_boost: 0.70,
      style: 0.15,
      use_speaker_boost: false,
    },
    openAI: { voice: "fable", speed: 0.85 },
  },

  // ── Female profiles ────────────────────────────────────

  female_child: {
    id: "female_child",
    gender: "female",
    ageStage: "child",
    displayName: "Young Girl",
    characteristics: {
      pitch: "very_high",
      tempo: "slightly_fast",
      energy: "light",
      description:
        "Bright, airy, and playful with a very high pitch. Warm and non-threatening. " +
        "Best for onboarding, encouragement, and child-focused educational content.",
    },
    suggestedPersonas: ["child_guide", "companion"],
    elevenLabs: {
      voice_id: "ElevenLabs_female_child_placeholder",
      stability: 0.30,
      similarity_boost: 0.78,
      style: 0.65,
      use_speaker_boost: true,
    },
    openAI: { voice: "shimmer", speed: 1.15 },
  },

  female_adult: {
    id: "female_adult",
    gender: "female",
    ageStage: "adult",
    displayName: "Adult Woman",
    characteristics: {
      pitch: "medium",
      tempo: "normal",
      energy: "warm",
      description:
        "Clear, warm, and approachable. Balances professionalism with empathy. " +
        "Best for customer-facing interactions, guidance, and supportive instruction.",
    },
    suggestedPersonas: ["teacher", "assistant", "companion"],
    elevenLabs: {
      voice_id: "ElevenLabs_female_adult_placeholder",
      stability: 0.60,
      similarity_boost: 0.80,
      style: 0.35,
      use_speaker_boost: false,
    },
    openAI: { voice: "nova", speed: 1.0 },
  },

  female_elder: {
    id: "female_elder",
    gender: "female",
    ageStage: "elder",
    displayName: "Elder Woman",
    characteristics: {
      pitch: "low",
      tempo: "slightly_slow",
      energy: "deliberate",
      description:
        "Dignified, calm, and deeply assured. Carries gravitas without severity — " +
        "the voice of a trusted mentor. Best for advisory roles, storytelling, and " +
        "delivering wisdom or philosophical insight.",
    },
    suggestedPersonas: ["advisor", "storyteller"],
    elevenLabs: {
      voice_id: "ElevenLabs_female_elder_placeholder",
      stability: 0.78,
      similarity_boost: 0.72,
      style: 0.18,
      use_speaker_boost: false,
    },
    openAI: { voice: "alloy", speed: 0.90 },
  },
};

// ── Persona → profile mapping ─────────────────────────────

const PERSONA_TO_PROFILE: Record<ConversationPersona, ProfileId> = {
  teacher:     "male_adult",
  advisor:     "male_elder",
  companion:   "female_adult",
  storyteller: "female_elder",
  assistant:   "female_adult",
  child_guide: "female_child",
};

// ── Intent → auto-persona mapping ─────────────────────────
// When no explicit persona is set, the Brain Engine's intent
// and complexity drive the voice selection automatically.

const INTENT_TO_PERSONA: Record<string, ConversationPersona> = {
  "analysis":            "advisor",     // elder wisdom for deep analysis
  "planning":            "teacher",     // adult authority for planning
  "troubleshooting":     "teacher",     // clear adult voice for debugging
  "content-generation":  "companion",   // warm female for creative tasks
  "task-execution":      "assistant",   // default assistant voice
  "information-retrieval": "assistant", // neutral assistant for facts
  "general-inquiry":     "companion",   // friendly companion for open questions
};

// ── Public API ────────────────────────────────────────────

export interface VoiceSelectionResult {
  profileId: ProfileId;
  profile: VoiceProfile;
  selectedBy: "explicit_persona" | "brain_intent" | "complexity_fallback" | "default";
  persona: ConversationPersona;
}

/**
 * Select the right voice profile for a given conversation context.
 *
 * Priority order:
 *   1. Explicit persona override (user/session set a persona directly)
 *   2. Brain Engine intent signal
 *   3. Complexity-based fallback (critical → elder, low → companion)
 *   4. Default: female_adult
 *
 * @param intent     Brain Engine intent (from ReasoningResult)
 * @param complexity Brain Engine complexity (from ReasoningResult)
 * @param persona    Optional explicit persona override
 */
export function selectVoiceProfile(
  intent: string,
  complexity: Complexity,
  persona?: ConversationPersona,
): VoiceSelectionResult {
  // 1 — Explicit persona
  if (persona && PERSONA_TO_PROFILE[persona]) {
    const profileId = PERSONA_TO_PROFILE[persona];
    logger.debug({ persona, profileId }, "[VoiceEngine] Explicit persona selected");
    return {
      profileId,
      profile: VOICE_PROFILES[profileId],
      selectedBy: "explicit_persona",
      persona,
    };
  }

  // 2 — Brain intent mapping
  const intentPersona = INTENT_TO_PERSONA[intent];
  if (intentPersona) {
    const profileId = PERSONA_TO_PROFILE[intentPersona];
    logger.debug({ intent, intentPersona, profileId }, "[VoiceEngine] Intent-based selection");
    return {
      profileId,
      profile: VOICE_PROFILES[profileId],
      selectedBy: "brain_intent",
      persona: intentPersona,
    };
  }

  // 3 — Complexity fallback
  const complexityMap: Record<Complexity, ConversationPersona> = {
    critical: "advisor",   // elder gravitas for critical decisions
    high:     "teacher",   // authoritative adult for complex tasks
    medium:   "assistant", // neutral assistant for medium tasks
    low:      "companion", // friendly companion for simple queries
  };
  const complexityPersona = complexityMap[complexity];
  const profileId = PERSONA_TO_PROFILE[complexityPersona];
  logger.debug({ complexity, complexityPersona, profileId }, "[VoiceEngine] Complexity fallback");
  return {
    profileId,
    profile: VOICE_PROFILES[profileId],
    selectedBy: "complexity_fallback",
    persona: complexityPersona,
  };
}

export type TTSProvider = "elevenlabs" | "openai";

export interface TTSParams {
  provider: TTSProvider;
  profileId: ProfileId;
  text: string;
  /** Ready-to-send body for the chosen provider's API */
  apiBody: Record<string, unknown>;
  /** Full API endpoint URL */
  endpoint: string;
  /** Required Authorization header value */
  authHeader: string;
  /** Whether a real API key is configured */
  ready: boolean;
  /** Human-readable note when not ready */
  note?: string;
}

/**
 * Build ready-to-send TTS API parameters for a given voice profile.
 *
 * Detects which provider is configured from environment variables:
 *   ELEVENLABS_API_KEY → ElevenLabs (preferred)
 *   OPENAI_API_KEY     → OpenAI TTS (fallback)
 *
 * If neither key is set, returns `ready: false` with a note —
 * the rest of KHOEM_AI continues to work without audio.
 *
 * @param profileId  Voice profile to use
 * @param text       Text to synthesise
 * @param provider   Force a specific provider (optional)
 */
export function buildTTSParams(
  profileId: ProfileId,
  text: string,
  provider?: TTSProvider,
): TTSParams {
  const profile = VOICE_PROFILES[profileId];
  const elevenLabsKey = process.env["ELEVENLABS_API_KEY"];
  const openAIKey = process.env["OPENAI_API_KEY"];

  // Resolve provider
  const resolvedProvider: TTSProvider =
    provider ??
    (elevenLabsKey ? "elevenlabs" : openAIKey ? "openai" : "elevenlabs");

  if (resolvedProvider === "elevenlabs") {
    return {
      provider: "elevenlabs",
      profileId,
      text,
      apiBody: {
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability:        profile.elevenLabs.stability,
          similarity_boost: profile.elevenLabs.similarity_boost,
          style:            profile.elevenLabs.style,
          use_speaker_boost: profile.elevenLabs.use_speaker_boost,
        },
      },
      endpoint: `https://api.elevenlabs.io/v1/text-to-speech/${profile.elevenLabs.voice_id}`,
      authHeader: elevenLabsKey ? `xi-api-key: ${elevenLabsKey}` : "",
      ready: !!elevenLabsKey,
      note: elevenLabsKey
        ? undefined
        : "Set ELEVENLABS_API_KEY environment variable to enable real audio synthesis.",
    };
  }

  // OpenAI TTS
  return {
    provider: "openai",
    profileId,
    text,
    apiBody: {
      model: "tts-1-hd",
      input: text,
      voice: profile.openAI.voice,
      speed: profile.openAI.speed,
      response_format: "mp3",
    },
    endpoint: "https://api.openai.com/v1/audio/speech",
    authHeader: openAIKey ? `Bearer ${openAIKey}` : "",
    ready: !!openAIKey,
    note: openAIKey
      ? undefined
      : "Set OPENAI_API_KEY environment variable to enable real audio synthesis.",
  };
}

/**
 * List all 6 profiles — used by the catalogue endpoint.
 */
export function listVoiceProfiles(): VoiceProfile[] {
  return Object.values(VOICE_PROFILES);
}

/**
 * =========================================================
 * KHOEM_AI — Voice Engine Routes
 *
 * POST /api/khoem/voice/select
 *   Auto-select a voice profile from Brain Engine signals
 *   (intent + complexity) or an explicit persona override.
 *   Returns profile details + ready-to-send TTS params.
 *
 * POST /api/khoem/voice/synthesise
 *   Full pipeline: Guardrails → Brain → Voice selection →
 *   TTS params. When an API key is configured, calls the
 *   TTS provider and streams audio back. Otherwise returns
 *   the params so the caller can make the request directly.
 *
 * GET  /api/khoem/voice/profiles
 *   Return all 6 voice profiles with their characteristics.
 *
 * GET  /api/khoem/voice/profiles/:profileId
 *   Return a single profile with full TTS param preview.
 * =========================================================
 */

import { Router, type IRouter, type Request, type Response } from "express";
import https from "node:https";
import {
  // Voice Engine
  selectVoiceProfile,
  buildTTSParams,
  listVoiceProfiles,
  VOICE_PROFILES,
  type ConversationPersona,
  type ProfileId,
  type TTSProvider,
} from "../engines/index.js";
import {
  reason,
  checkInput,
  summarise,
} from "../engines/index.js";

const router: IRouter = Router();

// ─────────────────────────────────────────────────────────
// GET /api/khoem/voice/profiles
// List all 6 voice profiles
// ─────────────────────────────────────────────────────────
router.get("/khoem/voice/profiles", (_req: Request, res: Response) => {
  const profiles = listVoiceProfiles().map((p) => ({
    id: p.id,
    displayName: p.displayName,
    gender: p.gender,
    ageStage: p.ageStage,
    characteristics: p.characteristics,
    suggestedPersonas: p.suggestedPersonas,
    openAI: p.openAI,
    elevenLabs: { ...p.elevenLabs, voice_id: "(configure in environment)" },
  }));
  res.json({ count: profiles.length, profiles });
});

// ─────────────────────────────────────────────────────────
// GET /api/khoem/voice/profiles/:profileId
// Single profile with full TTS param preview
// ─────────────────────────────────────────────────────────
router.get(
  "/khoem/voice/profiles/:profileId",
  (req: Request, res: Response) => {
    const { profileId } = req.params;
    const profile = VOICE_PROFILES[profileId as ProfileId];
    if (!profile) {
      res.status(404).json({ error: `Profile '${profileId}' not found` });
      return;
    }
    const ttsEL = buildTTSParams(profile.id, "(sample text)");
    const ttsOA = buildTTSParams(profile.id, "(sample text)", "openai");
    res.json({
      profile,
      ttsParams: {
        elevenlabs: { ready: ttsEL.ready, endpoint: ttsEL.endpoint, body: ttsEL.apiBody, note: ttsEL.note },
        openai:     { ready: ttsOA.ready, endpoint: ttsOA.endpoint, body: ttsOA.apiBody, note: ttsOA.note },
      },
    });
  },
);

// ─────────────────────────────────────────────────────────
// POST /api/khoem/voice/select
// Select voice from Brain signals or explicit persona
// Body: { intent, complexity, persona? }
// ─────────────────────────────────────────────────────────
router.post("/khoem/voice/select", (req: Request, res: Response) => {
  const { intent, complexity, persona, text } = req.body as {
    intent?: string;
    complexity?: string;
    persona?: ConversationPersona;
    text?: string;
  };

  if (!intent || !complexity) {
    res.status(400).json({ error: "intent and complexity are required" });
    return;
  }

  const selection = selectVoiceProfile(
    intent,
    complexity as "low" | "medium" | "high" | "critical",
    persona,
  );

  const sampleText = text ?? `Hello. I am KHOEM_AI speaking as ${selection.profile.displayName}.`;
  const ttsParams  = buildTTSParams(selection.profileId, sampleText);

  res.json({
    selection: {
      profileId:   selection.profileId,
      displayName: selection.profile.displayName,
      gender:      selection.profile.gender,
      ageStage:    selection.profile.ageStage,
      selectedBy:  selection.selectedBy,
      persona:     selection.persona,
    },
    characteristics: selection.profile.characteristics,
    tts: {
      provider:   ttsParams.provider,
      ready:      ttsParams.ready,
      endpoint:   ttsParams.endpoint,
      body:       ttsParams.apiBody,
      note:       ttsParams.note,
    },
  });
});

// ─────────────────────────────────────────────────────────
// POST /api/khoem/voice/synthesise
// Full pipeline: Guardrails → Brain → Voice → TTS
// Body: { sessionId, message, persona?, provider? }
// ─────────────────────────────────────────────────────────
router.post("/khoem/voice/synthesise", async (req: Request, res: Response) => {
  const { sessionId, message, persona, provider } = req.body as {
    sessionId?: string;
    message?: string;
    persona?: ConversationPersona;
    provider?: TTSProvider;
  };

  if (!sessionId || !message) {
    res.status(400).json({ error: "sessionId and message are required" });
    return;
  }

  // ── Step 1: Guardrails ─────────────────────────────────
  const inputCheck = checkInput(message);
  if (!inputCheck.passed) {
    res.status(400).json({
      blocked: true,
      guardrails: summarise(inputCheck),
    });
    return;
  }

  // ── Step 2: Brain Engine ───────────────────────────────
  const reasoning = reason(inputCheck.sanitized, "(voice synthesis request)");

  // ── Step 3: Voice selection ────────────────────────────
  const selection = selectVoiceProfile(
    reasoning.intent,
    reasoning.complexity,
    persona,
  );
  const ttsParams = buildTTSParams(selection.profileId, reasoning.decision, provider);

  // ── Step 4: Call TTS if key is available ───────────────
  if (ttsParams.ready) {
    try {
      const audioBuffer = await callTTSProvider(ttsParams);
      res.set("Content-Type", "audio/mpeg");
      res.set("X-Voice-Profile", selection.profileId);
      res.set("X-Voice-Persona", selection.persona);
      res.set("X-Brain-Intent", reasoning.intent);
      res.set("X-Brain-Complexity", reasoning.complexity);
      res.send(audioBuffer);
      return;
    } catch (err) {
      // Fall through to JSON response with debug info
      res.status(502).json({
        error: "TTS provider call failed",
        detail: err instanceof Error ? err.message : String(err),
        voice: {
          profileId:  selection.profileId,
          displayName: selection.profile.displayName,
          selectedBy: selection.selectedBy,
        },
      });
      return;
    }
  }

  // ── No key configured: return full synthesis plan ─────
  res.json({
    audioReady: false,
    note: ttsParams.note,
    voice: {
      profileId:   selection.profileId,
      displayName: selection.profile.displayName,
      gender:      selection.profile.gender,
      ageStage:    selection.profile.ageStage,
      selectedBy:  selection.selectedBy,
      persona:     selection.persona,
      characteristics: selection.profile.characteristics,
    },
    brain: {
      intent:     reasoning.intent,
      complexity: reasoning.complexity,
      confidence: reasoning.confidence,
    },
    tts: {
      provider: ttsParams.provider,
      endpoint: ttsParams.endpoint,
      body:     ttsParams.apiBody,
      howToActivate:
        ttsParams.provider === "elevenlabs"
          ? "Add ELEVENLABS_API_KEY to your environment secrets"
          : "Add OPENAI_API_KEY to your environment secrets",
    },
  });
});

// ── Internal: call TTS provider ───────────────────────────

function callTTSProvider(
  params: ReturnType<typeof buildTTSParams>,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const url    = new URL(params.endpoint);
    const body   = JSON.stringify(params.apiBody);
    const [headerKey, headerValue] = params.authHeader.split(": ", 2);

    const options: https.RequestOptions = {
      hostname: url.hostname,
      path:     url.pathname,
      method:   "POST",
      headers: {
        "Content-Type":   "application/json",
        "Content-Length": Buffer.byteLength(body),
        [headerKey]:      headerValue,
      },
    };

    const req = https.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => {
        if ((res.statusCode ?? 0) >= 400) {
          reject(
            new Error(`TTS API returned ${res.statusCode}: ${Buffer.concat(chunks).toString()}`),
          );
        } else {
          resolve(Buffer.concat(chunks));
        }
      });
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

export default router;
