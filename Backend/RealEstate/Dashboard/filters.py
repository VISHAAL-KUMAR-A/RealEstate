import django_filters
from django.db import models
from .models import Property, InvestmentMetrics


class PropertyFilter(django_filters.FilterSet):
    """Advanced filtering for properties with investment metrics"""

    # Location filters
    city = django_filters.CharFilter(lookup_expr='icontains')
    state = django_filters.CharFilter(lookup_expr='icontains')
    zip_code = django_filters.CharFilter(lookup_expr='icontains')

    # Property details
    property_type = django_filters.CharFilter(lookup_expr='icontains')
    min_bedrooms = django_filters.NumberFilter(
        field_name='bedrooms', lookup_expr='gte')
    max_bedrooms = django_filters.NumberFilter(
        field_name='bedrooms', lookup_expr='lte')
    min_bathrooms = django_filters.NumberFilter(
        field_name='bathrooms', lookup_expr='gte')
    max_bathrooms = django_filters.NumberFilter(
        field_name='bathrooms', lookup_expr='lte')
    min_square_feet = django_filters.NumberFilter(
        field_name='square_feet', lookup_expr='gte')
    max_square_feet = django_filters.NumberFilter(
        field_name='square_feet', lookup_expr='lte')
    min_year_built = django_filters.NumberFilter(
        field_name='year_built', lookup_expr='gte')
    max_year_built = django_filters.NumberFilter(
        field_name='year_built', lookup_expr='lte')

    # Financial filters
    min_price = django_filters.NumberFilter(
        field_name='current_price', lookup_expr='gte')
    max_price = django_filters.NumberFilter(
        field_name='current_price', lookup_expr='lte')
    min_estimated_value = django_filters.NumberFilter(
        field_name='estimated_value', lookup_expr='gte')
    max_estimated_value = django_filters.NumberFilter(
        field_name='estimated_value', lookup_expr='lte')
    min_estimated_rent = django_filters.NumberFilter(
        field_name='estimated_rent', lookup_expr='gte')
    max_estimated_rent = django_filters.NumberFilter(
        field_name='estimated_rent', lookup_expr='lte')
    min_annual_taxes = django_filters.NumberFilter(
        field_name='annual_taxes', lookup_expr='gte')
    max_annual_taxes = django_filters.NumberFilter(
        field_name='annual_taxes', lookup_expr='lte')

    # Investment metrics filters
    min_investment_score = django_filters.NumberFilter(
        field_name='metrics__investment_score', lookup_expr='gte')
    max_investment_score = django_filters.NumberFilter(
        field_name='metrics__investment_score', lookup_expr='lte')
    min_cap_rate = django_filters.NumberFilter(
        field_name='metrics__cap_rate', lookup_expr='gte')
    max_cap_rate = django_filters.NumberFilter(
        field_name='metrics__cap_rate', lookup_expr='lte')
    min_gross_rental_yield = django_filters.NumberFilter(
        field_name='metrics__gross_rental_yield', lookup_expr='gte')
    max_gross_rental_yield = django_filters.NumberFilter(
        field_name='metrics__gross_rental_yield', lookup_expr='lte')
    min_cash_on_cash_return = django_filters.NumberFilter(
        field_name='metrics__cash_on_cash_return', lookup_expr='gte')
    max_cash_on_cash_return = django_filters.NumberFilter(
        field_name='metrics__cash_on_cash_return', lookup_expr='lte')
    min_noi = django_filters.NumberFilter(
        field_name='metrics__net_operating_income', lookup_expr='gte')
    max_noi = django_filters.NumberFilter(
        field_name='metrics__net_operating_income', lookup_expr='lte')
    min_estimated_profit = django_filters.NumberFilter(
        field_name='metrics__estimated_profit', lookup_expr='gte')
    max_estimated_profit = django_filters.NumberFilter(
        field_name='metrics__estimated_profit', lookup_expr='lte')
    min_price_to_rent_ratio = django_filters.NumberFilter(
        field_name='metrics__price_to_rent_ratio', lookup_expr='gte')
    max_price_to_rent_ratio = django_filters.NumberFilter(
        field_name='metrics__price_to_rent_ratio', lookup_expr='lte')
    min_risk_score = django_filters.NumberFilter(
        field_name='metrics__risk_score', lookup_expr='gte')
    max_risk_score = django_filters.NumberFilter(
        field_name='metrics__risk_score', lookup_expr='lte')

    # ROI thresholds (calculated fields)
    min_roi = django_filters.NumberFilter(method='filter_min_roi')
    max_roi = django_filters.NumberFilter(method='filter_max_roi')

    # Special filters
    has_metrics = django_filters.BooleanFilter(
        field_name='metrics', lookup_expr='isnull', exclude=True)
    is_profitable = django_filters.BooleanFilter(method='filter_profitable')
    high_cap_rate = django_filters.BooleanFilter(method='filter_high_cap_rate')
    good_cash_flow = django_filters.BooleanFilter(
        method='filter_good_cash_flow')

    # Sorting options
    ordering = django_filters.OrderingFilter(
        fields=(
            ('metrics__investment_score', 'investment_score'),
            ('metrics__cap_rate', 'cap_rate'),
            ('metrics__gross_rental_yield', 'gross_rental_yield'),
            ('metrics__cash_on_cash_return', 'cash_on_cash_return'),
            ('metrics__net_operating_income', 'noi'),
            ('metrics__estimated_profit', 'estimated_profit'),
            ('metrics__price_to_rent_ratio', 'price_to_rent_ratio'),
            ('metrics__risk_score', 'risk_score'),
            ('current_price', 'price'),
            ('estimated_value', 'estimated_value'),
            ('estimated_rent', 'estimated_rent'),
            ('square_feet', 'square_feet'),
            ('year_built', 'year_built'),
            ('created_at', 'created_at'),
            ('last_api_sync', 'last_api_sync'),
        ),
        field_labels={
            'investment_score': 'Investment Score',
            'cap_rate': 'Cap Rate',
            'gross_rental_yield': 'Gross Rental Yield',
            'cash_on_cash_return': 'Cash-on-Cash Return',
            'noi': 'Net Operating Income',
            'estimated_profit': 'Estimated Profit',
            'price_to_rent_ratio': 'Price-to-Rent Ratio',
            'risk_score': 'Risk Score',
            'price': 'Current Price',
            'estimated_value': 'Estimated Value',
            'estimated_rent': 'Estimated Rent',
            'square_feet': 'Square Feet',
            'year_built': 'Year Built',
            'created_at': 'Date Added',
            'last_api_sync': 'Last Updated',
        }
    )

    class Meta:
        model = Property
        fields = []  # All fields are defined above

    def filter_min_roi(self, queryset, name, value):
        """Filter by minimum ROI (annualized return)"""
        return queryset.filter(
            models.Q(metrics__net_operating_income__isnull=False) &
            models.Q(current_price__isnull=False) &
            models.Q(current_price__gt=0)
        ).extra(
            where=["(metrics.net_operating_income / current_price * 100) >= %s"],
            params=[value]
        )

    def filter_max_roi(self, queryset, name, value):
        """Filter by maximum ROI (annualized return)"""
        return queryset.filter(
            models.Q(metrics__net_operating_income__isnull=False) &
            models.Q(current_price__isnull=False) &
            models.Q(current_price__gt=0)
        ).extra(
            where=["(metrics.net_operating_income / current_price * 100) <= %s"],
            params=[value]
        )

    def filter_profitable(self, queryset, name, value):
        """Filter only profitable properties"""
        if value:
            return queryset.filter(
                models.Q(metrics__net_operating_income__gt=0) |
                models.Q(metrics__estimated_profit__gt=0)
            )
        return queryset

    def filter_high_cap_rate(self, queryset, name, value):
        """Filter properties with cap rate >= 8%"""
        if value:
            return queryset.filter(metrics__cap_rate__gte=8.0)
        return queryset

    def filter_good_cash_flow(self, queryset, name, value):
        """Filter properties with positive monthly cash flow"""
        if value:
            return queryset.filter(metrics__net_operating_income__gt=0)
        return queryset
