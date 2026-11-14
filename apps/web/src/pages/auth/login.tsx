import { ArrowUpRight, Mail } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";

import { Button, Input, InputPassword } from "@kodinga/ui";

import AuthWrapper from "./auth-wrapper";
import { FormAlert } from "./components/form-alert";
import { EmailSeparator, OAuthButtons } from "./components/oauth-buttons";
import UseLoginForm from "./hooks/UseLoginForm";
import { GoKey } from "react-icons/go";

function Login() {
  const { t } = useTranslation();
  const { register, errors, formError, onSubmit, isLoading } = UseLoginForm();
  const [params] = useSearchParams();
  const next = params.get("next");

  return (
    <AuthWrapper
      title={t("auth.login.title")}
      subtitle={t("auth.login.subtitle")}
      footer={
        <p>
          {t("auth.login.noAccount")}{" "}
          <Link
            to={
              next
                ? `/auth/register?next=${encodeURIComponent(next)}`
                : "/auth/register"
            }
            className="font-semibold text-brand hover:text-brand-hover hover:underline"
          >
            {t("auth.login.signup")}
          </Link>
        </p>
      }
    >
      <OAuthButtons />
      <EmailSeparator />

      <form onSubmit={onSubmit} noValidate>
        <div className="form-content flex flex-col gap-2">
          {formError && <FormAlert>{formError}</FormAlert>}

          <Input
            id="__login_email"
            label={t("auth.common.email")}
            type="email"
            icon={<Mail className="size-4" />}
            autoComplete="email"
            required
            error={errors.email?.message}
            {...register("email")}
          />

          {/* "Mot de passe oublié ?" on the line of the label */}
          <div className="relative">
            <InputPassword
              id="__login_password"
              label={t("auth.common.password")}
              autoComplete="current-password"
              icon={<GoKey />}
              required
              error={errors.password?.message}
              {...register("password")}
            />
            <Link
              to="/auth/forgot-password"
              className="absolute top-0 right-0 text-sm font-medium text-brand hover:text-brand-hover hover:underline"
            >
              {t("auth.login.forgot")}
            </Link>
          </div>

          <div className="mt-3">
            <Button
              type="submit"
              size="lg"
              className="w-full rounded-xl"
              isLoading={isLoading}
              disabled={isLoading}
            >
              {t("auth.login.submit")} <ArrowUpRight />
            </Button>
          </div>
        </div>
      </form>
    </AuthWrapper>
  );
}

export default Login;
