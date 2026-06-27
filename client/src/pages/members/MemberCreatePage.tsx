import { useState } from 'react';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useQueryClient } from '@tanstack/react-query';
import { createMember } from '../../api/resources';
import { useAuth } from '../../context/AuthContext';
import { NIGERIA_STATES, lgasForState } from '../../lib/nigeriaLgas';
import './Members.css';

interface FormValues {
  fullName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  channel: string;
  bloodGroup: string;
  allergies: string;
  chronicConditions: string;
  currentMedications: string;
  address: string;
  city: string;
  state: string;
  lga: string;
}

const toArray = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

export default function MemberCreatePage() {
  const { canWrite } = useAuth();
  const { register, handleSubmit, watch, setValue } = useForm<FormValues>({
    defaultValues: { channel: 'app', gender: '', state: '', lga: '' },
  });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const selectedState = watch('state');

  // Read-only analysts can't create members; the server rejects it too.
  if (!canWrite) return <Navigate to="/members" replace />;

  const onSubmit = async (values: FormValues) => {
    setError('');
    setLoading(true);
    try {
      const member = await createMember({
        fullName: values.fullName,
        email: values.email,
        phone: values.phone,
        dateOfBirth: values.dateOfBirth || null,
        gender: values.gender,
        channel: values.channel,
        bloodGroup: values.bloodGroup,
        allergies: toArray(values.allergies),
        chronicConditions: toArray(values.chronicConditions),
        currentMedications: toArray(values.currentMedications),
        address: values.address,
        city: values.city,
        state: values.state,
        lga: values.lga,
      });
      queryClient.invalidateQueries({ queryKey: ['members'] });
      navigate(`/members/${member.id}`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create member');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Add member</h1>
          <p>Enrol an individual and capture their shared health profile.</p>
        </div>
        <Link to="/members" className="btn btn-secondary">Cancel</Link>
      </div>

      <form className="card card-pad form-card" onSubmit={handleSubmit(onSubmit)}>
        <div className="form-row">
          <div className="form-group">
            <label>Full name *</label>
            <input {...register('fullName', { required: true })} />
          </div>
          <div className="form-group">
            <label>Date of birth</label>
            <input type="date" {...register('dateOfBirth')} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Email</label>
            <input type="email" {...register('email')} />
          </div>
          <div className="form-group">
            <label>Phone</label>
            <input {...register('phone')} placeholder="+234…" />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Gender</label>
            <select {...register('gender')}>
              <option value="">Prefer not to say</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
            </select>
          </div>
          <div className="form-group">
            <label>Primary channel</label>
            <select {...register('channel')}>
              <option value="app">App</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="ussd">USSD</option>
              <option value="web">Web</option>
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Address <span className="muted">(for nearest-pharmacy routing)</span></label>
            <input {...register('address')} placeholder="e.g. 12 Awolowo Rd, Ikoyi" />
          </div>
          <div className="form-group">
            <label>City / town</label>
            <input {...register('city')} placeholder="e.g. Lagos" />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>State</label>
            <select {...register('state', { onChange: () => setValue('lga', '') })}>
              <option value="">Select state…</option>
              {NIGERIA_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Local Government Area</label>
            <select {...register('lga')} disabled={!selectedState}>
              <option value="">{selectedState ? 'Select LGA…' : 'Choose a state first'}</option>
              {lgasForState(selectedState).map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        </div>

        <h3 className="section-title">Health profile (EHR-lite)</h3>
        <div className="form-row">
          <div className="form-group">
            <label>Blood group</label>
            <input {...register('bloodGroup')} placeholder="e.g. O+" />
          </div>
          <div className="form-group">
            <label>Allergies <span className="muted">(comma-separated)</span></label>
            <input {...register('allergies')} placeholder="e.g. Penicillin, Peanuts" />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Chronic conditions <span className="muted">(comma-separated)</span></label>
            <input {...register('chronicConditions')} placeholder="e.g. Hypertension" />
          </div>
          <div className="form-group">
            <label>Current medications <span className="muted">(comma-separated)</span></label>
            <input {...register('currentMedications')} placeholder="e.g. Amlodipine 5mg" />
          </div>
        </div>

        {error && <div className="error-text">{error}</div>}
        <div className="form-actions">
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Saving…' : 'Create member'}
          </button>
        </div>
      </form>
    </div>
  );
}
