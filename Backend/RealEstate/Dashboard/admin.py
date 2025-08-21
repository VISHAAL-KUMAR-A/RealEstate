from django.contrib import admin
from .models import Property, InvestmentMetrics, UserWatchlist, MarketData


@admin.register(Property)
class PropertyAdmin(admin.ModelAdmin):
    list_display = ('address', 'city', 'state', 'property_type',
                    'current_price', 'estimated_rent')
    list_filter = ('property_type', 'city', 'state')
    search_fields = ('address', 'city', 'state', 'zip_code')
    readonly_fields = ('created_at', 'updated_at', 'last_api_sync')


@admin.register(InvestmentMetrics)
class InvestmentMetricsAdmin(admin.ModelAdmin):
    list_display = ('property_ref', 'investment_score', 'cap_rate',
                    'gross_rental_yield', 'calculated_at')
    list_filter = ('calculated_at',)
    readonly_fields = ('calculated_at',)


@admin.register(UserWatchlist)
class UserWatchlistAdmin(admin.ModelAdmin):
    list_display = ('user', 'property_ref', 'added_at')
    list_filter = ('added_at',)


@admin.register(MarketData)
class MarketDataAdmin(admin.ModelAdmin):
    list_display = ('city', 'state', 'median_home_price',
                    'median_rent', 'updated_at')
    list_filter = ('state', 'updated_at')
    search_fields = ('city', 'state')
