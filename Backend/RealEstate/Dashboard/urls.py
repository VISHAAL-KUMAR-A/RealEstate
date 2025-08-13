from django.urls import path
from . import views

urlpatterns = [
    path('auth/me/', views.me, name='auth_me'),
    path('auth/signup/', views.signup, name='auth_signup'),
    path('auth/logout/', views.logout, name='auth_logout'),
]
