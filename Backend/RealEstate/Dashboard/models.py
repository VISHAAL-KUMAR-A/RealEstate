from django.db import models
from django.contrib.auth.models import User
from decimal import Decimal


class Property(models.Model):
    """Core property information from external APIs"""
    # Basic property info
    address = models.CharField(max_length=500)
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=50)
    zip_code = models.CharField(max_length=20)
    latitude = models.DecimalField(
        max_digits=10, decimal_places=8, null=True, blank=True)
    longitude = models.DecimalField(
        max_digits=11, decimal_places=8, null=True, blank=True)

    # Property details
    # Single Family, Multi Family, etc.
    property_type = models.CharField(max_length=50)
    bedrooms = models.IntegerField(null=True, blank=True)
    bathrooms = models.DecimalField(
        max_digits=3, decimal_places=1, null=True, blank=True)
    square_feet = models.IntegerField(null=True, blank=True)
    lot_size = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True)
    year_built = models.IntegerField(null=True, blank=True)

    # Financial data
    current_price = models.DecimalField(
        max_digits=15, decimal_places=2, null=True, blank=True)
    estimated_value = models.DecimalField(
        max_digits=15, decimal_places=2, null=True, blank=True)
    tax_assessment = models.DecimalField(
        max_digits=15, decimal_places=2, null=True, blank=True)
    annual_taxes = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True)

    # Market data
    estimated_rent = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True)
    rent_per_sqft = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True)
    days_on_market = models.IntegerField(null=True, blank=True)

    # External API references
    attom_id = models.CharField(
        max_length=100, null=True, blank=True, unique=True)
    zillow_id = models.CharField(max_length=100, null=True, blank=True)
    mls_id = models.CharField(max_length=100, null=True, blank=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_api_sync = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=['city', 'state']),
            models.Index(fields=['property_type']),
            models.Index(fields=['current_price']),
            models.Index(fields=['estimated_rent']),
        ]

    def __str__(self):
        return f"{self.address}, {self.city}, {self.state}"


class InvestmentMetrics(models.Model):
    """Calculated investment metrics for each property"""
    property_ref = models.OneToOneField(
        Property, on_delete=models.CASCADE, related_name='metrics')

    # Investment calculations
    gross_rental_yield = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True)  # %
    net_operating_income = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True)  # NOI
    cap_rate = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True)  # %
    cash_on_cash_return = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True)  # %

    # Profitability metrics
    estimated_profit = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True)
    price_to_rent_ratio = models.DecimalField(
        max_digits=6, decimal_places=2, null=True, blank=True)

    # Risk assessment
    risk_score = models.DecimalField(
        max_digits=3, decimal_places=1, null=True, blank=True)  # 1-10 scale
    market_volatility = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True)

    # Composite ranking score
    investment_score = models.DecimalField(
        max_digits=6, decimal_places=2, null=True, blank=True)

    # Calculation metadata
    calculated_at = models.DateTimeField(auto_now=True)

    @property
    def annualized_return(self):
        """Calculate annualized return percentage"""
        if self.net_operating_income and self.property_ref.current_price:
            return (self.net_operating_income / self.property_ref.current_price) * 100
        return None

    def calculate_metrics(self):
        """Calculate all investment metrics for this property"""
        if not self.property_ref.current_price or not self.property_ref.estimated_rent:
            return

        annual_rent = self.property_ref.estimated_rent * 12

        # Gross Rental Yield
        self.gross_rental_yield = (
            annual_rent / self.property_ref.current_price) * 100

        # Estimate operating expenses (30% of rental income is a common rule)
        operating_expenses = annual_rent * Decimal('0.30')
        self.net_operating_income = annual_rent - operating_expenses

        # Cap Rate
        self.cap_rate = (self.net_operating_income /
                         self.property_ref.current_price) * 100

        # Price to Rent Ratio
        self.price_to_rent_ratio = self.property_ref.current_price / annual_rent

        # Estimated Profit - Try OpenAI prediction first, fallback to simple calculation
        ai_predicted_profit = self._get_ai_predicted_profit()
        if ai_predicted_profit is not None:
            self.estimated_profit = ai_predicted_profit
        elif self.property_ref.estimated_value and self.property_ref.current_price:
            # Fallback to simple calculation
            self.estimated_profit = self.property_ref.estimated_value - \
                self.property_ref.current_price

        # Simple risk score (lower price-to-rent ratio = lower risk)
        if self.price_to_rent_ratio:
            self.risk_score = min(
                10, max(1, float(self.price_to_rent_ratio) / 10))

        # Investment Score (sophisticated real estate investment scoring)
        score_components = {}

        # Cap Rate Component (Weight: 40%)
        if self.cap_rate:
            # 10% cap rate = 100 points
            cap_rate_score = min(100, max(0, float(self.cap_rate) * 10))
            score_components['cap_rate'] = cap_rate_score * 0.4

        # Cash Flow Component (Weight: 25%)
        if self.net_operating_income and self.property_ref.current_price:
            monthly_noi = float(self.net_operating_income) / 12
            # Score based on positive monthly cash flow
            # $100/month = 1 point
            cashflow_score = min(100, max(0, monthly_noi / 100))
            score_components['cashflow'] = cashflow_score * 0.25

        # Appreciation Potential (Weight: 20%) - Based on estimated profit
        if self.estimated_profit and self.property_ref.current_price:
            profit_percentage = (
                float(self.estimated_profit) / float(self.property_ref.current_price)) * 100
            # 50% profit = 100 points
            appreciation_score = min(100, max(0, profit_percentage * 2))
            score_components['appreciation'] = appreciation_score * 0.2

        # Market Efficiency (Weight: 10%)
        if self.price_to_rent_ratio:
            # Lower ratio = better deal
            # Ratio of 15 = 50 points
            efficiency_score = min(
                100, max(0, 200 - float(self.price_to_rent_ratio) * 10))
            score_components['efficiency'] = efficiency_score * 0.1

        # Risk Adjustment (Weight: 5%)
        if self.risk_score:
            risk_adjustment = (10 - float(self.risk_score)) * \
                10  # Lower risk = higher score
            score_components['risk'] = risk_adjustment * 0.05

        # Calculate final weighted score
        if score_components:
            self.investment_score = sum(score_components.values())
        else:
            self.investment_score = 0

        self.save()

    def _get_ai_predicted_profit(self):
        """Get AI-predicted profit using OpenAI service"""
        try:
            from .services import OpenAIProfitPredictor
            predictor = OpenAIProfitPredictor()
            return predictor.predict_potential_profit(self.property_ref)
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Could not get AI profit prediction: {e}")
            return None

    def __str__(self):
        return f"Metrics for {self.property_ref.address}"


class UserWatchlist(models.Model):
    """Properties a user is watching/interested in"""
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    property_ref = models.ForeignKey(Property, on_delete=models.CASCADE)
    added_at = models.DateTimeField(auto_now_add=True)
    notes = models.TextField(blank=True)

    class Meta:
        unique_together = ('user', 'property_ref')

    def __str__(self):
        return f"{self.user.username} watching {self.property_ref.address}"


class MarketData(models.Model):
    """General market data for regions/cities"""
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=50)

    # Market metrics
    median_home_price = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True)
    median_rent = models.DecimalField(
        max_digits=8, decimal_places=2, null=True, blank=True)
    price_trend = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True)  # % change
    rent_trend = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True)  # % change

    # Demographics
    population = models.IntegerField(null=True, blank=True)
    unemployment_rate = models.DecimalField(
        max_digits=4, decimal_places=2, null=True, blank=True)

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('city', 'state')

    def __str__(self):
        return f"Market data for {self.city}, {self.state}"
