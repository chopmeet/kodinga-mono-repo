import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@kodinga-mono-repo/ui';
import { getName, useUser } from '@/utils/Utils';

function AdminDashboard() {
  const user = useUser();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Tableau de bord</h1>
      <Card>
        <CardHeader>
          <CardTitle>Bonjour {getName(user) || 'admin'}</CardTitle>
          <CardDescription>Page servie par DashboardLayout.</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

export default AdminDashboard;
