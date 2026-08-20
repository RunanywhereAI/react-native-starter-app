/**
 * The publisher behind a model, so the loader can say who made the thing it is
 * about to download instead of just "the language model".
 *
 * The rule table is a hand-kept copy of the same table in iOS
 * (`ModelOrgCatalog`), Android (`ModelTaxonomy`), Web, Electron and Flutter.
 * Five copies is a known cost; the alternative is a field on the catalog row,
 * which is a commons change. Keep them in step when a family is added.
 */

export interface ModelOrg {
  /** Stable key, e.g. "nvidia". */
  key: string;
  /** Consumer-facing name, e.g. "NVIDIA". */
  name: string;
}

/**
 * Ordered matchers against the lowercased "id + name" haystack. First match
 * wins, so a specific publisher precedes the family it would otherwise be
 * swallowed by: NVIDIA before Meta so Nemotron stays NVIDIA, DeepSeek before
 * Alibaba so the R1 Qwen distills stay DeepSeek.
 */
const ORG_MATCHERS: ReadonlyArray<{ key: string; name: string; test: RegExp }> = [
  {
    key: 'nvidia',
    name: 'NVIDIA',
    test: /nemotron|nemoguard|cosmos|canary|parakeet|nv[_-]embed|nv_rerank|nvidia|sortformer/,
  },
  { key: 'deepseek', name: 'DeepSeek', test: /deepseek/ },
  { key: 'prism', name: 'Prism', test: /bonsai|prismml|prism-?ml/ },
  { key: 'deepgrove', name: 'Deepgrove', test: /maple/ },
  { key: 'ibm', name: 'IBM', test: /granite/ },
  // `fara` rides with Microsoft's `phi`: Fara1.5 ships mirrored under our own HF
  // org, so the catalog row names no upstream publisher. Filing it by its own
  // name beats guessing one into a UI label.
  { key: 'microsoft', name: 'Microsoft', test: /\bphi\b|fara/ },
  { key: 'google', name: 'Google', test: /gemma|embeddinggemma|siglip/ },
  // Muse Glimmer is Meta's, per the catalog row's own name.
  { key: 'meta', name: 'Meta', test: /llama|muse-glimmer|muse_glimmer/ },
  { key: 'alibaba', name: 'Alibaba', test: /qwen/ },
  { key: 'liquid', name: 'Liquid AI', test: /lfm2/ },
  { key: 'mistral', name: 'Mistral AI', test: /mistral|ministral/ },
  { key: 'hugging-face', name: 'Hugging Face', test: /smollm|smolvlm/ },
  { key: 'openai', name: 'OpenAI', test: /whisper/ },
  { key: 'zhipu', name: 'Zhipu AI', test: /\bglm\b|glm-/ },
  {
    key: 'open-source',
    name: 'Open source',
    test: /internvl|moonshine|melo|kokoro|kitten|piper|vits|silero|vad|minilm|supertonic|segformer/,
  },
];

const FALLBACK_ORG: ModelOrg = { key: 'open-source', name: 'Open source' };

/**
 * The publisher for one model. Never throws; an unrecognised name reads as
 * community rather than guessing a company.
 */
export function modelOrg(id: string, name: string): ModelOrg {
  const haystack = `${id} ${name}`.toLowerCase();
  const match = ORG_MATCHERS.find((org) => org.test.test(haystack));
  return match ?? FALLBACK_ORG;
}

/**
 * "Qwen3.5 0.8B Q4_K_M · Alibaba" — what the loader shows so a reader knows
 * what is about to land on their device and who made it.
 */
export function modelCredit(id: string, name: string): string {
  return `${name} · ${modelOrg(id, name).name}`;
}
