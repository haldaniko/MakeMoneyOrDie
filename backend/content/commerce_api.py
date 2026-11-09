import stripe
from django.conf import settings
from django.core import signing
from django.http import FileResponse
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .commerce import (
    book_file, configure_stripe, create_checkout_session, download_token,
    fulfill_checkout_session, order_from_download_token, public_book_offer,
)
from .models import BookOrder


class BookOfferView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"data": public_book_offer()})


class BookCheckoutView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "checkout"

    def post(self, request):
        origin = request.headers.get("Origin", "").rstrip("/")
        site_url = origin if origin in settings.CORS_ALLOWED_ORIGINS else settings.SITE_URL
        try:
            session = create_checkout_session(site_url=site_url)
        except RuntimeError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except stripe.StripeError:
            return Response({"error": "Checkout is temporarily unavailable."}, status=status.HTTP_502_BAD_GATEWAY)
        return Response({"data": {"checkoutUrl": session.url}}, status=status.HTTP_201_CREATED)


class BookOrderStatusView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "checkout"

    def get(self, request, session_id):
        order = BookOrder.objects.filter(stripe_checkout_session_id=session_id).first()
        if not order:
            return Response({"error": "Order not found."}, status=status.HTTP_404_NOT_FOUND)
        if order.status != BookOrder.Status.PAID:
            try:
                configure_stripe()
                session = stripe.checkout.Session.retrieve(session_id)
                order = fulfill_checkout_session(session) or order
            except (RuntimeError, stripe.StripeError):
                pass
        data = {"status": order.status}
        if order.status == BookOrder.Status.PAID:
            token = download_token(order)
            data["downloadUrl"] = request.build_absolute_uri(f"/api/book/download/{token}")
        return Response({"data": data})


class StripeWebhookView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        if not settings.STRIPE_WEBHOOK_SECRET:
            return Response({"error": "Stripe webhook is not configured."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        try:
            event = stripe.Webhook.construct_event(
                request.body,
                request.headers.get("Stripe-Signature", ""),
                settings.STRIPE_WEBHOOK_SECRET,
            )
        except (ValueError, stripe.SignatureVerificationError):
            return Response({"error": "Invalid webhook signature."}, status=status.HTTP_400_BAD_REQUEST)
        if event["type"] in {"checkout.session.completed", "checkout.session.async_payment_succeeded"}:
            fulfill_checkout_session(event["data"]["object"])
        return Response({"received": True})


class BookDownloadView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, token):
        try:
            order = order_from_download_token(token)
        except signing.BadSignature:
            order = None
        if not order:
            return Response({"error": "This download link is invalid or has expired."}, status=status.HTTP_403_FORBIDDEN)
        try:
            path = book_file()
        except FileNotFoundError:
            return Response({"error": "The book file is temporarily unavailable."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return FileResponse(path.open("rb"), as_attachment=True, filename=path.name, content_type="application/pdf")
