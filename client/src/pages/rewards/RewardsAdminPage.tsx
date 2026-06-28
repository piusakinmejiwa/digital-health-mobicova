import { Navigate } from 'react-router-dom';
import RewardsManager from '../../components/rewards/RewardsManager';
import { tenantRewardsApi } from '../../api/rewards';
import { useAuth } from '../../context/AuthContext';
import '../admin/Admin.css';

// Company Admin's own rewards programme. Members also see MobiCova's global
// defaults on top of whatever's configured here.
export default function RewardsAdminPage() {
  const { user } = useAuth();
  if (user && user.role !== 'admin') return <Navigate to="/dashboard" replace />;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Rewards</h1>
          <p>Run your organisation’s rewards programme — challenges and redeemable rewards for your members. MobiCova’s defaults apply on top of yours.</p>
        </div>
      </div>
      <RewardsManager api={tenantRewardsApi} />
    </div>
  );
}
