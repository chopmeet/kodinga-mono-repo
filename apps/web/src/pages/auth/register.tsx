import { ArrowUpRight, AtSign, Mail, MailCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";

import { Button, Input, InputPassword } from "@kodinga/ui";

import AuthWrapper from "./auth-wrapper";
import { FormAlert } from "./components/form-alert";
import { EmailSeparator, OAuthButtons } from "./components/oauth-buttons";
import { PasswordCheck } from "./components/password-check";
import UseRegisterForm from "./hooks/UseRegisterForm";

const linkClassName =
  "font-semibold text-brand hover:text-brand-hover hover:underline";

function Register() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const next = params.get("next");
  const loginFooter = (
    <>
      {t("auth.register.hasAccount")}{" "}
      <Link
        to={
          next ? `/auth/login?next=${encodeURIComponent(next)}` : "/auth/login"
        }
        className={linkClassName}
      >
        {t("auth.common.login")}
      </Link>
    </>
  );
  const {
    register,
    errors,
    formError,
    isLoading,
    password,
    syncUsername,
    onSubmit,
    sentTo,
    resend,
    isResending,
    resent,
    changeEmail,
  } = UseRegisterForm();

  if (sentTo) {
    return (
      <AuthWrapper
        panel="register"
        title={t("auth.common.checkEmails")}
        footer={loginFooter}
      >
        <div className="flex flex-col gap-5">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-brand/10 text-brand">
            <MailCheck className="size-6" />
          </div>
          <p className="text-[15px] leading-relaxed text-soft">
            {t("auth.register.sentBefore")}{" "}
            <strong className="font-semibold text-foreground">{sentTo}</strong>{" "}
            {t("auth.register.sentAfter")}
          </p>
          {formError && <FormAlert>{formError}</FormAlert>}
          {resent && (
            <FormAlert variant="success">{t("auth.register.resent")}</FormAlert>
          )}
          <p className="text-sm text-muted-foreground">
            {t("auth.common.nothingReceived")}{" "}
            <button
              type="button"
              onClick={resend}
              disabled={isResending}
              className="font-semibold text-brand hover:text-brand-hover hover:underline disabled:opacity-60"
            >
              {t("auth.common.resendLink")}
            </button>{" "}
            {t("auth.common.or")}{" "}
            <button
              type="button"
              onClick={changeEmail}
              className={linkClassName}
            >
              {t("auth.register.changeEmail")}
            </button>
          </p>
        </div>
      </AuthWrapper>
    );
  }

  return (
    <AuthWrapper
      panel="register"
      title={t("auth.register.title")}
      subtitle={t("auth.register.subtitle")}
      footer={loginFooter}
    >
      <OAuthButtons />

      <EmailSeparator />

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-2">
        {formError && <FormAlert>{formError}</FormAlert>}

        <div className="grid gap-x-3 sm:grid-cols-2">
          <Input
            id="register-first-name"
            label={t("auth.register.firstName")}
            autoComplete="given-name"
            required
            error={errors.first_name?.message}
            {...register("first_name", { onChange: syncUsername })}
          />
          <Input
            id="register-last-name"
            label={t("auth.register.lastName")}
            autoComplete="family-name"
            required
            error={errors.last_name?.message}
            {...register("last_name", { onChange: syncUsername })}
          />
        </div>

        <Input
          id="register-username"
          label={t("auth.register.username")}
          icon={<AtSign className="size-4" />}
          autoComplete="username"
          required
          fieldHelp={t("auth.register.usernameHelp")}
          error={errors.username?.message}
          {...register("username")}
        />

        <Input
          id="register-email"
          label={t("auth.common.email")}
          type="email"
          icon={<Mail className="size-4" />}
          autoComplete="email"
          required
          error={errors.email?.message}
          {...register("email")}
        />

        <InputPassword
          id="register-password"
          label={t("auth.common.password")}
          autoComplete="new-password"
          required
          error={errors.password?.message}
          {...register("password")}
        />
        {password.length > 0 && (
          <div className="mb-3">
            <PasswordCheck password={password} />
          </div>
        )}

        <div className="mt-1">
          <label
            htmlFor="register-terms"
            className="flex items-start gap-3 text-sm leading-relaxed text-soft"
          >
            <input
              id="register-terms"
              type="checkbox"
              className="mt-0.5 size-4 shrink-0 accent-(--primary)"
              aria-invalid={!!errors.terms_accepted}
              aria-describedby={
                errors.terms_accepted ? "register-terms-error" : undefined
              }
              {...register("terms_accepted")}
            />
            <span>{t("auth.register.terms")}</span>
          </label>
          {errors.terms_accepted && (
            <p
              id="register-terms-error"
              className="mt-1.5 text-sm text-red-600"
            >
              {errors.terms_accepted.message}
            </p>
          )}
        </div>

        <div className="mt-4">
          <Button
            type="submit"
            size="lg"
            className="w-full rounded-xl"
            isLoading={isLoading}
            disabled={isLoading}
          >
            {t("auth.register.submit")} <ArrowUpRight />
          </Button>
        </div>
      </form>
    </AuthWrapper>
  );
}

export default Register;
