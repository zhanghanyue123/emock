export const TOEFL_SECTION_TYPES = {
  reading: "toefl.reading",
  listening: "toefl.listening",
  writing: "toefl.writing",
  speaking: "toefl.speaking"
} as const;

export type ToeflSectionType = (typeof TOEFL_SECTION_TYPES)[keyof typeof TOEFL_SECTION_TYPES];
