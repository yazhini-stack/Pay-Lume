export interface NeuralVoice {
  id: string;
  name: string;
  gender: "Female" | "Male";
  accent: "American" | "British";
  grade: string;
  recommended?: boolean;
  description: string;
}

export const KOKORO_VOICES: NeuralVoice[] = [
  {
    id: "af_heart",
    name: "Heart",
    gender: "Female",
    accent: "American",
    grade: "A",
    recommended: true,
    description: "Warm, natural, and expressive tone (Recommended for Cybersecurity Advisories)"
  },
  {
    id: "af_bella",
    name: "Bella",
    gender: "Female",
    accent: "American",
    grade: "A-",
    description: "Clear and energetic conversational delivery"
  },
  {
    id: "af_nicole",
    name: "Nicole",
    gender: "Female",
    accent: "American",
    grade: "B-",
    description: "Calm, steady, and focused audio narration"
  },
  {
    id: "am_michael",
    name: "Michael",
    gender: "Male",
    accent: "American",
    grade: "C+",
    description: "Professional, confident male tone"
  },
  {
    id: "am_adam",
    name: "Adam",
    gender: "Male",
    accent: "American",
    grade: "C",
    description: "Deep, grounded security analyst voice"
  },
  {
    id: "bf_emma",
    name: "Emma",
    gender: "Female",
    accent: "British",
    grade: "B-",
    description: "Articulate British English narration"
  },
  {
    id: "bm_george",
    name: "George",
    gender: "Male",
    accent: "British",
    grade: "C",
    description: "Authoritative British male delivery"
  }
];

export const DEFAULT_NEURAL_VOICE_ID = "af_heart";
