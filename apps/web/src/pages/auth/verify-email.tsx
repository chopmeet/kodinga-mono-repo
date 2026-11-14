import { ArrowUpRight, CircleCheck, Mail } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";

import { Button, Input, Loader } from "@kodinga/ui";
import {
  useResendVerificationMutation,
  useVerifyEmailMutation,
} from "@/utils/api/auth/auth.api";
import { parseApiError } from "@/utils/api/errors";
import AuthWrapper from "./auth-wrapper";
import { FormAlert } from "./components/form-alert";

const linkClassName =
  "font-semibold text-brand hover:text-brand-hover hover:underline";

/** Asks for a new link when the emailed one is invalid or expired */
function ResendLink() {
  const { t } = useTranslation();
  const [resendVerification, { isLoading }] = useResendVerificationMutation();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError(t("auth.validation.emailInvalid"));
      return;
    }
    setError(null);
    try {
      await resendVerification({ email: email.trim().toLowerCase() }).unwrap();
      setSent(true);
    } catch (err) {
      setError(parseApiError(err).message);
    }
  };

  if (sent) {
    return <FormAlert variant="success">{t("auth.verify.resent")}</FormAlert>;
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-2">
      <Input
        id="verify-resend-email"
        label={t("auth.verify.resendLabel")}
        type="email"
        icon={<Mail className="size-4" />}
        autoComplete="email"
        placeholder={t("auth.verify.resendPlaceholder")}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={error ?? undefined}
      />
      <Button
        type="submit"
        size="lg"
        className="w-full rounded-xl"
        isLoading={isLoading}
        disabled={isLoading}
      >
        {t("auth.common.resendLink")} <ArrowUpRight />
      </Button>
    </form>
  );
}

/** /auth/verify-email?token=… — the link of the registration email */
function VerifyEmail() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [verifyEmail] = useVerifyEmailMutation();
  const [status, setStatus] = useState<"pending" | "done" | "invalid">(
    token.length < 10 ? "invalid" : "pending",
  );
  const [firstName, setFirstName] = useState("");
  const [error, setError] = useState<string | null>(null);
  // StrictMode runs effects twice in dev: a token is single use
  const started = useRef(false);

  useEffect(() => {
    if (status !== "pending" || started.current) return;
    started.current = true;
    verifyEmail({ token })
      .unwrap()
      .then((user) => {
        setFirstName(user.first_name);
        setStatus("done");
      })
      .catch((err) => {
        const { code, message } = parseApiError(err);
        if (code !== "invalid_verification_token") setError(message);
        setStatus("invalid");
      });
  }, [status, token, verifyEmail]);

  if (status === "pending") {
    return (
      <AuthWrapper title={t("auth.verify.pendingTitle")}>
        <Loader
          inline
          size="sm"
          className="py-6"
          message={t("auth.verify.pending")}
        />
      </AuthWrapper>
    );
  }

  if (status === "done") {
    return (
      <AuthWrapper
        title={
          firstName
            ? t("auth.verify.welcome", { name: firstName })
            : t("auth.verify.verified")
        }
      >
        <div className="flex flex-col gap-6">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <CircleCheck className="size-6" />
          </div>
          <p className="text-[15px] leading-relaxed text-soft">
            {t("auth.verify.done")}
          </p>
          <Link
            to="/auth/login"
            className="flex h-13 w-full items-center justify-center rounded-xl bg-brand text-base font-semibold text-white shadow-sm hover:bg-brand-hover"
          >
            {t("auth.common.login")}
          </Link>
        </div>
      </AuthWrapper>
    );
  }

  return (
    <AuthWrapper
      title={t("auth.common.invalidLink")}
      footer={
        <Link to="/auth/login" className={linkClassName}>
          {t("auth.common.backToLogin")}
        </Link>
      }
    >
      <div className="flex flex-col gap-5">
        <FormAlert>{error ?? t("auth.verify.invalid")}</FormAlert>
        <p className="text-[15px] text-soft">{t("auth.common.singleUse")}</p>
        <ResendLink />
      </div>
    </AuthWrapper>
  );
}

export default VerifyEmail;
