import api from './client';
import {
  type RewardChallenge, type CatalogueItemAdmin, type RedemptionAdmin,
  adminListChallenges, adminCreateChallenge, adminUpdateChallenge, adminDeleteChallenge,
  adminListCatalogue, adminCreateCatalogueItem, adminUpdateCatalogueItem, adminDeleteCatalogueItem,
  adminListRedemptions, adminUpdateRedemption,
} from './admin';

// A rewards "api" the shared RewardsManager component is driven by. Two
// implementations: platform (MobiCova global defaults, /admin/rewards) and
// tenant (a Company Admin's own org, /rewards).
export interface RewardsApi {
  scope: string;
  listChallenges: () => Promise<{ challenges: RewardChallenge[]; actions: string[]; windows: string[] }>;
  createChallenge: (d: Record<string, unknown>) => Promise<RewardChallenge>;
  updateChallenge: (id: string, d: Record<string, unknown>) => Promise<RewardChallenge>;
  deleteChallenge: (id: string) => Promise<void>;
  listCatalogue: () => Promise<{ items: CatalogueItemAdmin[]; kinds: string[] }>;
  createCatalogueItem: (d: Record<string, unknown>) => Promise<CatalogueItemAdmin>;
  updateCatalogueItem: (id: string, d: Record<string, unknown>) => Promise<CatalogueItemAdmin>;
  deleteCatalogueItem: (id: string) => Promise<void>;
  listRedemptions: (status?: string) => Promise<{ redemptions: RedemptionAdmin[] }>;
  updateRedemption: (id: string, status: string) => Promise<void>;
}

// Platform admin — manages MobiCova's global defaults.
export const platformRewardsApi: RewardsApi = {
  scope: 'platform',
  listChallenges: adminListChallenges,
  createChallenge: adminCreateChallenge,
  updateChallenge: adminUpdateChallenge,
  deleteChallenge: adminDeleteChallenge,
  listCatalogue: adminListCatalogue,
  createCatalogueItem: adminCreateCatalogueItem,
  updateCatalogueItem: adminUpdateCatalogueItem,
  deleteCatalogueItem: adminDeleteCatalogueItem,
  listRedemptions: adminListRedemptions,
  updateRedemption: adminUpdateRedemption,
};

// Tenant (Company Admin) — manages their own org's programme.
export const tenantRewardsApi: RewardsApi = {
  scope: 'org',
  listChallenges: () => api.get('/rewards/challenges').then((r) => r.data),
  createChallenge: (d) => api.post('/rewards/challenges', d).then((r) => r.data),
  updateChallenge: (id, d) => api.patch(`/rewards/challenges/${id}`, d).then((r) => r.data),
  deleteChallenge: (id) => api.delete(`/rewards/challenges/${id}`).then(() => undefined),
  listCatalogue: () => api.get('/rewards/catalogue').then((r) => r.data),
  createCatalogueItem: (d) => api.post('/rewards/catalogue', d).then((r) => r.data),
  updateCatalogueItem: (id, d) => api.patch(`/rewards/catalogue/${id}`, d).then((r) => r.data),
  deleteCatalogueItem: (id) => api.delete(`/rewards/catalogue/${id}`).then(() => undefined),
  listRedemptions: (status = '') => api.get('/rewards/redemptions', { params: status ? { status } : {} }).then((r) => r.data),
  updateRedemption: (id, status) => api.patch(`/rewards/redemptions/${id}`, { status }).then(() => undefined),
};
