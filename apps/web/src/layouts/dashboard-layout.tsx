import type { CSSProperties } from 'react';
import { Outlet } from 'react-router-dom';

import { SidebarInset, SidebarProvider } from '@kodinga-mono-repo/ui';
import { AIAssistantWidget } from '@/components/ai-assistant/ai-assistant-widget';
import DashboardFooter from './components/dashboard-footer';
import DashboardHeader from './components/dashboard-header';
import { DashboardSidebar } from './components/dashboard-sidebar';

function DashboardLayout() {
  return (
    <SidebarProvider
      style={{ '--sidebar-width': 'calc(var(--spacing) * 62)' } as CSSProperties}
    >
      <DashboardSidebar />
      <SidebarInset>
        <DashboardHeader />
        <div className="flex-1 p-4 md:p-6">
          <Outlet />
        </div>
        <DashboardFooter />
        <AIAssistantWidget />
      </SidebarInset>
    </SidebarProvider>
  );
}

export default DashboardLayout;

