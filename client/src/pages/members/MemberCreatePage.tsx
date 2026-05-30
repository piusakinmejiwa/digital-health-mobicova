import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useQueryClient } from '@tanstack/react-query';
import { createMember } from '../../api/resources';
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
}

const toArray = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

export default function MemberCreatePage() {
  const { register, handleSubmit } = useForm<FormValues>({
    defaultValues: { channel: 'app', gender: '' },
  });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
