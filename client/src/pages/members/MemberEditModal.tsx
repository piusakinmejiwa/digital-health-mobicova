import { useState } from 'react';
import axios from 'axios';
import { updateMember } from '../../api/resources';
import type { Member } from '../../types';

// Edit a member's full profile. The server's updateMember accepts every field
// here; this drawer is the UI for it (the detail page itself is read-only).
// Address/city are intentionally left to the Location card on the detail page,
// which explains the nearest-pharmacy geocoding.

const toArray = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);
const fromArray = (a?: string[] | null) => (a && a.length ? a.join(', ') : '');

export default function MemberEditModal({ member, onClose, onSaved }: {
  member: Member;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    fullName: member.full_name || '',
    dateOfBirth: (member.date_of_birth || '').slice(0, 10),
    email: member.email || '',
    phone: member.phone || '',
    gender: member.gender || '',
    channel: member.channel || 'app',
    status: member.status || 'active',
    bloodGroup: member.blood_group || '',
    allergies: fromArray(member.allergies),
    chronicConditions: fromArray(member.chronic_conditions),
    currentMedications: fromArray(member.current_medications),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const save = async () => {
    if (!form.fullName.trim()) { setError('Full name is required.'); return; }
    setBusy(true); setError('');
    try {
      await updateMember(member.id, {
        fullName: form.fullName.trim(),
        dateOfBirth: form.dateOfBirth || null,
        email: form.email.trim(),
        phone: form.phone.trim(),
        gender: form.gender,
        channel: form.channel,
        status: form.status,
        bloodGroup: form.bloodGroup.trim(),
        allergies: toArray(form.allergies),
        chronicConditions: toArray(form.chronicConditions),
        currentMedications: toArray(form.currentMedications),
      });
      onSaved();
    } catch (err) {
      if (axios.isAxiosError(err)) setError(err.response?.data?.error || 'Could not save changes.');
      else setError('Could not save changes.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <h3>Edit member</h3>

        <div className="form-row">
          <div className="form-group">
            <label>Full name *</label>
            <input value={form.fullName} onChange={set('fullName')} />
          </div>
          <div className="form-group">
            <label>Date of birth</label>
            <input type="date" value={form.dateOfBirth} onChange={set('dateOfBirth')} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={form.email} onChange={set('email')} />
          </div>
          <div className="form-group">
            <label>Phone</label>
            <input value={form.phone} onChange={set('phone')} placeholder="+234…" />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Gender</label>
            <select value={form.gender} onChange={set('gender')}>
              <option value="">Prefer not to say</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
            </select>
          </div>
          <div className="form-group">
            <label>Primary channel</label>
            <select value={form.channel} onChange={set('channel')}>
              <option value="app">App</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="ussd">USSD</option>
              <option value="web">Web</option>
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Status</label>
            <select value={form.status} onChange={set('status')}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
          <div className="form-group">
            <label>Blood group</label>
            <input value={form.bloodGroup} onChange={set('bloodGroup')} placeholder="e.g. O+" />
          </div>
        </div>

        <h3 className="section-title">Health profile (EHR-lite)</h3>
        <div className="form-row">
          <div className="form-group">
            <label>Allergies <span className="muted">(comma-separated)</span></label>
            <input value={form.allergies} onChange={set('allergies')} placeholder="e.g. Penicillin, Peanuts" />
          </div>
          <div className="form-group">
            <label>Chronic conditions <span className="muted">(comma-separated)</span></label>
            <input value={form.chronicConditions} onChange={set('chronicConditions')} placeholder="e.g. Hypertension" />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Current medications <span className="muted">(comma-separated)</span></label>
            <input value={form.currentMedications} onChange={set('currentMedications')} placeholder="e.g. Amlodipine 5mg" />
          </div>
          <div className="form-group" />
        </div>

        {error && <div className="notice notice-error">{error}</div>}

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={busy}>
            {busy ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
