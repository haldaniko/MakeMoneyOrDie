from django.urls import path

from . import api, bot_api
from .media import serve_cover


urlpatterns = [
    path("api/health", api.HealthView.as_view()),
    path("api/health-index", api.HealthIndexView.as_view()),
    path("api/posts", api.PublicPostsView.as_view()),
    path("api/posts/search", api.SearchPostsView.as_view()),
    path("api/posts/<slug:slug>", api.PublicPostView.as_view()),
    path("api/subscribe", api.SubscribeView.as_view()),
    path("api/unsubscribe", api.UnsubscribeView.as_view()),
    path("api/auth/login", api.LoginView.as_view()),
    path("api/auth/refresh", api.RefreshView.as_view()),
    path("api/auth/logout", api.LogoutView.as_view()),
    path("api/admin/posts", api.AdminPostsView.as_view()),
    path("api/admin/subscribers", api.AdminSubscribersView.as_view()),
    path("api/admin/posts/<slug:slug>", api.AdminPostView.as_view()),
    path("api/admin/media/covers", api.AdminMediaView.as_view()),
    path("api/admin/media/covers/<str:name>", api.AdminMediaDetailView.as_view()),
    path("api/admin/settings", api.AdminSettingsView.as_view()),
    path("api/ai/generate-article", api.GenerateArticleView.as_view()),
    path("uploads/covers/<str:name>", serve_cover),
    path("api/bot/v1/options/", bot_api.BotOptionsView.as_view()),
    path("api/bot/v1/articles/", bot_api.BotArticlesView.as_view()),
    path("api/bot/v1/articles/<uuid:external_id>/", bot_api.BotArticleView.as_view()),
    path("api/bot/v1/articles/<uuid:external_id>/image/", bot_api.BotArticleImageView.as_view()),
    path("api/bot/v1/articles/<uuid:external_id>/publish/", bot_api.BotPublishView.as_view()),
]
