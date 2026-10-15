import { Outlet } from 'react-router-dom';

import { AIAssistantWidget } from '@/components/ai-assistant/ai-assistant-widget';
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
      <AIAssistantWidget />
    </div>
  );
}

export default AppLayout;

