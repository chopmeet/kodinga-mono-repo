from typing import Optional

from apps.accounts.models.user import User


class UserSelector:
    @staticmethod
    def get_by_id(user_id: str) -> Optional[User]:
        return User.objects.filter(id=user_id).first()

    @staticmethod
    def get_by_email(email: str) -> Optional[User]:
        return User.objects.filter(email=email.strip().lower()).first()

    @staticmethod
    def get_by_username(username: str) -> Optional[User]:
        return User.objects.filter(username=username.strip().lower()).first()
