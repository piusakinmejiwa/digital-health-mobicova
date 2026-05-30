import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { registerUser } from '../../api/auth';
import { useAuth } from '../../context/AuthContext';
import './Auth.css';

interface FormValues {
  orgName: string;
  partnerType: string;
  fullName: string;
  email: string;
  password: string;
}

export default function RegisterPage() {
  const { register, handleSubmit } = useForm<FormValues>({
    defaultValues: { partnerType: 'employer' },
  });
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (values: FormValues) => {
    setError('');
    setLoading(true);
    try {
      const res = await registerUser(values);
      login(res.token, res.user);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-hero">
        <div className="logo-mark">M</div>
        <h1>Bring digital health to your members.</h1>
        <p>
          Onboard your organisation and start distributing telemedicine, AI health assistance,
          and health-linked insurance through MobiCova&rsquo;s platform.
        </p>
        <ul>
          <li><span>✓</span> For employers, insurers, telcos, fintechs &amp; cooperatives</li>
          <li><span>✓</span> Partnership-powered — connect to licensed providers</li>
          <li><span>✓</span> Recurring B2B platform model</li>
        </ul>
      </div>

      <div className="auth-form-side">
        <div className="auth-card">
          <h2>Create your organisation</h2>
          <p className="sub">Set up your MobiCova partner account.</p>
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="form-group">
              <label>Organisation name</label>
              <input {...register('orgName', { required: true })} placeholder="e.g. Acme Industries" />
            </div>
            <div className="form-group">
              <label>Partner type</label>
              <select {...register('partnerType')}>
                <option value="employer">Employer</option>
                <option value="insurer">Insurer / HMO</option>
                <option value="telco">Telco</option>
                <option value="fintech">Fintech</option>
                <option value="cooperative">Cooperative</option>
              </select>
            </div>
            <div className="form-group">
              <label>Your full name</label>
              <input {...register('fullName', { required: true })} />
            </div>
            <div className="form-group">
              <label>Work email</label>
              <input type="email" {...register('email', { required: true })} />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input type="password" {...register('password', { required: true, minLength: 8 })} placeholder="At least 8 characters" />
            </div>
            {error && <div className="error-text">{error}</div>}
            <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
              {loading ? 'Creating…' : 'Create organisation'}
            </button>
          </form>
          <p className="auth-switch">
            Already a partner? <Link to="/login">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
