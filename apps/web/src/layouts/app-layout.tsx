import { Outlet, useLocation } from 'react-router-dom';

import { AIAssistantWidget } from '@/components/ai-assistant/ai-assistant-widget';
import Footer from './components/footer';
import Header from './components/header';

function AppLayout() {
  // Messages: the floating button would cover the send button of the conversation
  const { pathname } = useLocation();
  const withAssistant = !pathname.startsWith('/messages');
  return (
    <div className="flex min-h-svh flex-col">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      {withAssistant && <AIAssistantWidget />}
    </div>
  );
}

export default AppLayout;

