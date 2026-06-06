import { useAuth } from '../../context/AuthContext';
import DashboardPage from './DashboardPage';
import SupplyDashboard from '../supply/SupplyDashboard';

// Routes /dashboard to the right home for the org's class: supply-side orgs
// (clinic/pharmacy) get the supply dashboard; everyone else the demand dashboard.
export default function DashboardHome() {
  const { user } = useAuth();
  return user?.orgClass === 'supply' ? <SupplyDashboard /> : <DashboardPage />;
}
