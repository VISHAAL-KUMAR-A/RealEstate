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
    path('properties-map-data/', views.properties_map_data,
         name='properties_map_data'),
    path('dashboard-stats/', views.dashboard_stats, name='dashboard_stats'),
    path('sync-property-data/', views.sync_property_data,
         name='sync_property_data'),
    path('watchlist/', views.user_watchlist, name='user_watchlist'),

    # AI Property Valuation endpoints
    path('property-valuation/', views.property_valuation,
         name='property_valuation'),
    path('properties/<int:property_id>/valuations/',
         views.property_valuations, name='property_valuations'),

    # Deal Pipeline endpoints
    path('deals/', views.deals, name='deals'),
    path('deals/<int:deal_id>/', views.deal_detail, name='deal_detail'),
    path('deals/move/', views.move_deal, name='move_deal'),
    path('deal-stages/', views.deal_stages, name='deal_stages'),
    path('deal-types/', views.deal_types, name='deal_types'),

    # Portfolio Management endpoints
    path('portfolio/', views.user_portfolio, name='user_portfolio'),
    path('portfolio/<int:property_id>/', views.portfolio_property_detail,
         name='portfolio_property_detail'),
    path('portfolio/transactions/', views.rental_transactions,
         name='rental_transactions'),
    path('portfolio/transactions/<int:transaction_id>/', views.rental_transaction_detail,
         name='rental_transaction_detail'),
    path('portfolio/metrics/', views.portfolio_metrics, name='portfolio_metrics'),
    path('portfolio/chart-data/', views.portfolio_performance_chart_data,
         name='portfolio_chart_data'),

    # AI Assistant endpoint
    path('chat/', views.ai_chat, name='ai_chat'),
]
