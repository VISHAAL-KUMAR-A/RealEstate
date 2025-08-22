import requests
import logging
import openai
import json
from django.conf import settings
from django.utils import timezone
from decimal import Decimal
from .models import Property, InvestmentMetrics
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)


class OpenAIProfitPredictor:
    """Service for AI-powered potential profit prediction using OpenAI"""

    def __init__(self):
        self.api_key = settings.OPENAI_API_KEY
        if not self.api_key:
            raise ValueError("OPENAI_API_KEY not found in settings")

    def predict_potential_profit(self, property_obj: Property) -> Optional[Decimal]:
        """
        Use OpenAI to predict potential profit based on property characteristics
        and market conditions
        """
        try:
            # Prepare property data for AI analysis
            property_data = self._prepare_property_data(property_obj)

            # Create the prompt for OpenAI
            prompt = self._create_profit_prediction_prompt(property_data)

            # Get prediction from OpenAI
            client = openai.OpenAI(api_key=self.api_key)

            response = client.chat.completions.create(
                model="gpt-4o-mini",  # More cost-effective model
                messages=[
                    {
                        "role": "system",
                        "content": "You are a professional real estate investment analyst with 20 years of experience. Provide realistic profit predictions based on current market conditions, property characteristics, and location factors."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                max_tokens=150,
                temperature=0.3  # Lower temperature for more consistent predictions
            )

            # Parse the response to extract the profit prediction
            prediction_text = response.choices[0].message.content.strip()
            predicted_profit = self._parse_profit_prediction(prediction_text)

            if predicted_profit is not None:
                logger.info(
                    f"OpenAI predicted profit for {property_obj.address}: ${predicted_profit}")
                return Decimal(str(predicted_profit))
            else:
                logger.warning(
                    f"Could not parse OpenAI profit prediction: {prediction_text}")
                return None

        except Exception as e:
            logger.error(
                f"OpenAI profit prediction failed for {property_obj.address}: {e}")
            return None

    def _prepare_property_data(self, property_obj: Property) -> Dict:
        """Prepare property data for AI analysis"""
        return {
            'address': property_obj.address,
            'city': property_obj.city,
            'state': property_obj.state,
            'property_type': property_obj.property_type,
            'year_built': property_obj.year_built,
            'bedrooms': property_obj.bedrooms,
            'bathrooms': float(property_obj.bathrooms) if property_obj.bathrooms else None,
            'square_feet': property_obj.square_feet,
            'lot_size': float(property_obj.lot_size) if property_obj.lot_size else None,
            'current_price': float(property_obj.current_price) if property_obj.current_price else None,
            'estimated_value': float(property_obj.estimated_value) if property_obj.estimated_value else None,
            'tax_assessment': float(property_obj.tax_assessment) if property_obj.tax_assessment else None,
            'annual_taxes': float(property_obj.annual_taxes) if property_obj.annual_taxes else None,
            'estimated_rent': float(property_obj.estimated_rent) if property_obj.estimated_rent else None
        }

    def _create_profit_prediction_prompt(self, property_data: Dict) -> str:
        """Create a detailed prompt for OpenAI profit prediction"""

        # Format financial values safely
        current_price_str = f"${property_data['current_price']:,.0f}" if property_data['current_price'] else 'N/A'
        estimated_value_str = f"${property_data['estimated_value']:,.0f}" if property_data['estimated_value'] else 'N/A'
        tax_assessment_str = f"${property_data['tax_assessment']:,.0f}" if property_data['tax_assessment'] else 'N/A'
        annual_taxes_str = f"${property_data['annual_taxes']:,.0f}" if property_data['annual_taxes'] else 'N/A'
        estimated_rent_str = f"${property_data['estimated_rent']:,.0f}" if property_data['estimated_rent'] else 'N/A'

        return f"""
Analyze this real estate investment property and predict the potential profit over 3-5 years:

PROPERTY DETAILS:
- Address: {property_data['address']}, {property_data['city']}, {property_data['state']}
- Type: {property_data['property_type']}
- Year Built: {property_data['year_built']}
- Size: {property_data['bedrooms']}bd/{property_data['bathrooms']}ba, {property_data['square_feet']} sqft
- Lot Size: {property_data['lot_size']} acres
- Current Sale Price: {current_price_str}
- Market Estimate: {estimated_value_str}
- Tax Assessment: {tax_assessment_str}
- Annual Taxes: {annual_taxes_str}
- Estimated Monthly Rent: {estimated_rent_str}

Consider these factors in your analysis:
1. Local market trends in {property_data['city']}, {property_data['state']}
2. Property age and condition (built {property_data['year_built']})
3. Rental income potential vs property value
4. Market appreciation trends
5. Tax implications and carrying costs

Provide ONLY a realistic potential profit prediction as a dollar amount (positive or negative). 
Format your response as: "Predicted Potential Profit: $XX,XXX"
Include a brief 2-sentence explanation of the key factors driving this prediction.
"""

    def _parse_profit_prediction(self, prediction_text: str) -> Optional[float]:
        """Parse the profit prediction from OpenAI response"""
        try:
            # Look for dollar amounts in the response
            import re

            logger.info(f"Parsing OpenAI response: {prediction_text}")

            # Enhanced pattern to match dollar amounts (with or without commas, with or without negative sign)
            dollar_patterns = [
                r'[-]?\$[\d,]+(?:\.[\d]{1,2})?',  # $1,250,000 or $-50,000
                r'[-]?[\d,]+(?:\.[\d]{1,2})?',    # 1,250,000 or -50,000
            ]

            for pattern in dollar_patterns:
                matches = re.findall(pattern, prediction_text)

                if matches:
                    # Take the first substantial dollar amount found
                    for match in matches:
                        # Clean the match
                        clean_amount = match.replace('$', '').replace(',', '')
                        try:
                            amount = float(clean_amount)
                            # Return amounts that seem reasonable (between -$2M and +$2M)
                            # At least $1,000
                            if -2000000 <= amount <= 2000000 and abs(amount) >= 1000:
                                logger.info(
                                    f"Parsed profit prediction: ${amount}")
                                return amount
                        except ValueError:
                            continue

            # Fallback: look for specific phrases
            prediction_lower = prediction_text.lower()
            if 'no profit' in prediction_lower or 'break even' in prediction_lower:
                return 0.0
            elif 'loss' in prediction_lower and 'profit' not in prediction_lower:
                return -10000.0  # Default small loss if we can't parse exact amount

            logger.warning(
                f"Could not parse any dollar amount from: {prediction_text}")
            return None

        except Exception as e:
            logger.error(f"Error parsing profit prediction: {e}")
            return None


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
        try:
            self.openai_predictor = OpenAIProfitPredictor()
        except ValueError as e:
            logger.warning(f"OpenAI service not available: {e}")
            self.openai_predictor = None

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
            logger.info(
                f"Processing ATTOM property data: {property_data.keys()}")

            # Extract data from real ATTOM API response structure
            address_info = property_data.get('address', {})
            summary_info = property_data.get('summary', {})
            building_info = property_data.get('building', {})
            assessment_info = property_data.get('assessment', {})
            sale_info = property_data.get('sale', {})
            location_info = property_data.get('location', {})
            lot_info = property_data.get('lot', {})
            identifier_info = property_data.get('identifier', {})

            # Extract address information
            address_line = address_info.get('line1', '')
            if not address_line:
                logger.warning("No address found in ATTOM response")
                return None

            prop_city = address_info.get('locality', '')
            prop_state = address_info.get('countrySubd', '')
            zip_code = address_info.get('postal1', '')

            # Extract ATTOM ID
            attom_id = identifier_info.get(
                'attomId') or identifier_info.get('Id')
            if attom_id:
                attom_id = str(attom_id)

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
            year_built = summary_info.get(
                'yearBuilt') or summary_info.get('yearbuilt')

            # Extract lot size
            lot_size = lot_info.get('lotSize1') or lot_info.get('lotsize1')
            if lot_size:
                lot_size = Decimal(str(lot_size))

            # Extract building details
            size_info = building_info.get('size', {})
            rooms_info = building_info.get('rooms', {})

            square_feet = size_info.get('livingSize') or size_info.get(
                'bldgSize') or size_info.get('livingsize') or size_info.get('bldgsize')
            bedrooms = rooms_info.get('beds')
            bathrooms = rooms_info.get(
                'bathsTotal') or rooms_info.get('bathstotal')

            # Extract pricing information
            current_price = None
            estimated_value = None
            tax_assessment = None
            annual_taxes = None

            # Try to get sale price - handle both response structures
            if sale_info:
                # Method 1: amount structure (expanded profile)
                amount_info = sale_info.get('amount', {})
                if amount_info:
                    current_price = amount_info.get('saleAmt')
                    logger.info(
                        f"Found sale price in amount structure: {current_price}")

                # Method 2: saleAmountData structure (basic profile)
                if not current_price:
                    sale_amount_data = sale_info.get('saleAmountData', {})
                    if sale_amount_data:
                        current_price = sale_amount_data.get('saleAmt')
                        logger.info(
                            f"Found sale price in saleAmountData: {current_price}")

            # Try to get market value and tax data from assessment
            if assessment_info:
                market_info = assessment_info.get('market', {})
                if market_info:
                    estimated_value = market_info.get('mktTtlValue')

                # Get assessed value for tax assessment
                assessed_info = assessment_info.get('assessed', {})
                if assessed_info:
                    tax_assessment = assessed_info.get('assdTtlValue')

                # Get tax information
                tax_info = assessment_info.get('tax', {})
                if tax_info:
                    annual_taxes = tax_info.get('taxAmt')

            # Convert to Decimal
            if current_price:
                current_price = Decimal(str(current_price))
                logger.info(
                    f"Converted current_price to Decimal: {current_price}")
            if estimated_value:
                estimated_value = Decimal(str(estimated_value))
            if tax_assessment:
                tax_assessment = Decimal(str(tax_assessment))
            if annual_taxes:
                annual_taxes = Decimal(str(annual_taxes))

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
                    'lot_size': lot_size,
                    'year_built': int(year_built) if year_built else None,
                    'current_price': current_price,
                    'estimated_value': estimated_value,
                    'tax_assessment': tax_assessment,
                    'annual_taxes': annual_taxes,
                    'estimated_rent': estimated_rent,
                    'attom_id': attom_id,
                    'days_on_market': None,  # Not available in ATTOM response
                    'last_api_sync': timezone.now()
                }
            )

            # If property already exists, update key fields
            if not created:
                property_obj.zip_code = zip_code or property_obj.zip_code
                property_obj.latitude = latitude or property_obj.latitude
                property_obj.longitude = longitude or property_obj.longitude
                property_obj.property_type = property_type or property_obj.property_type
                property_obj.bedrooms = int(
                    bedrooms) if bedrooms else property_obj.bedrooms
                property_obj.bathrooms = Decimal(
                    str(bathrooms)) if bathrooms else property_obj.bathrooms
                property_obj.square_feet = int(
                    square_feet) if square_feet else property_obj.square_feet
                property_obj.lot_size = lot_size or property_obj.lot_size
                property_obj.year_built = int(
                    year_built) if year_built else property_obj.year_built
                property_obj.current_price = current_price or property_obj.current_price
                property_obj.estimated_value = estimated_value or property_obj.estimated_value
                property_obj.tax_assessment = tax_assessment or property_obj.tax_assessment
                property_obj.annual_taxes = annual_taxes or property_obj.annual_taxes
                property_obj.estimated_rent = estimated_rent or property_obj.estimated_rent
                property_obj.attom_id = attom_id or property_obj.attom_id
                property_obj.last_api_sync = timezone.now()
                property_obj.save()

            logger.info(
                f"{'Created' if created else 'Updated'} property from ATTOM: {property_obj.address}")
            logger.info(
                f"Property details - Price: {current_price}, Bedrooms: {bedrooms}, Bathrooms: {bathrooms}, Sqft: {square_feet}")

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
