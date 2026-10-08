from django.urls import path
from apps.posts.views import (
    AcceptAnswerView,
    CommentDetailView,
    CommunityFeedView,
    CommunityPostCategoriesView,
    PostCommentsView,
    PostDetailView,
    ToggleCommentReactionView,
    TogglePostLockView,
    TogglePostPinView,
    TogglePostReactionView,
    VotePollView,
)

app_name = 'posts'

urlpatterns = [
    # Community feed and channels
    path('communities/<str:slug>/feed/', CommunityFeedView.as_view(), name='community_feed'),
    path('communities/<str:slug>/categories/', CommunityPostCategoriesView.as_view(), name='community_categories'),

    # Post actions
    path('posts/<uuid:post_id>/', PostDetailView.as_view(), name='post_detail'),
    path('posts/<uuid:post_id>/pin/', TogglePostPinView.as_view(), name='post_pin'),
    path('posts/<uuid:post_id>/lock/', TogglePostLockView.as_view(), name='post_lock'),
    path('posts/<uuid:post_id>/react/', TogglePostReactionView.as_view(), name='post_react'),
    path('posts/<uuid:post_id>/vote/', VotePollView.as_view(), name='post_vote_poll'),

    # Comments and answers
    path('posts/<uuid:post_id>/comments/', PostCommentsView.as_view(), name='post_comments'),
    path('comments/<uuid:comment_id>/', CommentDetailView.as_view(), name='comment_detail'),
    path('comments/<uuid:comment_id>/react/', ToggleCommentReactionView.as_view(), name='comment_react'),
    path('comments/<uuid:comment_id>/accept/', AcceptAnswerView.as_view(), name='comment_accept_answer'),
]
