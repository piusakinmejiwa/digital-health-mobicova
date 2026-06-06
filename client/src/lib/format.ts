export function naira(amount: number | string, currency = 'NGN'): string {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount;
  const symbol = currency === 'NGN' ? '₦' : currency + ' ';
  return symbol + n.toLocaleString('en-NG', { maximumFractionDigits: 0 });
}

export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

export function age(dob: string | null): string {
  if (!dob) return '—';
  const diff = Date.now() - new Date(dob).getTime();
  return Math.floor(diff / (365.25 * 24 * 3600 * 1000)) + 'y';
}

const triageLabels: Record<string, string> = {
  emergency: 'Emergency',
  urgent: 'Urgent',
  gp: 'See a doctor',
  self_care: 'Self-care',
  info: 'Information',
  unknown: 'Pending',
};
export function triageLabel(level: string): string {
  return triageLabels[level] || level;
}

const statusClass: Record<string, string> = {
  active: 'badge-green',
  scheduled: 'badge-blue',
  completed: 'badge-green',
  cancelled: 'badge-gray',
  pending: 'badge-amber',
  paid: 'badge-green',
  unpaid: 'badge-amber',
  // Claim adjudication statuses
  submitted: 'badge-blue',
  under_review: 'badge-amber',
  approved: 'badge-green',
  rejected: 'badge-red',
  // Prescription fulfilment statuses
  ready: 'badge-amber',
  dispensed: 'badge-green',
  out_for_delivery: 'badge-blue',
  collected: 'badge-green',
  delivered: 'badge-green',
};
export function badgeClass(status: string): string {
  return statusClass[status] || 'badge-gray';
}

const fulfilmentLabels: Record<string, string> = {
  pending: 'Awaiting pharmacy',
  ready: 'Ready for you',
  dispensed: 'Dispensed',
  out_for_delivery: 'Out for delivery',
  collected: 'Collected',
  delivered: 'Delivered',
};
export function fulfilmentLabel(status: string): string {
  return fulfilmentLabels[status] || status || 'Awaiting pharmacy';
}

const claimStatusLabels: Record<string, string> = {
  submitted: 'Submitted',
  under_review: 'Under review',
  approved: 'Approved',
  rejected: 'Rejected',
  paid: 'Paid',
};
export function claimStatusLabel(status: string): string {
  return claimStatusLabels[status] || status;
}

export function fileSize(bytes: number): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
