import { env, pipeline } from '@huggingface/transformers';
import { config } from '#src/config.js';

env.cacheDir = config.hfCacheDir;

let extractorPromise;

/** Lazy singleton: the model is downloaded and loaded on first use only. */
function getExtractor() {
  extractorPromise ??= pipeline('feature-extraction', config.embedding.model, { dtype: 'q8' });
  return extractorPromise;
}

/** The text a post is embedded from. The tokenizer truncates at the model's max length. */
export function postText({ title, body }) {
  return `${title}\n\n${body}`;
}

/** @returns {Promise<number[][]>} one normalized vector per input text */
export async function embedBatch(texts) {
  const extractor = await getExtractor();
  const output = await extractor(texts, { pooling: config.embedding.pooling, normalize: true });
  const vectors = output.tolist();
  for (const v of vectors) {
    if (v.length !== config.embedding.dims) {
      throw new Error(`model returned ${v.length} dims, expected ${config.embedding.dims}`);
    }
  }
  return vectors;
}
