from pathlib import Path

import stripe
from django.conf import settings
from django.core import signing
from django.db import transaction
from django.utils import timezone

from .models import BookOrder


DOWNLOAD_SALT = "content.book-download"


def configure_stripe():
    if not settings.STRIPE_SECRET_KEY:
        raise RuntimeError("Stripe is not configured.")
    stripe.api_key = settings.STRIPE_SECRET_KEY


def public_book_offer():
    amount = settings.BOOK_PRICE_CENTS
    currency = settings.BOOK_CURRENCY.upper()
    symbols = {"EUR": "€", "USD": "$", "GBP": "£"}
    number = f"{amount / 100:.2f}".rstrip("0").rstrip(".")
    return {
        "title": settings.BOOK_TITLE,
        "price": f"{symbols.get(currency, currency + ' ')}{number}",
        "currency": currency,
    }


def create_checkout_session(site_url=None):
    configure_stripe()
    checkout_site_url = (site_url or settings.SITE_URL).rstrip("/")
    order = BookOrder.objects.create(
        amount_total=settings.BOOK_PRICE_CENTS,
        currency=settings.BOOK_CURRENCY,
    )
    try:
        session = stripe.checkout.Session.create(
            mode="payment",
            customer_creation="always",
            line_items=[{
                "quantity": 1,
                "price_data": {
                    "currency": settings.BOOK_CURRENCY,
                    "unit_amount": settings.BOOK_PRICE_CENTS,
                    "product_data": {
                        "name": settings.BOOK_TITLE,
                        "description": "Digital book · PDF · instant access after payment",
                    },
                },
            }],
            metadata={"book_order_id": str(order.id)},
            payment_intent_data={"metadata": {"book_order_id": str(order.id)}},
            success_url=f"{checkout_site_url}/book/success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{checkout_site_url}/?checkout=cancelled#book",
        )
    except Exception:
        order.delete()
        raise
    order.stripe_checkout_session_id = session.id
    order.save(update_fields=["stripe_checkout_session_id", "updated_at"])
    return session


@transaction.atomic
def fulfill_checkout_session(session):
    if session.get("payment_status") != "paid":
        return None
    order_id = (session.get("metadata") or {}).get("book_order_id")
    if not order_id:
        return None
    order = BookOrder.objects.select_for_update().filter(id=order_id).first()
    if not order or (order.stripe_checkout_session_id and order.stripe_checkout_session_id != session.id):
        return None
    details = session.get("customer_details") or {}
    order.stripe_checkout_session_id = session.id
    order.stripe_payment_intent_id = session.get("payment_intent") or ""
    order.customer_email = details.get("email") or session.get("customer_email") or ""
    order.status = BookOrder.Status.PAID
    order.paid_at = order.paid_at or timezone.now()
    order.save()
    return order


def download_token(order):
    return signing.dumps({"order_id": str(order.id)}, salt=DOWNLOAD_SALT, compress=True)


def order_from_download_token(token):
    payload = signing.loads(token, salt=DOWNLOAD_SALT, max_age=settings.BOOK_DOWNLOAD_MAX_AGE)
    return BookOrder.objects.filter(id=payload.get("order_id"), status=BookOrder.Status.PAID).first()


def book_file():
    path = Path(settings.BOOK_FILE_PATH).resolve()
    if not path.is_file():
        raise FileNotFoundError("The book file is not available.")
    return path
