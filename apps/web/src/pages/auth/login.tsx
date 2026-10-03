import { type FormEvent, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from '@kodinga-mono-repo/ui';
import { useAppDispatch } from '@/redux/hook';
import { onSetUserToken } from '@/redux/slice/User.slice';
import { useLoginUserMutation } from '@/utils/api/auth/auth.api';
import { isAdmin } from '@/utils/Utils';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginUser, { isLoading, isError }] = useLoginUserMutation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const res = await loginUser({ email, password });
    if ('data' in res && res.data) {
      dispatch(onSetUserToken({ user: res.data.user, token: res.data.access }));
      const fallback = isAdmin(res.data.user) ? '/admin/dashboard' : '/';
      navigate(params.get('next') || fallback, { replace: true });
    }
  };

  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Connexion</CardTitle>
          <CardDescription>Accédez à votre espace.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {isError && (
              <p className="text-sm text-destructive">Identifiants invalides.</p>
            )}
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Connexion…' : 'Se connecter'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default Login;
