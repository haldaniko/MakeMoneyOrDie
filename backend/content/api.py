from django.db import connection
from django.db.models import Q
from django.http import Http404
from django.utils import timezone
from django.contrib.auth import authenticate, get_user_model
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny, IsAdminUser
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView, exception_handler

from .audit import audit
from .auth import (
    REFRESH_COOKIE, create_access_token, delete_refresh_session, get_refresh_session,
    issue_refresh_session, set_refresh_cookie, user_payload,
)
from .generation import generate_and_store_articles
from .generation_settings import SettingsInputSerializer, public_settings, save_settings
from .media import delete_cover, list_covers, save_cover
from .models import Post, Subscriber
from .serializers import PostSerializer


def _first_error(detail):
    if isinstance(detail, dict):
        return _first_error(next(iter(detail.values()), "Request failed."))
    if isinstance(detail, list):
        return _first_error(detail[0]) if detail else "Request failed."
    return str(detail)


def api_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is not None:
        response.data = {"error": _first_error(response.data)}
    return response


class HealthView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        return Response({"status": "ok", "service": "makemoneyordie-backend", "time": timezone.now().isoformat()})


class HealthIndexView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"data": {"status": "steady", "score": 82, "label": "Reader safety index", "updatedAt": timezone.now().isoformat()}})


class PublicPostsView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        posts = Post.objects.filter(status=Post.Status.PUBLISHED)
        return Response({"data": PostSerializer(posts, many=True).data})


class SearchPostsView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        from django.db.models import Q

        term = request.query_params.get("q", "").strip()
        posts = Post.objects.filter(status=Post.Status.PUBLISHED).filter(
            Q(title__icontains=term) | Q(excerpt__icontains=term) | Q(content_html__icontains=term)
        )[:30]
        return Response({"data": PostSerializer(posts, many=True).data})


class PublicPostView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, slug):
        post = Post.objects.filter(slug=slug, status=Post.Status.PUBLISHED).first()
        if not post:
            raise Http404("Post not found")
        return Response({"data": PostSerializer(post).data})


class SubscribeView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "newsletter"

    def post(self, request):
        email = serializers.EmailField().run_validation(request.data.get("email", "")).strip().lower()
        Subscriber.objects.get_or_create(email=email)
        return Response({"data": {"email": email}, "message": "You are subscribed."}, status=status.HTTP_201_CREATED)


class UnsubscribeView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "newsletter"

    def post(self, request):
        email = serializers.EmailField().run_validation(request.data.get("email", "")).strip().lower()
        Subscriber.objects.filter(email=email).delete()
        return Response({"data": {"ok": True}, "message": "Your newsletter subscription has been removed."})


class AdminSubscribersView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        subscribers = Subscriber.objects.order_by("-created_at")
        return Response({"data": [
            {"email": subscriber.email, "createdAt": subscriber.created_at.isoformat()}
            for subscriber in subscribers
        ]})


class LoginView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    def post(self, request):
        identifier = str(request.data.get("email", "")).strip()
        password = str(request.data.get("password", ""))
        candidates = get_user_model().objects.filter(
            Q(username__iexact=identifier) | Q(email__iexact=identifier),
            is_staff=True,
            is_active=True,
        ).order_by("date_joined")
        user = next(
            (authenticated for candidate in candidates
             if (authenticated := authenticate(request, username=candidate.username, password=password))),
            None,
        )
        if not user or not user.is_staff:
            audit("login_failed", metadata={"identifier": identifier})
            return Response({"error": "Invalid username, email, or password"}, status=status.HTTP_401_UNAUTHORIZED)
        token, csrf_token = issue_refresh_session(user)
        response = Response({"data": {"user": user_payload(user), "accessToken": create_access_token(user), "csrfToken": csrf_token}})
        set_refresh_cookie(response, token)
        audit("login_success", user)
        return response


class RefreshView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    def post(self, request):
        session = get_refresh_session(request.COOKIES.get(REFRESH_COOKIE), request.headers.get("x-csrf-token"))
        if not session:
            return Response({"error": "Session expired. Please sign in again."}, status=status.HTTP_401_UNAUTHORIZED)
        return Response({"data": {"accessToken": create_access_token(session.user), "user": user_payload(session.user)}})


class LogoutView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        delete_refresh_session(request.COOKIES.get(REFRESH_COOKIE))
        response = Response({"data": {"ok": True}})
        response.delete_cookie(REFRESH_COOKIE, path="/api/auth")
        return response


class AdminPostsView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        return Response({"data": PostSerializer(Post.objects.all(), many=True).data})

    def post(self, request):
        serializer = PostSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        post = serializer.save(source=Post.Source.ADMIN)
        audit("post_create", request.user, {"slug": post.slug})
        return Response({"data": PostSerializer(post).data}, status=status.HTTP_201_CREATED)


class AdminPostView(APIView):
    permission_classes = [IsAdminUser]

    def _post(self, slug):
        post = Post.objects.filter(slug=slug).first()
        if not post:
            raise Http404("Post not found")
        return post

    def put(self, request, slug):
        post = self._post(slug)
        serializer = PostSerializer(post, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        post = serializer.save(source=Post.Source.ADMIN)
        audit("post_update", request.user, {"slug": post.slug})
        return Response({"data": PostSerializer(post).data})

    def delete(self, request, slug):
        self._post(slug).delete()
        audit("post_delete", request.user, {"slug": slug})
        return Response({"data": {"ok": True}})


class AdminMediaView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        return Response({"data": list_covers()})

    def post(self, request):
        asset = save_cover(request.data.get("fileName", ""), request.data.get("dataUrl", ""))
        audit("media_create", request.user, {"name": asset["name"]})
        return Response({"data": asset}, status=status.HTTP_201_CREATED)


class AdminMediaDetailView(APIView):
    permission_classes = [IsAdminUser]

    def delete(self, request, name):
        delete_cover(name)
        audit("media_delete", request.user, {"name": name})
        return Response({"data": {"ok": True}})


class AdminSettingsView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        return Response({"data": public_settings()})

    def put(self, request):
        serializer = SettingsInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = save_settings(serializer.validated_data)
        audit("settings_update", request.user)
        return Response({"data": result})


class GenerateArticleView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request):
        count = serializers.IntegerField(min_value=1, max_value=3).run_validation(request.data.get("count", 3))
        audit("generation_trigger", request.user, {"count": count})
        posts = generate_and_store_articles(count)
        return Response({"data": PostSerializer(posts, many=True).data}, status=status.HTTP_201_CREATED)
