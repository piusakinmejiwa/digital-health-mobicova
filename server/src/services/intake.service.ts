import { query } from '../config/database';
import { newMembershipId } from '../lib/membership';

// A channel-agnostic conversational engine for enrolling a member through a
// low-bandwidth channel (WhatsApp chat or USSD menu). The same step machine
// drives both:
//   - WhatsApp is stateful: the controller persists IntakeState between messages.
//   - USSD is stateless: the controller replays the accumulated inputs through
//     advanceIntake() on every request (Africa's Talking sends the full path).
//
// The engine is pure with respect to the member table — it only *reads* (to
// resolve the organisation join code). The controller performs the single member
// INSERT when a session reaches step 'done', so replay can never double-create.

export type IntakeChannel = 'whatsapp' | 'ussd';

export type IntakeStep =
  | 'org_code'
  | 'full_name'
  | 'gender'
  | 'confirm'
  | 'done'
  | 'cancelled';

export interface IntakeState {
  step: IntakeStep;
  orgId?: string;
  orgName?: string;
  fullName?: string;
  gender?: string;
}

export interface IntakeResult {
  state: IntakeState;
  reply: string;
  done: boolean; // session is terminal (member created, or cancelled)
}

export const INTAKE_INTRO =
  'Welcome to MobiCova. Reply with your organisation code to enrol a member.';

const GENDER_BY_CHOICE: Record<string, string> = { '1': 'male', '2': 'female', '3': '' };

export function initialIntakeState(): IntakeState {
  return { step: 'org_code' };
}

async function resolveOrgByJoinCode(code: string): Promise<{ id: string; name: string } | null> {
  const trimmed = code.trim();
  if (!trimmed) return null;
  const result = await query(
    'SELECT id, name FROM organisations WHERE join_code = $1 LIMIT 1',
    [trimmed]
  );
  return result.rows.length ? { id: result.rows[0].id, name: result.rows[0].name } : null;
}

export async function advanceIntake(state: IntakeState, rawInput: string): Promise<IntakeResult> {
  const input = (rawInput || '').trim();

  switch (state.step) {
    case 'org_code': {
      const org = await resolveOrgByJoinCode(input);
      if (!org) {
        return {
          state,
          reply: 'Sorry, that organisation code was not recognised. Please check it and reply with your code.',
          done: false,
        };
      }
      return {
        state: { ...state, step: 'full_name', orgId: org.id, orgName: org.name },
        reply: `Welcome to ${org.name} on MobiCova. What is the new member's full name?`,
        done: false,
      };
    }

    case 'full_name': {
      if (input.length < 2) {
        return { state, reply: "Please reply with the member's full name.", done: false };
      }
      return {
        state: { ...state, step: 'gender', fullName: input },
        reply: 'Select gender:\n1. Male\n2. Female\n3. Prefer not to say',
        done: false,
      };
    }

    case 'gender': {
      if (!['1', '2', '3'].includes(input)) {
        return {
          state,
          reply: 'Please reply 1, 2 or 3.\n1. Male\n2. Female\n3. Prefer not to say',
          done: false,
        };
      }
      return {
        state: { ...state, step: 'confirm', gender: GENDER_BY_CHOICE[input] },
        reply: `Create member "${state.fullName}" under ${state.orgName}?\n1. Yes\n2. No`,
        done: false,
      };
    }

    case 'confirm': {
      if (input === '2') {
        return {
          state: { ...state, step: 'cancelled' },
          reply: 'Cancelled — no member was created. Reply with your organisation code to start again.',
          done: true,
        };
      }
      if (input !== '1') {
        return { state, reply: 'Please reply 1 to confirm or 2 to cancel.', done: false };
      }
      return {
        state: { ...state, step: 'done' },
        reply: `Done! ${state.fullName} has been enrolled with ${state.orgName}. They can now access MobiCova health services.`,
        done: true,
      };
    }

    default:
      return { state: initialIntakeState(), reply: INTAKE_INTRO, done: false };
  }
}

// Performs the single member INSERT for a completed intake. Returns the new id.
export async function createMemberFromIntake(
  state: IntakeState,
  ctx: { phone: string; channel: IntakeChannel }
): Promise<string> {
  const membershipId = await newMembershipId(state.orgId!);
  const result = await query(
    `INSERT INTO members (org_id, full_name, phone, gender, channel, status, membership_id)
     VALUES ($1, $2, $3, $4, $5, 'active', $6)
     RETURNING id`,
    [state.orgId, state.fullName || '', ctx.phone || '', state.gender || '', ctx.channel, membershipId]
  );
  return result.rows[0].id;
}
