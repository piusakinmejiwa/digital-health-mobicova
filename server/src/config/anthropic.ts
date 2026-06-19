import Anthropic from '@anthropic-ai/sdk';
import { env } from './env';

// maxRetries: the SDK retries connection-level failures (e.g. the "Premature
// close" socket drops seen on some hosts) with backoff before giving up.
// timeout: bound each request so a hung connection fails fast instead of stalling.
export const anthropic = env.anthropicApiKey
  ? new Anthropic({ apiKey: env.anthropicApiKey, maxRetries: 4, timeout: 30_000 })
  : null;

export const anthropicEnabled = !!anthropic;

// Configurable so the model can be bumped from the Render dashboard without a
// code change. Defaults to a known-valid Sonnet model.
export const TRIAGE_MODEL = env.anthropicModel;
