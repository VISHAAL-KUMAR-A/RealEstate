from django.urls import path
from . import views

urlpatterns = [
    # Authentication endpoints
    path('auth/me/', views.me, name='auth_me'),
    path('auth/signup/', views.signup, name='auth_signup'),
    path('auth/logout/', views.logout, name='auth_logout'),

    # Dashboard endpoints
    path('investment-opportunities/', views.investment_opportunities,
         name='investment_opportunities'),
    path('properties/', views.properties, name='properties'),
    path('best-deals/', views.best_deals, name='best_deals'),
    path('dashboard-stats/', views.dashboard_stats, name='dashboard_stats'),
    path('sync-property-data/', views.sync_property_data,
         name='sync_property_data'),
    path('watchlist/', views.user_watchlist, name='user_watchlist'),
]
