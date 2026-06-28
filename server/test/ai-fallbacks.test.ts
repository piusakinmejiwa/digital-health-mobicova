import { describe, it, expect } from 'vitest';
import { generateReportInsight } from '../src/lib/reportInsights';
import { generateCareSummary, CareSummaryUnavailable } from '../src/lib/careSummary';
import { reviewClaim, ClaimReviewUnavailable } from '../src/lib/claimReview';
import { analyzeFeedback, FeedbackAnalysisUnavailable } from '../src/lib/feedbackInsights';

// With no ANTHROPIC_API_KEY (the test env), every AI feature must degrade safely
// — never crash the request, never silently pretend it ran. These guards are
// first-line, so they trip before any DB call (the suite has no database).
describe('AI-off fallbacks', () => {
  it('report insight returns null (report still renders without it)', async () => {
    await expect(generateReportInsight({} as never)).resolves.toBeNull();
  });

  it('care summary throws CareSummaryUnavailable', async () => {
    await expect(generateCareSummary('org', 'member', 'user'))
      .rejects.toBeInstanceOf(CareSummaryUnavailable);
  });

  it('claim review throws ClaimReviewUnavailable', async () => {
    await expect(reviewClaim('org', 'claim'))
      .rejects.toBeInstanceOf(ClaimReviewUnavailable);
  });

  it('feedback analysis throws FeedbackAnalysisUnavailable', async () => {
    await expect(analyzeFeedback())
      .rejects.toBeInstanceOf(FeedbackAnalysisUnavailable);
  });
});
