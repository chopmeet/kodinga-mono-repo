from apps.accounts.models.consent import UserConsent


class ConsentService:
    @staticmethod
    def record_consent(user, consent_type: str, policy_version: str = "1.0", granted: bool = True) -> UserConsent:
        return UserConsent.objects.create(
            user=user,
            consent_type=consent_type,
            policy_version=policy_version,
            granted=granted
        )
