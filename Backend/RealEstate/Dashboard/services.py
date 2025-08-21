import requests
import logging
from django.conf import settings
from django.utils import timezone
from decimal import Decimal
from .models import Property, InvestmentMetrics
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)


class AttomAPIService:
    """Service for integrating with ATTOM Data API"""

    BASE_URL = "https://api.gateway.attomdata.com"

    def __init__(self):
        self.api_key = settings.ATTOM_API_KEY
        if not self.api_key:
            raise ValueError("ATTOM_API_KEY not found in settings")

    def _make_request(self, endpoint: str, params: Dict = None) -> Optional[Dict]:
        """Make authenticated request to ATTOM API"""
        headers = {
            'accept': 'application/json',
            'apikey': self.api_key
        }

        url = f"{self.BASE_URL}{endpoint}"
        logger.info(f"ATTOM API request: {url} with params: {params}")

        try:
            response = requests.get(
                url, headers=headers, params=params or {}, timeout=15)
            logger.info(f"ATTOM API response status: {response.status_code}")

            if response.status_code != 200:
                logger.error(f"ATTOM API error response: {response.text}")
                return None

            response_data = response.json()

            # Check if ATTOM returns "SuccessWithoutResult"
            if (response_data.get('status', {}).get('msg') == 'SuccessWithoutResult' or
                    response_data.get('status', {}).get('total', 0) == 0):
                logger.warning(
                    f"ATTOM API returned no results for {endpoint} with params {params}")
                return None

            return response_data

        except requests.exceptions.RequestException as e:
            logger.error(f"ATTOM API request failed: {e}")
            return None

    def search_properties(self, address: str = None, city: str = None, state: str = None,
                          zip_code: str = None, page_size: int = 50) -> List[Dict]:
        """Search for properties using ATTOM API with correct parameters"""

        # Convert state to abbreviation if needed
        if state:
            state_abbr = self._get_state_abbreviation(state)
        else:
            state_abbr = state

        logger.info(
            f"Searching ATTOM properties for city={city}, state={state_abbr}, zip={zip_code}")

        # Try ATTOM API endpoints with correct parameters
        endpoints_to_try = [
            # Try expanded profile search (working)
            ("/propertyapi/v1.0.0/property/expandedprofile",
             self._build_address_params),
            # Try basic profile (working)
            ("/propertyapi/v1.0.0/property/basicprofile", self._build_address_params),
            # Try assessment search (working)
            ("/propertyapi/v1.0.0/assessment/detail", self._build_address_params),
        ]

        for endpoint, param_builder in endpoints_to_try:
            try:
                params = param_builder(city, state_abbr, zip_code, page_size)
                if not params:  # Skip if no valid parameters
                    continue

                data = self._make_request(endpoint, params)

                if data and self._extract_properties(data):
                    properties = self._extract_properties(data)
                    logger.info(
                        f"Found {len(properties)} properties via {endpoint}")
                    return properties

            except Exception as e:
                logger.error(f"Error trying endpoint {endpoint}: {e}")
                continue

        logger.warning("All ATTOM API endpoints failed - no data available")
        return []

    def _get_state_abbreviation(self, state: str) -> str:
        """Convert full state name to abbreviation"""
        state_mapping = {
            'california': 'CA', 'new york': 'NY', 'florida': 'FL',
            'texas': 'TX', 'georgia': 'GA', 'illinois': 'IL',
            'arizona': 'AZ', 'colorado': 'CO', 'north carolina': 'NC',
            'tennessee': 'TN', 'washington': 'WA', 'oregon': 'OR',
            'nevada': 'NV', 'utah': 'UT', 'ohio': 'OH', 'michigan': 'MI',
            'delaware': 'DE', 'maryland': 'MD', 'virginia': 'VA'
        }
        return state_mapping.get(state.lower(), state)

    def _build_address_params(self, city: str, state: str, zip_code: str, page_size: int) -> Dict:
        """Build parameters using address1 and address2 format that works"""
        params = {}

        # For city searches, we need to construct a generic address
        # Since ATTOM needs specific addresses, we'll use postal code when available
        if zip_code:
            params['postalcode'] = zip_code
        elif city and state:
            # Use a generic street address format for city searches
            params['address2'] = f"{city}, {state}"
            # Try with a generic address - this might return multiple properties
            params['address1'] = "Main St"  # Generic street for area search
        else:
            return {}  # No valid parameters

        if page_size:
            params['pagesize'] = min(page_size, 100)

        return params

    def _extract_properties(self, data: Dict) -> List[Dict]:
        """Extract property data from ATTOM API response"""
        if not data:
            return []

        # Handle different response structures
        if 'property' in data:
            properties = data['property']
            if isinstance(properties, list):
                return properties
            elif isinstance(properties, dict):
                return [properties]

        return []


class PropertyDataSyncer:
    """Main service for syncing property data from ATTOM API ONLY"""

    def __init__(self):
        self.attom_service = AttomAPIService()

    def sync_properties_by_location(self, city: str, state: str, limit: int = 50) -> List[Property]:
        """Sync properties from ATTOM API - NO FALLBACK DATA"""
        properties = []

        logger.info(
            f"Starting ATTOM API property sync for {city}, {state} with limit {limit}")

        try:
            property_data_list = self.attom_service.search_properties(
                city=city, state=state, page_size=limit
            )

            if property_data_list:
                logger.info(
                    f"ATTOM API returned {len(property_data_list)} properties")

                for property_data in property_data_list:
                    property_obj = self._sync_attom_property(
                        property_data, city, state)
                    if property_obj:
                        properties.append(property_obj)
                        self.calculate_investment_metrics(property_obj)

                logger.info(
                    f"Successfully synced {len(properties)} properties from ATTOM")
            else:
                logger.warning(
                    f"No properties found via ATTOM API for {city}, {state}")

        except Exception as e:
            logger.error(f"Error accessing ATTOM API: {e}")

        return properties

    def _sync_attom_property(self, property_data: Dict, city: str, state: str) -> Optional[Property]:
        """Convert ATTOM API response to Property model"""
        try:
            # Extract data from real ATTOM API response structure
            address_info = property_data.get('address', {})
            summary_info = property_data.get('summary', {})
            building_info = property_data.get('building', {})
            assessment_info = property_data.get('assessment', {})
            sale_info = property_data.get('sale', {})
            location_info = property_data.get('location', {})

            # Extract address information
            address_line = address_info.get('line1', '')
            if not address_line:
                logger.warning("No address found in ATTOM response")
                return None

            prop_city = address_info.get('locality', '')
            prop_state = address_info.get('countrySubd', '')
            zip_code = address_info.get('postal1', '')

            # Extract coordinates
            latitude = location_info.get('latitude')
            longitude = location_info.get('longitude')
            if latitude:
                latitude = Decimal(str(latitude))
            if longitude:
                longitude = Decimal(str(longitude))

            # Extract property details
            property_type = summary_info.get(
                'propertyType', 'Single Family Residence')
            year_built = summary_info.get('yearBuilt')

            # Extract building details
            size_info = building_info.get('size', {})
            rooms_info = building_info.get('rooms', {})

            square_feet = size_info.get(
                'livingSize') or size_info.get('bldgSize')
            bedrooms = rooms_info.get('beds')
            bathrooms = rooms_info.get('bathsTotal')

            # Extract pricing information
            current_price = None
            estimated_value = None

            # Try to get sale price
            if sale_info:
                amount_info = sale_info.get('amount', {})
                if amount_info:
                    current_price = amount_info.get('saleAmt')
                else:
                    # Try alternative structure
                    sale_amount_data = sale_info.get('saleAmountData', {})
                    if sale_amount_data:
                        current_price = sale_amount_data.get('saleAmt')

            # Try to get market value from assessment
            if assessment_info:
                market_info = assessment_info.get('market', {})
                if market_info:
                    estimated_value = market_info.get('mktTtlValue')

            # Convert to Decimal
            if current_price:
                current_price = Decimal(str(current_price))
            if estimated_value:
                estimated_value = Decimal(str(estimated_value))

            # Estimate rent based on market data (1% rule + location adjustments)
            estimated_rent = None
            price_for_rent = current_price or estimated_value
            if price_for_rent:
                # Base 1% rule, but adjust by location and property type
                base_rent_ratio = Decimal('0.01')

                # Location adjustments for rental yields
                city_adjustments = {
                    'denver': Decimal('0.012'),    # Higher rental yields
                    'atlanta': Decimal('0.015'),   # Strong rental market
                    'phoenix': Decimal('0.013'),   # Good investment market
                    # Lower yields, higher appreciation
                    'miami': Decimal('0.008'),
                    'chicago': Decimal('0.011'),   # Stable rental market
                }

                rent_ratio = city_adjustments.get(
                    prop_city.lower(), base_rent_ratio)
                estimated_rent = price_for_rent * rent_ratio

            # Create or update property
            property_obj, created = Property.objects.get_or_create(
                address=address_line,
                city=prop_city,
                state=prop_state,
                defaults={
                    'zip_code': zip_code,
                    'latitude': latitude,
                    'longitude': longitude,
                    'property_type': property_type,
                    'bedrooms': int(bedrooms) if bedrooms else None,
                    'bathrooms': Decimal(str(bathrooms)) if bathrooms else None,
                    'square_feet': int(square_feet) if square_feet else None,
                    'year_built': int(year_built) if year_built else None,
                    'current_price': current_price,
                    'estimated_value': estimated_value,
                    'estimated_rent': estimated_rent,
                    'days_on_market': None,  # Not available in ATTOM response
                    'last_api_sync': timezone.now()
                }
            )

            logger.info(
                f"Created/updated property from ATTOM: {property_obj.address}")

            # Always calculate investment metrics for new/updated properties
            self.calculate_investment_metrics(property_obj)

            return property_obj

        except Exception as e:
            logger.error(f"Error syncing ATTOM property data: {e}")
            return None

    def calculate_investment_metrics(self, property_obj: Property):
        """Calculate investment metrics for a property"""
        metrics, created = InvestmentMetrics.objects.get_or_create(
            property_ref=property_obj)
        metrics.calculate_metrics()
        return metrics

    def bulk_sync_attom_data(self):
        """Sync real ATTOM data from multiple markets"""
        sample_markets = [
            ('Atlanta', 'GA'),
            ('Phoenix', 'AZ'),
            ('Dallas', 'TX'),
            ('Miami', 'FL'),
            ('Denver', 'CO'),
            ('Los Angeles', 'CA'),
            ('Orlando', 'FL'),
            ('Chicago', 'IL')
        ]

        all_properties = []
        for city, state in sample_markets:
            logger.info(f"Syncing ATTOM properties from {city}, {state}")
            properties = self.sync_properties_by_location(
                city, state, limit=20)
            all_properties.extend(properties)

        return all_properties
