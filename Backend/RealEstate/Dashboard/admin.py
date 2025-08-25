from django.contrib import admin
from .models import Property, InvestmentMetrics, UserWatchlist, MarketData, UserOwnedProperty, RentalTransaction, PortfolioMetrics


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


@admin.register(UserOwnedProperty)
class UserOwnedPropertyAdmin(admin.ModelAdmin):
    list_display = ('user', 'address', 'city', 'state', 'purchase_price',
                    'status', 'purchase_date')
    list_filter = ('status', 'purchase_date', 'custom_state')
    search_fields = ('user__username', 'custom_address', 'custom_city',
                     'property_ref__address')
    readonly_fields = ('created_at', 'updated_at')

    fieldsets = (
        ('Basic Information', {
            'fields': ('user', 'property_ref', 'status')
        }),
        ('Property Details', {
            'fields': ('custom_address', 'custom_city', 'custom_state',
                       'custom_zip_code', 'custom_property_type',
                       'custom_bedrooms', 'custom_bathrooms', 'custom_square_feet'),
            'description': 'Use these fields for properties not in the Property database'
        }),
        ('Purchase Information', {
            'fields': ('purchase_price', 'purchase_date', 'down_payment',
                       'loan_amount', 'interest_rate', 'loan_term_years')
        }),
        ('Current Values', {
            'fields': ('current_estimated_value', 'last_valuation_date')
        }),
        ('Rental Information', {
            'fields': ('monthly_rent', 'security_deposit', 'property_manager',
                       'management_fee_percent')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(RentalTransaction)
class RentalTransactionAdmin(admin.ModelAdmin):
    list_display = ('owned_property', 'transaction_type', 'category',
                    'amount', 'date', 'description')
    list_filter = ('transaction_type', 'category', 'date', 'receipt_uploaded')
    search_fields = ('owned_property__custom_address', 'description')
    readonly_fields = ('created_at', 'updated_at')
    date_hierarchy = 'date'

    fieldsets = (
        ('Transaction Details', {
            'fields': ('owned_property', 'transaction_type', 'category',
                       'amount', 'date', 'description')
        }),
        ('Receipt Information', {
            'fields': ('receipt_uploaded', 'receipt_file_path')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(PortfolioMetrics)
class PortfolioMetricsAdmin(admin.ModelAdmin):
    list_display = ('user', 'total_properties', 'portfolio_value',
                    'monthly_cash_flow', 'cash_on_cash_return', 'calculated_at')
    list_filter = ('calculated_at',)
    search_fields = ('user__username',)
    readonly_fields = ('calculated_at',)

    fieldsets = (
        ('Portfolio Overview', {
            'fields': ('user', 'total_properties', 'total_investment',
                       'portfolio_value', 'total_equity')
        }),
        ('Cash Flow', {
            'fields': ('total_monthly_income', 'total_monthly_expenses',
                       'monthly_cash_flow', 'annual_cash_flow')
        }),
        ('Performance Metrics', {
            'fields': ('total_appreciation', 'appreciation_percentage',
                       'cash_on_cash_return', 'total_return_percentage')
        }),
        ('Risk Assessment', {
            'fields': ('portfolio_cap_rate', 'diversification_score')
        }),
        ('Calculation Info', {
            'fields': ('calculated_at',),
            'classes': ('collapse',)
        }),
    )
