from django.urls import path

from apps.projects.views import (
    MyProjectListView,
    ProjectCommentListView,
    ProjectDetailView,
    ProjectFeatureToggleView,
    ProjectListView,
    ProjectUpvoteView,
)

app_name = "projects"

urlpatterns = [
    path("projects/", ProjectListView.as_view(), name="project_list"),
    path("projects/my/", MyProjectListView.as_view(), name="my_projects"),
    path("projects/<slug:slug>/", ProjectDetailView.as_view(), name="project_detail"),
    path("projects/<slug:slug>/upvote/", ProjectUpvoteView.as_view(), name="project_upvote"),
    path("projects/<slug:slug>/comments/", ProjectCommentListView.as_view(), name="project_comments"),
    path("projects/<slug:slug>/feature/", ProjectFeatureToggleView.as_view(), name="project_feature"),
    path("communities/<str:community_slug>/projects/<slug:slug>/feature/", ProjectFeatureToggleView.as_view(), name="community_project_feature"),
    path("communities/<str:community_slug>/projects/<uuid:project_id>/feature/", ProjectFeatureToggleView.as_view(), name="community_project_id_feature"),
]
