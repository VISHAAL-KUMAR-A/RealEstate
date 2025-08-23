import requests
import logging
import openai
import json
from django.conf import settings
from django.utils import timezone
from decimal import Decimal
from .models import Property, InvestmentMetrics, PropertyValuation
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


class PropertyValuationService:
    """AI-powered Property Valuation Service using OpenAI and ATTOM Data"""

    def __init__(self):
        self.attom_service = AttomAPIService()
        self.openai_api_key = settings.OPENAI_API_KEY
        if not self.openai_api_key:
            raise ValueError("OPENAI_API_KEY not found in settings")

    def get_property_valuation(self, property_obj: Property, user=None) -> Dict:
        """
        Get comprehensive property valuation including:
        - Fair Market Value estimation
        - Net Operating Income (NOI)
        - 5-Year ROI projection
        Save results to database for persistence and tracking.
        """
        # Create valuation record
        valuation_record = PropertyValuation.objects.create(
            property_ref=property_obj,
            requested_by=user,
            valuation_successful=False
        )

        try:
            # Fetch additional property data from ATTOM if needed
            property_metrics = self._fetch_property_metrics(property_obj)
            endpoints_used = list(property_metrics.keys()
                                  ) if property_metrics else []

            # Create comprehensive valuation prompt
            prompt = self._create_valuation_prompt(
                property_obj, property_metrics)

            # Get valuation from OpenAI
            client = openai.OpenAI(api_key=self.openai_api_key)

            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": """You are a senior real estate investment analyst with 15+ years of experience in property valuation and investment analysis. You have deep knowledge of:
                        - Comparable market analysis (CMA)
                        - Income capitalization approach
                        - Real estate investment metrics
                        - Market trends and appreciation patterns
                        - Operating expense ratios by property type and location
                        
                        Provide realistic, conservative estimates based on current market conditions."""
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                max_tokens=800,
                temperature=0.2  # Low temperature for consistent, conservative estimates
            )

            # Parse the AI response
            valuation_text = response.choices[0].message.content.strip()

            # Extract structured data from response
            valuation_data = self._parse_valuation_response(
                valuation_text, property_obj)

            # Save successful results to database
            valuation_record.fair_market_value = valuation_data.get(
                'fair_market_value')
            valuation_record.annual_noi = valuation_data.get('annual_noi')
            valuation_record.five_year_roi_percent = valuation_data.get(
                'five_year_roi_percent')
            valuation_record.monthly_gross_rent = valuation_data.get(
                'monthly_gross_rent')
            valuation_record.annual_operating_expenses = valuation_data.get(
                'annual_operating_expenses')
            valuation_record.annual_appreciation_rate = valuation_data.get(
                'annual_appreciation_rate')
            valuation_record.investment_recommendation = valuation_data.get(
                'investment_recommendation', '')[:500]  # Truncate to fit field
            valuation_record.analysis_summary = valuation_data.get(
                'analysis_summary', '')
            valuation_record.key_assumptions = valuation_data.get(
                'key_assumptions', '')
            valuation_record.raw_ai_response = valuation_text
            valuation_record.attom_endpoints_used = endpoints_used
            valuation_record.valuation_successful = True
            valuation_record.save()

            # Recalculate investment metrics to use the new AI-generated ROI
            try:
                metrics, created = InvestmentMetrics.objects.get_or_create(
                    property_ref=property_obj)
                metrics.calculate_metrics()
                logger.info(
                    f"Updated investment metrics with AI ROI for {property_obj.address}")
            except Exception as e:
                logger.warning(
                    f"Failed to update metrics after AI valuation: {e}")

            logger.info(
                f"Generated valuation for {property_obj.address}: FMV=${valuation_data.get('fair_market_value')}")

            return {
                'success': True,
                'property_id': property_obj.id,
                'valuation_id': valuation_record.id,
                'address': property_obj.address,
                'valuation_data': valuation_data,
                'raw_analysis': valuation_text,
                'generated_at': valuation_record.created_at.isoformat(),
                'attom_endpoints_used': endpoints_used
            }

        except Exception as e:
            # Save error details to database
            valuation_record.error_message = str(e)
            valuation_record.save()

            logger.error(
                f"Property valuation failed for {property_obj.address}: {e}")
            return {
                'success': False,
                'error': str(e),
                'property_id': property_obj.id,
                'valuation_id': valuation_record.id,
                'address': property_obj.address
            }

    def _fetch_property_metrics(self, property_obj: Property) -> Dict:
        """Fetch additional property metrics from ATTOM API if needed"""
        metrics = {}

        try:
            if property_obj.attom_id or (property_obj.address and property_obj.city and property_obj.state):
                # Use address to get fresh data from ATTOM
                address_params = {
                    'address1': property_obj.address,
                    'address2': f"{property_obj.city}, {property_obj.state}"
                }

                # Try to get rent comparables and recent sales
                endpoints_to_try = [
                    '/propertyapi/v1.0.0/property/expandedprofile',
                    '/propertyapi/v1.0.0/avm/detail',  # Automated Valuation Model
                    '/propertyapi/v1.0.0/sale/snapshot'  # Recent sales data
                ]

                for endpoint in endpoints_to_try:
                    try:
                        data = self.attom_service._make_request(
                            endpoint, address_params)
                        if data:
                            metrics[endpoint.split('/')[-1]] = data
                    except Exception as e:
                        logger.warning(f"Failed to fetch from {endpoint}: {e}")
                        continue

        except Exception as e:
            logger.warning(
                f"Could not fetch additional metrics for {property_obj.address}: {e}")

        return metrics

    def _create_valuation_prompt(self, property_obj: Property, additional_metrics: Dict) -> str:
        """Create comprehensive valuation prompt for OpenAI"""

        # Format property details
        price_str = f"${property_obj.current_price:,.0f}" if property_obj.current_price else 'Not Available'
        estimated_value_str = f"${property_obj.estimated_value:,.0f}" if property_obj.estimated_value else 'Not Available'
        tax_assessment_str = f"${property_obj.tax_assessment:,.0f}" if property_obj.tax_assessment else 'Not Available'
        annual_taxes_str = f"${property_obj.annual_taxes:,.0f}" if property_obj.annual_taxes else 'Not Available'
        estimated_rent_str = f"${property_obj.estimated_rent:,.0f}/month" if property_obj.estimated_rent else 'Not Available'

        prompt = f"""
PROPERTY VALUATION REQUEST

Please provide a comprehensive investment analysis for the following property:

=== PROPERTY DETAILS ===
Address: {property_obj.address}, {property_obj.city}, {property_obj.state} {property_obj.zip_code or ''}
Property Type: {property_obj.property_type}
Year Built: {property_obj.year_built or 'Unknown'}
Bedrooms: {property_obj.bedrooms or 'N/A'}
Bathrooms: {property_obj.bathrooms or 'N/A'}
Square Footage: {property_obj.square_feet or 'N/A'} sqft
Lot Size: {property_obj.lot_size or 'N/A'} acres

=== FINANCIAL DATA ===
Current Listed/Sale Price: {price_str}
Market Value Estimate: {estimated_value_str}
Tax Assessment Value: {tax_assessment_str}
Annual Property Taxes: {annual_taxes_str}
Estimated Monthly Rent: {estimated_rent_str}

=== ANALYSIS REQUEST ===
Based on current market conditions in {property_obj.city}, {property_obj.state} and the above property details, please provide:

1. **FAIR MARKET VALUE**: Your estimate of the current fair market value
2. **NET OPERATING INCOME (NOI)**: Annual NOI calculation (gross rent - operating expenses)
3. **5-YEAR ROI PROJECTION**: Expected total return on investment over 5 years

Consider these factors in your analysis:
- Local market trends in {property_obj.city}, {property_obj.state}
- Property condition based on age (built {property_obj.year_built or 'unknown'})
- Rental income potential vs. purchase price
- Operating expenses (maintenance, insurance, vacancy, property management)
- Property tax implications
- Market appreciation trends for similar properties
- Economic factors affecting the {property_obj.state} real estate market

=== RESPONSE FORMAT ===
Please structure your response as follows:

**FAIR MARKET VALUE:** $XXX,XXX
**ESTIMATED NOI:** $XX,XXX annually
**5-YEAR ROI PROJECTION:** XX.X%

**ANALYSIS SUMMARY:**
[Provide 3-4 sentences explaining key factors influencing these estimates]

**KEY ASSUMPTIONS:**
- Monthly gross rent: $X,XXX
- Annual operating expenses: $X,XXX (XX% of gross rent)
- Annual appreciation rate: X.X%
- Other relevant assumptions

**INVESTMENT RECOMMENDATION:**
[Brief assessment: Strong Buy/Buy/Hold/Pass with reasoning]
"""

        return prompt

    def _parse_valuation_response(self, response_text: str, property_obj: Property) -> Dict:
        """Parse OpenAI valuation response into structured data"""
        import re

        valuation_data = {
            'fair_market_value': None,
            'annual_noi': None,
            'five_year_roi_percent': None,
            'monthly_gross_rent': None,
            'annual_operating_expenses': None,
            'annual_appreciation_rate': None,
            'investment_recommendation': None,
            'analysis_summary': '',
            'key_assumptions': ''
        }

        try:
            # Extract Fair Market Value
            fmv_pattern = r'FAIR MARKET VALUE.*?\$([0-9,]+)'
            fmv_match = re.search(fmv_pattern, response_text, re.IGNORECASE)
            if fmv_match:
                valuation_data['fair_market_value'] = float(
                    fmv_match.group(1).replace(',', ''))

            # Extract NOI
            noi_pattern = r'(?:ESTIMATED NOI|NOI).*?\$([0-9,]+)'
            noi_match = re.search(noi_pattern, response_text, re.IGNORECASE)
            if noi_match:
                valuation_data['annual_noi'] = float(
                    noi_match.group(1).replace(',', ''))

            # Extract 5-Year ROI
            roi_pattern = r'5-YEAR ROI.*?([0-9.]+)%'
            roi_match = re.search(roi_pattern, response_text, re.IGNORECASE)
            if roi_match:
                valuation_data['five_year_roi_percent'] = float(
                    roi_match.group(1))

            # Extract monthly rent assumption
            rent_pattern = r'Monthly gross rent.*?\$([0-9,]+)'
            rent_match = re.search(rent_pattern, response_text, re.IGNORECASE)
            if rent_match:
                valuation_data['monthly_gross_rent'] = float(
                    rent_match.group(1).replace(',', ''))

            # Extract operating expenses
            opex_pattern = r'operating expenses.*?\$([0-9,]+)'
            opex_match = re.search(opex_pattern, response_text, re.IGNORECASE)
            if opex_match:
                valuation_data['annual_operating_expenses'] = float(
                    opex_match.group(1).replace(',', ''))

            # Extract appreciation rate
            appreciation_pattern = r'appreciation rate.*?([0-9.]+)%'
            appreciation_match = re.search(
                appreciation_pattern, response_text, re.IGNORECASE)
            if appreciation_match:
                valuation_data['annual_appreciation_rate'] = float(
                    appreciation_match.group(1))

            # Extract recommendation
            recommendation_patterns = [
                r'INVESTMENT RECOMMENDATION.*?:(.*?)(?:\n|$)',
                r'RECOMMENDATION.*?:(.*?)(?:\n|$)'
            ]
            for pattern in recommendation_patterns:
                rec_match = re.search(
                    pattern, response_text, re.IGNORECASE | re.DOTALL)
                if rec_match:
                    valuation_data['investment_recommendation'] = rec_match.group(
                        1).strip()
                    break

            # Extract analysis summary
            summary_pattern = r'ANALYSIS SUMMARY.*?:(.*?)(?=\*\*|$)'
            summary_match = re.search(
                summary_pattern, response_text, re.IGNORECASE | re.DOTALL)
            if summary_match:
                valuation_data['analysis_summary'] = summary_match.group(
                    1).strip()

            # Extract key assumptions
            assumptions_pattern = r'KEY ASSUMPTIONS.*?:(.*?)(?=\*\*|$)'
            assumptions_match = re.search(
                assumptions_pattern, response_text, re.IGNORECASE | re.DOTALL)
            if assumptions_match:
                valuation_data['key_assumptions'] = assumptions_match.group(
                    1).strip()

        except Exception as e:
            logger.error(f"Error parsing valuation response: {e}")

        return valuation_data
