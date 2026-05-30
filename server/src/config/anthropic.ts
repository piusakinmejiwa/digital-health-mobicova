import Anthropic from '@anthropic-ai/sdk';
import { env } from './env';

export const anthropic = env.anthropicApiKey
  ? new Anthropic({ apiKey: env.anthropicApiKey })
  : null;

export const anthropicEnabled = !!anthropic;

export const TRIAGE_MODEL = 'claude-sonnet-4-6';
