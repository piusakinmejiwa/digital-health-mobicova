// Central password policy, applied everywhere a password is set or reset
// (self-service registration + platform-admin provisioning). Returns a
// human-readable error string when the password is too weak, or null when it
// passes. Keeping this in one place means the policy can be tightened once.

const MIN_LENGTH = 8;

export function passwordIssue(input: unknown): string | null {
  if (typeof input !== 'string' || input.length === 0) {
    return 'Password is required';
  }
  if (input.length < MIN_LENGTH) {
    return `Password must be at least ${MIN_LENGTH} characters`;
  }
  if (!/[A-Za-z]/.test(input) || !/[0-9]/.test(input)) {
    return 'Password must contain at least one letter and one number';
  }
  return null;
}
