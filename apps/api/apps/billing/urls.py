from django.urls import path
from apps.billing.views import (
    CreateCheckoutView,
    JoinAffiliateView,
    MyAffiliateView,
    MyPaymentsView,
    MySubscriptionsView,
    PayDunyaIPNView,
    PaymentStatusView,
    PlansListView,
)

app_name = 'billing'

urlpatterns = [
    # Plans catalogue
    path('billing/plans/', PlansListView.as_view(), name='plans_list'),

    # PayDunya Checkout & Server IPN
    path('billing/checkout/', CreateCheckoutView.as_view(), name='create_checkout'),
    path('billing/paydunya/ipn/', PayDunyaIPNView.as_view(), name='paydunya_ipn'),

    # Subscriptions & Payments
    path('billing/subscriptions/me/', MySubscriptionsView.as_view(), name='my_subscriptions'),
    path('billing/payments/my/', MyPaymentsView.as_view(), name='my_payments'),
    path('billing/payments/<uuid:payment_id>/status/', PaymentStatusView.as_view(), name='payment_status'),

    # Affiliate Program (50% commission on first paid subscription)
    path('billing/affiliate/me/', MyAffiliateView.as_view(), name='my_affiliate'),
    path('billing/affiliate/join/', JoinAffiliateView.as_view(), name='join_affiliate'),
]
