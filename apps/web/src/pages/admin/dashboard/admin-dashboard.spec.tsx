import { render } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';

import store from '@/redux/store';
import AdminDashboard from './admin-dashboard';

const renderDashboard = () =>
  render(
    <Provider store={store}>
      <MemoryRouter>
        <AdminDashboard />
      </MemoryRouter>
    </Provider>
  );

describe('AdminDashboard', () => {
  it('renders the title, the key figures and every panel', () => {
    const { getByRole, getByText } = renderDashboard();
    expect(getByRole('heading', { name: 'Tableau de bord' })).toBeTruthy();
    expect(getByText('Communautés actives')).toBeTruthy();
    expect(getByText('4,9 M FCFA')).toBeTruthy();
    for (const panel of [
      'Croissance de la plateforme',
      'Top 6 des communautés',
      "Communautés par type d'accès",
      'Moyens de paiement',
      'Activités récentes',
    ]) {
      expect(getByRole('heading', { name: panel })).toBeTruthy();
    }
  });

  it('shows payment amounts as text, not only as bar lengths', () => {
    const { getByText } = renderDashboard();
    expect(getByText('1 890 000 FCFA')).toBeTruthy();
  });
});
