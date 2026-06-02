import { useProviderAuth } from '../../context/ProviderAuthContext';
import ProviderConsultsPage from './ProviderConsultsPage';
import ProviderDispensaryPage from './ProviderDispensaryPage';

// The provider's landing workspace depends on their role: clinicians get the
// consultation queue, pharmacists get the dispensary.
export default function ProviderHome() {
  const { provider } = useProviderAuth();
  return provider?.role === 'pharmacist' ? <ProviderDispensaryPage /> : <ProviderConsultsPage />;
}
