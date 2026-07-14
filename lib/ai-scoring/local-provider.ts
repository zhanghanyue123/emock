import type {
  RubricDimensionScore,
  SpeakingAcousticFeatures,
  SpeakingScoringResult,
  SpeakingTranscriptResult,
  TaskRubric,
  WritingScoringInput,
  WritingScoringResult
} from "@/types/ai-scoring";

export const SCORE_MODEL_CONFIG = {
  id: "toefl-practice-estimate-local-v1",
  examProfile: "toefl",
  version: "2026-07-local-v1",
  status: "practice_estimate" as const,
  taskRubrics: {
    write_email: {
      id: "toefl-writing-email",
      version: "writing-email-v1",
      maxScore: 5,
      dimensions: [
        { id: "taskFulfillment", label: "Task Fulfillment", maxScore: 5 },
        { id: "relevanceAndDevelopment", label: "Development", maxScore: 5 },
        { id: "organizationAndCoherence", label: "Organization", maxScore: 5 },
        { id: "languageUse", label: "Language Use", maxScore: 5 },
        { id: "grammarAndMechanics", label: "Grammar", maxScore: 5 }
      ]
    },
    academic_discussion: {
      id: "toefl-academic-discussion",
      version: "academic-discussion-v1",
      maxScore: 5,
      dimensions: [
        { id: "taskFulfillment", label: "Task Fulfillment", maxScore: 5 },
        { id: "relevanceAndDevelopment", label: "Development", maxScore: 5 },
        { id: "organizationAndCoherence", label: "Organization", maxScore: 5 },
        { id: "languageUse", label: "Language Use", maxScore: 5 },
        { id: "grammarAndMechanics", label: "Grammar", maxScore: 5 }
      ]
    },
    listen_repeat: {
      id: "toefl-listen-repeat",
      version: "listen-repeat-v1",
      maxScore: 5,
      dimensions: [
        { id: "contentAccuracy", label: "Content", maxScore: 5 },
        { id: "completeness", label: "Completeness", maxScore: 5 },
        { id: "intelligibility", label: "Intelligibility", maxScore: 5 },
        { id: "fluency", label: "Fluency", maxScore: 5 },
        { id: "delivery", label: "Delivery", maxScore: 5 }
      ]
    },
    interview_response: {
      id: "toefl-interview-response",
      version: "interview-response-v1",
      maxScore: 5,
      dimensions: [
        { id: "taskFulfillment", label: "Task Fulfillment", maxScore: 5 },
        { id: "relevanceAndDevelopment", label: "Development", maxScore: 5 },
        { id: "languageUse", label: "Language Use", maxScore: 5 },
        { id: "intelligibility", label: "Intelligibility", maxScore: 5 },
        { id: "fluencyAndDelivery", label: "Fluency", maxScore: 5 }
      ]
    }
  }
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function words(text: string) {
  return text.trim().split(/\s+/).filter(Boolean);
}

function estimateWritingBase(wordCount: number) {
  if (wordCount <= 0) return 0;
  if (wordCount < 35) return 1.4;
  if (wordCount < 75) return 2.4;
  if (wordCount < 130) return 3.3;
  if (wordCount < 220) return 4.0;
  return 4.4;
}

function dimensionScores(rubric: TaskRubric, base: number, evidence: string[], lowConfidence = false): RubricDimensionScore[] {
  return rubric.dimensions.map((dimension, index) => {
    const adjustment = index % 2 === 0 ? 0.1 : -0.1;
    return {
      id: dimension.id,
      score: Number(clamp(base + adjustment, 0, dimension.maxScore).toFixed(1)),
      maxScore: dimension.maxScore,
      confidence: lowConfidence ? 0.48 : 0.68,
      evidence,
      feedback: lowConfidence ? "This response needs human review before the estimate is trusted." : "The estimate is based on response length, completion, and visible organization signals."
    };
  });
}

export async function scoreWritingLocal(input: WritingScoringInput): Promise<WritingScoringResult> {
  const response = input.response.trim();
  if (!response) {
    return {
      overallScore: 0,
      maxScore: input.rubric.maxScore,
      dimensions: dimensionScores(input.rubric, 0, ["No response submitted."], true),
      strengths: [],
      improvements: ["Submit a complete response that directly answers the prompt."],
      conciseFeedback: "No writing response was submitted.",
      confidence: 0.9,
      needsHumanReview: false,
      flags: ["unanswered"],
      scoreLabel: "AI-estimated score",
      scoreStatus: "practice_estimate"
    };
  }
  const sentences = response.split(/[.!?]+/).filter((item) => item.trim().length > 0).length;
  const base = clamp(estimateWritingBase(input.wordCount) + Math.min(0.4, sentences * 0.04), 0, input.rubric.maxScore);
  const insufficient = input.wordCount < 50;
  const evidence = [`${input.wordCount} words submitted.`, `${sentences} sentence-like units detected.`];
  return {
    overallScore: Number(base.toFixed(1)),
    maxScore: input.rubric.maxScore,
    dimensions: dimensionScores(input.rubric, base, evidence, insufficient),
    strengths: response.length > 0 ? ["The response provides assessable written content.", "The answer can be reviewed against the task rubric."] : [],
    improvements: insufficient
      ? ["Develop the answer with more specific support.", "Make sure the response fully addresses the prompt."]
      : ["Add more precise examples where possible.", "Check sentence control and transitions before submitting."],
    conciseFeedback: insufficient ? "This is a short response, so the estimate is low-confidence." : "This is a practice estimate based on the submitted response and rubric.",
    detailedFeedback: "This local estimator does not rewrite the essay. It preserves the original response and produces a conservative practice estimate.",
    confidence: insufficient ? 0.5 : 0.68,
    needsHumanReview: insufficient,
    flags: insufficient ? ["insufficient_response"] : [],
    scoreLabel: "AI-estimated score",
    scoreStatus: "practice_estimate"
  };
}

export async function transcribeSpeakingLocal(input: { durationMs: number; hasAudio: boolean }): Promise<SpeakingTranscriptResult> {
  if (!input.hasAudio || input.durationMs <= 0) {
    return {
      transcript: "",
      confidence: 0.9,
      durationMs: input.durationMs,
      emptyAudio: true,
      warnings: ["empty_audio"]
    };
  }
  return {
    transcript: "[Practice transcript pending: local provider stores the recording and estimates delivery from metadata.]",
    confidence: 0.45,
    durationMs: input.durationMs,
    emptyAudio: false,
    warnings: ["transcription_placeholder"]
  };
}

export function acousticFeatures(durationMs: number, transcript: string): SpeakingAcousticFeatures {
  const wordCount = words(transcript.replace(/\[[^\]]+\]/g, "")).length;
  const minutes = Math.max(durationMs / 60000, 0.01);
  return {
    totalDurationMs: durationMs,
    speechDurationMs: durationMs,
    silenceRatio: durationMs < 2000 ? 0.8 : 0.25,
    longPauseCount: durationMs < 2000 ? 1 : 0,
    wordsPerMinute: wordCount ? Math.round(wordCount / minutes) : undefined
  };
}

export async function scoreSpeakingLocal(input: {
  taskType: "listen_repeat" | "interview_response";
  transcript: SpeakingTranscriptResult;
  rubric: TaskRubric;
  features: SpeakingAcousticFeatures;
}): Promise<SpeakingScoringResult> {
  if (input.transcript.emptyAudio) {
    return {
      overallScore: 0,
      maxScore: input.rubric.maxScore,
      transcript: "",
      dimensions: dimensionScores(input.rubric, 0, ["No usable audio was submitted."], true),
      strengths: [],
      improvements: ["Record a complete spoken response."],
      acousticSummary: { durationSeconds: Math.round(input.features.totalDurationMs / 1000), silenceRatio: input.features.silenceRatio, longPauseCount: input.features.longPauseCount },
      confidence: 0.9,
      needsHumanReview: false,
      flags: ["unanswered"],
      scoreLabel: "AI-estimated score",
      scoreStatus: "practice_estimate"
    };
  }
  const durationSeconds = input.features.totalDurationMs / 1000;
  const base = clamp(durationSeconds < 5 ? 1.5 : durationSeconds < 15 ? 2.6 : 3.4, 0, input.rubric.maxScore);
  const lowConfidence = input.transcript.confidence < 0.55;
  return {
    overallScore: Number(base.toFixed(1)),
    maxScore: input.rubric.maxScore,
    transcript: input.transcript.transcript,
    dimensions: dimensionScores(input.rubric, base, [`${Math.round(durationSeconds)} seconds recorded.`], lowConfidence),
    strengths: ["A recording was saved and can be replayed in review."],
    improvements: ["Use a real transcription provider for content-level scoring.", "Aim for a complete response with clear pacing."],
    acousticSummary: { durationSeconds: Math.round(durationSeconds), wordsPerMinute: input.features.wordsPerMinute, silenceRatio: input.features.silenceRatio, longPauseCount: input.features.longPauseCount },
    confidence: lowConfidence ? 0.45 : 0.62,
    needsHumanReview: lowConfidence,
    flags: lowConfidence ? ["transcription_low_confidence", "manual_review_recommended"] : [],
    scoreLabel: "AI-estimated score",
    scoreStatus: "practice_estimate"
  };
}
