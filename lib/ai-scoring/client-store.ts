"use client";

import { STORAGE_KEYS } from "@/lib/constants";
import { acousticFeatures, SCORE_MODEL_CONFIG, scoreSpeakingLocal, scoreWritingLocal, transcribeSpeakingLocal } from "@/lib/ai-scoring/local-provider";
import type { AiEvaluationRecord, AiScoringJob, AiScoringStore, TaskRubric } from "@/types/ai-scoring";
import type { SpeakingRecordingAnswer } from "@/types/practice";
import type { AnswerValue } from "@/types/test";
import type { TestQuestion } from "@/types/structured-test";

const PROVIDER = "local_heuristic";
const MODEL = "local-practice-estimator-v1";
const PROMPT_VERSION = "local-rubric-prompt-v1";
const TEMPERATURE = 0;

function readStore(): AiScoringStore {
  if (typeof window === "undefined") return { schemaVersion: 1, jobs: [], evaluations: [], humanOverrides: [] };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.aiScoring);
    if (!raw) return { schemaVersion: 1, jobs: [], evaluations: [], humanOverrides: [] };
    const parsed = JSON.parse(raw) as Partial<AiScoringStore>;
    return {
      schemaVersion: 1,
      jobs: parsed.jobs || [],
      evaluations: parsed.evaluations || [],
      humanOverrides: parsed.humanOverrides || []
    };
  } catch {
    return { schemaVersion: 1, jobs: [], evaluations: [], humanOverrides: [] };
  }
}

function writeStore(store: AiScoringStore) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEYS.aiScoring, JSON.stringify(store));
}

async function hashInput(value: unknown) {
  const data = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function nowIso() {
  return new Date().toISOString();
}

function rubricFor(question: TestQuestion): TaskRubric {
  if (question.type === "academic_discussion") return SCORE_MODEL_CONFIG.taskRubrics.academic_discussion;
  if (question.type === "listen_repeat") return SCORE_MODEL_CONFIG.taskRubrics.listen_repeat;
  if (question.type === "interview_response") return SCORE_MODEL_CONFIG.taskRubrics.interview_response;
  return SCORE_MODEL_CONFIG.taskRubrics.write_email;
}

function selectedRecording(value: AnswerValue | undefined, questionId: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const answer = value as Partial<SpeakingRecordingAnswer>;
  const takes = answer.recordingsByQuestionId?.[questionId] || [];
  return takes.find((take) => take.id === answer.selectedRecordingId) || takes.at(-1) || null;
}

function isAiScoredQuestion(question: TestQuestion) {
  return question.type === "write_email" || question.type === "academic_discussion" || question.type === "listen_repeat" || question.type === "interview_response";
}

export async function queueAiScoringForAttempt(input: {
  attemptId: string;
  questions: TestQuestion[];
  answers: Record<string, AnswerValue>;
  responseDurationSeconds?: number;
}) {
  const store = readStore();
  const nextJobs: AiScoringJob[] = [];

  for (const question of input.questions.filter(isAiScoredQuestion)) {
    const answer = input.answers[question.id];
    const rubric = rubricFor(question);
    const taskType = question.type === "write_email" || question.type === "academic_discussion" ? "writing_score" : "speaking_score";
    const recording = taskType === "speaking_score" ? selectedRecording(answer, question.id) : null;
    const scoringInput = {
      questionId: question.id,
      taskType: question.type,
      prompt: question.prompt || question.instructions || "",
      instructions: question.instructions,
      response: typeof answer === "string" ? answer : "",
      recordingId: recording?.id,
      recordingDurationMs: recording?.durationMs || 0,
      hasAudio: Boolean(recording?.dataUrl || recording?.blobUrl),
      rubricVersion: rubric.version,
      model: MODEL
    };
    const inputHash = await hashInput(scoringInput);
    const cached = store.evaluations.find((evaluation) => evaluation.inputHash === inputHash && evaluation.model === MODEL && evaluation.rubricVersion === rubric.version);
    if (cached) continue;
    const jobId = `${input.attemptId}:${question.id}:${taskType}:${inputHash.slice(0, 10)}`;
    const existing = store.jobs.find((job) => job.id === jobId);
    if (existing) continue;
    nextJobs.push({
      id: jobId,
      attemptId: input.attemptId,
      questionId: question.id,
      taskType,
      status: "queued",
      provider: PROVIDER,
      model: MODEL,
      rubricVersion: rubric.version,
      inputHash,
      retryCount: 0,
      createdAt: nowIso()
    });
  }

  if (!nextJobs.length) return;
  store.jobs = [...store.jobs, ...nextJobs];
  writeStore(store);
  await processQueuedAiScoringJobs(input);
}

export async function processQueuedAiScoringJobs(input: {
  attemptId: string;
  questions: TestQuestion[];
  answers: Record<string, AnswerValue>;
  responseDurationSeconds?: number;
}) {
  const store = readStore();
  for (const job of store.jobs.filter((item) => item.attemptId === input.attemptId && item.status === "queued")) {
    const question = input.questions.find((item) => item.id === job.questionId);
    if (!question) continue;
    const rubric = rubricFor(question);
    job.status = "processing";
    job.startedAt = nowIso();
    try {
      const answer = input.answers[question.id];
      if (job.taskType === "writing_score") {
        const response = typeof answer === "string" ? answer : "";
        const result = await scoreWritingLocal({
          questionId: question.id,
          taskType: question.type,
          instructions: question.instructions,
          prompt: question.prompt || question.instructions || "",
          response,
          wordCount: response.trim().split(/\s+/).filter(Boolean).length,
          responseDurationSeconds: input.responseDurationSeconds,
          rubric,
          rubricVersion: rubric.version
        });
        store.evaluations.push(evaluationFor(job, result));
      } else {
        const recording = selectedRecording(answer, question.id);
        const transcript = await transcribeSpeakingLocal({ durationMs: recording?.durationMs || 0, hasAudio: Boolean(recording?.dataUrl || recording?.blobUrl) });
        const features = acousticFeatures(transcript.durationMs, transcript.transcript);
        store.evaluations.push(evaluationFor({ ...job, taskType: "speaking_transcription" }, transcript, recording?.id));
        const result = await scoreSpeakingLocal({ taskType: question.type === "listen_repeat" ? "listen_repeat" : "interview_response", transcript, rubric, features });
        store.evaluations.push(evaluationFor(job, result, recording?.id));
      }
      job.status = "completed";
      job.completedAt = nowIso();
    } catch (error) {
      job.status = job.retryCount >= 2 ? "failed" : "queued";
      job.retryCount += 1;
      job.error = error instanceof Error ? error.message : "AI scoring failed";
    }
  }
  writeStore(store);
}

function evaluationFor(job: AiScoringJob, result: AiEvaluationRecord["result"], recordingId?: string): AiEvaluationRecord {
  return {
    id: `${job.id}:evaluation:${Date.now()}`,
    attemptId: job.attemptId,
    questionId: job.questionId,
    recordingId,
    provider: job.provider,
    model: job.model,
    promptVersion: PROMPT_VERSION,
    rubricVersion: job.rubricVersion,
    scoreModelVersion: SCORE_MODEL_CONFIG.version,
    temperature: TEMPERATURE,
    inputHash: job.inputHash,
    result,
    confidence: "confidence" in result ? result.confidence : 0,
    createdAt: nowIso()
  };
}

export function getAiScoringForAttempt(attemptId: string) {
  const store = readStore();
  return {
    jobs: store.jobs.filter((job) => job.attemptId === attemptId),
    evaluations: store.evaluations.filter((evaluation) => evaluation.attemptId === attemptId),
    humanOverrides: store.humanOverrides.filter((override) => override.attemptId === attemptId)
  };
}
