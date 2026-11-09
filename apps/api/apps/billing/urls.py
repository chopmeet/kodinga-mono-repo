from django.urls import path

from apps.billing.views import (
    CancelSubscriptionView,
    CommunityPayoutsView,
    CommunityPlanDetailView,
    CommunityRevenueView,
    CommunitySubscribersView,
    CommunityTransactionsView,
    CreateCheckoutView,
    JoinAffiliateView,
    MyAffiliateView,
    MyPaymentsView,
    MySubscriptionsView,
    PayDunyaIPNView,
    PaymentStatusView,
    PlansListView,
    VerifyPaymentView,
)

app_name = "billing"

urlpatterns = [
    # Plans catalogue & Community plans management
    path("billing/plans/", PlansListView.as_view(), name="plans_list"),
    path(
        "billing/plans/<uuid:plan_id>/",
        CommunityPlanDetailView.as_view(),
        name="community_plan_detail",
    ),
    # PayDunya Checkout & Server IPN
    path("billing/checkout/", CreateCheckoutView.as_view(), name="create_checkout"),
    path("billing/paydunya/ipn/", PayDunyaIPNView.as_view(), name="paydunya_ipn"),
    # Subscriptions & Payments
    path(
        "billing/subscriptions/me/",
        MySubscriptionsView.as_view(),
        name="my_subscriptions",
    ),
    path(
        "billing/subscriptions/<uuid:subscription_id>/cancel/",
        CancelSubscriptionView.as_view(),
        name="cancel_subscription",
    ),
    path("billing/payments/my/", MyPaymentsView.as_view(), name="my_payments"),
    path(
        "billing/payments/<str:payment_id>/status/",
        PaymentStatusView.as_view(),
        name="payment_status",
    ),
    path(
        "billing/payments/<str:payment_id>/verify/",
        VerifyPaymentView.as_view(),
        name="verify_payment",
    ),
    # Community Creator Monitization & Financial Analytics
    path(
        "billing/communities/<str:community_slug>/subscribers/",
        CommunitySubscribersView.as_view(),
        name="community_subscribers",
    ),
    path(
        "billing/communities/<str:community_slug>/transactions/",
        CommunityTransactionsView.as_view(),
        name="community_transactions",
    ),
    path(
        "billing/communities/<str:community_slug>/revenue/",
        CommunityRevenueView.as_view(),
        name="community_revenue",
    ),
    path(
        "billing/communities/<str:community_slug>/payouts/",
        CommunityPayoutsView.as_view(),
        name="community_payouts",
    ),
    # Affiliate Program (50% commission on first paid subscription)
    path("billing/affiliate/me/", MyAffiliateView.as_view(), name="my_affiliate"),
    path("billing/affiliate/join/", JoinAffiliateView.as_view(), name="join_affiliate"),
]
