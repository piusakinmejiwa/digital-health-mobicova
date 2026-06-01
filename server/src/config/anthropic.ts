import Anthropic from '@anthropic-ai/sdk';
import { env } from './env';

export const anthropic = env.anthropicApiKey
  ? new Anthropic({ apiKey: env.anthropicApiKey })
  : null;

export const anthropicEnabled = !!anthropic;

// Configurable so the model can be bumped from the Render dashboard without a
// code change. Defaults to a known-valid Sonnet model.
export const TRIAGE_MODEL = env.anthropicModel;
