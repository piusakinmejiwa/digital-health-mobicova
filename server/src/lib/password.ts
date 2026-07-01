// Central password policy, applied everywhere a password is set or reset
// (self-service registration + platform-admin provisioning). Returns a
// human-readable error string when the password is too weak, or null when it
// passes. Keeping this in one place means the policy can be tightened once.

// 12 is the current OWASP/NIST-aligned floor for accounts guarding PHI. Only
// affects newly set/reset passwords; existing users are unaffected until they change it.
const MIN_LENGTH = 12;

export function passwordIssue(input: unknown): string | null {
  if (typeof input !== 'string' || input.length === 0) {
    return 'Password is required';
  }
  if (input.length < MIN_LENGTH) {
    return `Password must be at least ${MIN_LENGTH} characters`;
  }
  if (!/[a-z]/.test(input)) return 'Password must contain a lowercase letter';
  if (!/[A-Z]/.test(input)) return 'Password must contain an uppercase letter';
  if (!/[0-9]/.test(input)) return 'Password must contain a number';
  if (!/[^A-Za-z0-9]/.test(input)) return 'Password must contain a symbol';
  return null;
}
