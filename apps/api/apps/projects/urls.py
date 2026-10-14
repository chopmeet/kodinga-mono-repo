from django.urls import path

from apps.projects.views import (
    MyProjectListView,
    ProjectCommentListView,
    ProjectDetailView,
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
]
