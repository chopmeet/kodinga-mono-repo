import { Outlet } from 'react-router-dom';

import Footer from './components/footer';
import Header from './components/header';

function AppLayout() {
  return (
    <div className="flex min-h-svh flex-col">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

export default AppLayout;
