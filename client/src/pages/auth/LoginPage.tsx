import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { loginUser } from '../../api/auth';
import { useAuth } from '../../context/AuthContext';
import './Auth.css';

interface FormValues {
  email: string;
  password: string;
}

export default function LoginPage() {
  const { register, handleSubmit } = useForm<FormValues>({
    defaultValues: { email: 'admin@axamansard.demo', password: 'password123' },
  });
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (values: FormValues) => {
    setError('');
    setLoading(true);
    try {
      const res = await loginUser(values);
      login(res.token, res.user);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-hero">
        <div className="logo-mark">M</div>
        <h1>The health platform behind Nigeria&rsquo;s insurers, employers &amp; telcos.</h1>
        <p>
          MobiCova connects your members to telemedicine, AI health guidance, and health-linked
          insurance — across app, WhatsApp, and USSD.
        </p>
        <ul>
          <li><span>✓</span> Telemedicine with licensed provider partners</li>
          <li><span>✓</span> AI symptom triage that guides members to the right care</li>
          <li><span>✓</span> Health-linked insurance distribution &amp; enrolment</li>
        </ul>
      </div>

      <div className="auth-form-side">
        <div className="auth-card">
          <h2>Partner sign in</h2>
          <p className="sub">Access your MobiCova health platform.</p>
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="form-group">
              <label>Work email</label>
              <input type="email" {...register('email', { required: true })} />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input type="password" {...register('password', { required: true })} />
            </div>
            {error && <div className="error-text">{error}</div>}
            <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
          <div className="demo-hint">
            <strong>Demo:</strong> admin@axamansard.demo / password123
          </div>
          <p className="auth-switch">
            New partner? <Link to="/register">Create an organisation</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
