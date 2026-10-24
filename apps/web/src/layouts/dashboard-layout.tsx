import type { CSSProperties, ReactNode } from 'react';
import { Outlet } from 'react-router-dom';

import { SidebarInset, SidebarProvider } from '@kodinga-mono-repo/ui';
import DashboardFooter from './components/dashboard-footer';
import DashboardHeader from './components/dashboard-header';
import { DashboardSidebar } from './components/dashboard-sidebar';

/**
 * Admin area, community spaces (/c/:slug) and the user's account (/account): no Kodinga assistant
 * here, it stays on the public pages. `children` replaces the Outlet when the page wraps it (account)
 */
function DashboardLayout({ children }: { children?: ReactNode }) {
  return (
    <SidebarProvider
      style={{ '--sidebar-width': 'calc(var(--spacing) * 62)' } as CSSProperties}
    >
      <DashboardSidebar />
      <SidebarInset>
        <DashboardHeader />
        <div className="flex-1 p-4 md:p-6">
          {children ?? <Outlet />}
        </div>
        <DashboardFooter />
      </SidebarInset>
    </SidebarProvider>
  );
}

export default DashboardLayout;

