from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import Q, Avg, Case, When, Value, DecimalField
from django.db import models
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from .models import Property, InvestmentMetrics, UserWatchlist, MarketData, Deal, DealStage
from .services import PropertyDataSyncer
from .filters import PropertyFilter
import logging

logger = logging.getLogger(__name__)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me(request):
    user = request.user
    return Response({
        'id': user.id,
        'username': user.username,
        'email': user.email,
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def signup(request):
    username = request.data.get('username')
    email = request.data.get('email', '')
    password = request.data.get('password')
    if not username or not password:
        return Response({'detail': 'username and password are required'}, status=status.HTTP_400_BAD_REQUEST)

    if User.objects.filter(username=username).exists():
        return Response({'detail': 'username already exists'}, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        user = User.objects.create_user(
            username=username, email=email, password=password)

    refresh = RefreshToken.for_user(user)
    return Response({
        'user': {
            'id': user.id,
            'username': user.username,
            'email': user.email,
        },
        'refresh': str(refresh),
        'access': str(refresh.access_token),
    }, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout(request):
    refresh_token = request.data.get('refresh')
    if not refresh_token:
        return Response({'detail': 'refresh token is required'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        token = RefreshToken(refresh_token)
        token.blacklist()
        return Response({'detail': 'logged out'})
    except Exception:
        return Response({'detail': 'invalid refresh token'}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def investment_opportunities(request):
    """Get investment opportunities from synced ATTOM data"""
    city = request.GET.get('city', '')
    state = request.GET.get('state', '')
    limit = int(request.GET.get('limit', 50))

    # Build query for synced properties only
    query = Q(last_api_sync__isnull=False)

    if city:
        query &= Q(city__icontains=city)
    if state:
        query &= Q(state__icontains=state)

    # Get properties with investment metrics, ordered by investment score
    properties = Property.objects.filter(query).select_related(
        'metrics').order_by('-metrics__investment_score')[:limit]

    results = []
    for prop in properties:
        property_data = {
            'id': prop.id,
            'address': prop.address,
            'city': prop.city,
            'state': prop.state,
            'zip_code': prop.zip_code,
            'property_type': prop.property_type,
            'bedrooms': prop.bedrooms,
            'bathrooms': float(prop.bathrooms) if prop.bathrooms else None,
            'square_feet': prop.square_feet,
            'lot_size': float(prop.lot_size) if prop.lot_size else None,
            'year_built': prop.year_built,
            'current_price': float(prop.current_price) if prop.current_price else None,
            'estimated_value': float(prop.estimated_value) if prop.estimated_value else None,
            'tax_assessment': float(prop.tax_assessment) if prop.tax_assessment else None,
            'annual_taxes': float(prop.annual_taxes) if prop.annual_taxes else None,
            'estimated_rent': float(prop.estimated_rent) if prop.estimated_rent else None,
            'latitude': float(prop.latitude) if prop.latitude else None,
            'longitude': float(prop.longitude) if prop.longitude else None,
            'last_api_sync': prop.last_api_sync,
        }

        # Add investment metrics if available
        if hasattr(prop, 'metrics') and prop.metrics:
            property_data['metrics'] = {
                'investment_score': float(prop.metrics.investment_score) if prop.metrics.investment_score else None,
                'cap_rate': float(prop.metrics.cap_rate) if prop.metrics.cap_rate else None,
                'gross_rental_yield': float(prop.metrics.gross_rental_yield) if prop.metrics.gross_rental_yield else None,
                'net_operating_income': float(prop.metrics.net_operating_income) if prop.metrics.net_operating_income else None,
                'price_to_rent_ratio': float(prop.metrics.price_to_rent_ratio) if prop.metrics.price_to_rent_ratio else None,
                'risk_score': float(prop.metrics.risk_score) if prop.metrics.risk_score else None,
                'estimated_profit': float(prop.metrics.estimated_profit) if prop.metrics.estimated_profit else None,
            }
        else:
            property_data['metrics'] = None

        results.append(property_data)

    return Response({
        'count': len(results),
        'results': results,
        'source': 'database-synced-from-attom',
        'search_location': f"{city}, {state}" if city or state else "All locations",
        'message': f'Found {len(results)} synced properties from ATTOM API'
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_stats(request):
    """Get dashboard statistics - ATTOM API data only"""
    # Only count properties that came from ATTOM API (have last_api_sync timestamp)
    total_properties = Property.objects.filter(
        last_api_sync__isnull=False).count()
    properties_with_metrics = Property.objects.filter(
        metrics__isnull=False, last_api_sync__isnull=False).count()

    if total_properties == 0:
        return Response({
            'total_properties': 0,
            'properties_with_metrics': 0,
            'average_metrics': {
                'investment_score': 0,
                'cap_rate': 0,
                'gross_rental_yield': 0,
            },
            'top_properties': [],
            'message': 'No ATTOM API data available. Add specific property addresses to get real data.'
        })

    # Get average metrics only from ATTOM API properties
    avg_metrics = InvestmentMetrics.objects.filter(
        property_ref__last_api_sync__isnull=False
    ).aggregate(
        avg_investment_score=Avg('investment_score'),
        avg_cap_rate=Avg('cap_rate'),
        avg_gross_yield=Avg('gross_rental_yield'),
    )

    # Get top performing properties from ATTOM API only
    top_properties = Property.objects.filter(
        metrics__isnull=False,
        last_api_sync__isnull=False
    ).select_related('metrics').order_by('-metrics__investment_score')[:5]

    top_properties_data = []
    for prop in top_properties:
        top_properties_data.append({
            'address': prop.address,
            'city': prop.city,
            'state': prop.state,
            'investment_score': float(prop.metrics.investment_score) if prop.metrics.investment_score else 0,
            'cap_rate': float(prop.metrics.cap_rate) if prop.metrics.cap_rate else 0,
        })

    return Response({
        'total_properties': total_properties,
        'properties_with_metrics': properties_with_metrics,
        'average_metrics': {
            'investment_score': float(avg_metrics['avg_investment_score']) if avg_metrics['avg_investment_score'] else 0,
            'cap_rate': float(avg_metrics['avg_cap_rate']) if avg_metrics['avg_cap_rate'] else 0,
            'gross_rental_yield': float(avg_metrics['avg_gross_yield']) if avg_metrics['avg_gross_yield'] else 0,
        },
        'top_properties': top_properties_data,
        'source': 'attom-api-only'
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def sync_property_data(request):
    """Sync specific property from ATTOM API using exact address"""
    address1 = request.data.get('address1')  # e.g., "4529 Winona Court"
    address2 = request.data.get('address2')  # e.g., "Denver, CO"

    if not address1 or not address2:
        return Response({
            'error': 'Both address1 and address2 are required',
            'example': {
                'address1': '4529 Winona Court',
                'address2': 'Denver, CO'
            }
        }, status=status.HTTP_400_BAD_REQUEST)

    try:
        from .services import AttomAPIService
        attom_service = AttomAPIService()

        # Try different ATTOM endpoints with the specific address
        endpoints = [
            '/propertyapi/v1.0.0/property/expandedprofile',
            '/propertyapi/v1.0.0/property/basicprofile',
            '/propertyapi/v1.0.0/assessment/detail'
        ]

        property_data = None
        for endpoint in endpoints:
            params = {'address1': address1, 'address2': address2}
            data = attom_service._make_request(endpoint, params)
            if data:
                properties = attom_service._extract_properties(data)
                if properties:
                    property_data = properties[0]
                    break

        if not property_data:
            return Response({
                'error': 'No property found with this address',
                'address': f"{address1}, {address2}"
            }, status=status.HTTP_404_NOT_FOUND)

        # Parse city and state from address2
        parts = address2.split(',')
        city = parts[0].strip() if len(parts) >= 1 else ''
        state = parts[1].strip() if len(parts) >= 2 else ''

        syncer = PropertyDataSyncer()
        property_obj = syncer._sync_attom_property(property_data, city, state)

        if property_obj:
            return Response({
                'message': f'Successfully synced property: {property_obj.address}',
                'property': {
                    'id': property_obj.id,
                    'address': property_obj.address,
                    'city': property_obj.city,
                    'state': property_obj.state,
                    'current_price': float(property_obj.current_price) if property_obj.current_price else None,
                    'estimated_value': float(property_obj.estimated_value) if property_obj.estimated_value else None
                }
            })
        else:
            return Response({
                'error': 'Failed to save property data'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    except Exception as e:
        logger.error(f"Error syncing property data: {e}")
        return Response({
            'error': 'Failed to sync property data',
            'details': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET', 'POST', 'DELETE'])
@permission_classes([IsAuthenticated])
def user_watchlist(request):
    """Manage user's property watchlist"""
    if request.method == 'GET':
        # Get user's watchlist
        watchlist = UserWatchlist.objects.filter(
            user=request.user).select_related('property_ref')
        watchlist_data = []
        for item in watchlist:
            prop = item.property_ref
            watchlist_data.append({
                'id': item.id,
                'property_id': prop.id,
                'address': prop.address,
                'city': prop.city,
                'state': prop.state,
                'current_price': float(prop.current_price) if prop.current_price else None,
                'estimated_rent': float(prop.estimated_rent) if prop.estimated_rent else None,
                'added_at': item.added_at,
                'notes': item.notes
            })
        return Response(watchlist_data)

    elif request.method == 'POST':
        # Add property to watchlist
        property_id = request.data.get('property_id')
        notes = request.data.get('notes', '')

        try:
            property_obj = Property.objects.get(id=property_id)
            watchlist_item, created = UserWatchlist.objects.get_or_create(
                user=request.user,
                property_ref=property_obj,
                defaults={'notes': notes}
            )

            if created:
                return Response({'message': 'Property added to watchlist'}, status=status.HTTP_201_CREATED)
            else:
                return Response({'message': 'Property already in watchlist'}, status=status.HTTP_200_OK)
        except Property.DoesNotExist:
            return Response({'error': 'Property not found'}, status=status.HTTP_404_NOT_FOUND)

    elif request.method == 'DELETE':
        # Remove property from watchlist
        property_id = request.data.get('property_id')
        try:
            watchlist_item = UserWatchlist.objects.get(
                user=request.user, property_ref_id=property_id)
            watchlist_item.delete()
            return Response({'message': 'Property removed from watchlist'})
        except UserWatchlist.DoesNotExist:
            return Response({'error': 'Property not in watchlist'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def properties(request):
    """Get all synced properties with optional filtering"""
    city = request.GET.get('city', '')
    state = request.GET.get('state', '')
    min_price = request.GET.get('min_price')
    max_price = request.GET.get('max_price')
    property_type = request.GET.get('property_type', '')
    limit = int(request.GET.get('limit', 100))

    # Build query for synced properties only
    query = Q(last_api_sync__isnull=False)

    if city:
        query &= Q(city__icontains=city)
    if state:
        query &= Q(state__icontains=state)
    if property_type:
        query &= Q(property_type__icontains=property_type)
    if min_price:
        query &= Q(current_price__gte=min_price)
    if max_price:
        query &= Q(current_price__lte=max_price)

    # Get properties with investment metrics
    properties = Property.objects.filter(query).select_related(
        'metrics').order_by('-created_at')[:limit]

    results = []
    for prop in properties:
        property_data = {
            'id': prop.id,
            'address': prop.address,
            'city': prop.city,
            'state': prop.state,
            'zip_code': prop.zip_code,
            'property_type': prop.property_type,
            'bedrooms': prop.bedrooms,
            'bathrooms': float(prop.bathrooms) if prop.bathrooms else None,
            'square_feet': prop.square_feet,
            'lot_size': float(prop.lot_size) if prop.lot_size else None,
            'year_built': prop.year_built,
            'current_price': float(prop.current_price) if prop.current_price else None,
            'estimated_value': float(prop.estimated_value) if prop.estimated_value else None,
            'tax_assessment': float(prop.tax_assessment) if prop.tax_assessment else None,
            'annual_taxes': float(prop.annual_taxes) if prop.annual_taxes else None,
            'estimated_rent': float(prop.estimated_rent) if prop.estimated_rent else None,
            'latitude': float(prop.latitude) if prop.latitude else None,
            'longitude': float(prop.longitude) if prop.longitude else None,
            'attom_id': prop.attom_id,
            'created_at': prop.created_at,
            'last_api_sync': prop.last_api_sync,
        }

        # Add investment metrics if available
        if hasattr(prop, 'metrics') and prop.metrics:
            property_data['metrics'] = {
                'investment_score': float(prop.metrics.investment_score) if prop.metrics.investment_score else None,
                'cap_rate': float(prop.metrics.cap_rate) if prop.metrics.cap_rate else None,
                'gross_rental_yield': float(prop.metrics.gross_rental_yield) if prop.metrics.gross_rental_yield else None,
                'net_operating_income': float(prop.metrics.net_operating_income) if prop.metrics.net_operating_income else None,
                'price_to_rent_ratio': float(prop.metrics.price_to_rent_ratio) if prop.metrics.price_to_rent_ratio else None,
                'risk_score': float(prop.metrics.risk_score) if prop.metrics.risk_score else None,
                'estimated_profit': float(prop.metrics.estimated_profit) if prop.metrics.estimated_profit else None,
                'cash_on_cash_return': float(prop.metrics.cash_on_cash_return) if prop.metrics.cash_on_cash_return else None,
            }
        else:
            property_data['metrics'] = None

        results.append(property_data)

    return Response({
        'count': len(results),
        'total_synced': Property.objects.filter(last_api_sync__isnull=False).count(),
        'results': results,
        'filters_applied': {
            'city': city,
            'state': state,
            'property_type': property_type,
            'min_price': min_price,
            'max_price': max_price,
            'limit': limit
        }
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def properties_map_data(request):
    """Get property data optimized for map visualization"""
    # Get base queryset for synced properties with coordinates and metrics
    queryset = Property.objects.filter(
        last_api_sync__isnull=False,
        latitude__isnull=False,
        longitude__isnull=False,
        metrics__isnull=False
    ).select_related('metrics')

    # Apply basic filtering
    city = request.GET.get('city', '')
    state = request.GET.get('state', '')
    min_investment_score = request.GET.get('min_investment_score')
    max_investment_score = request.GET.get('max_investment_score')

    if city:
        queryset = queryset.filter(city__icontains=city)
    if state:
        queryset = queryset.filter(state__icontains=state)
    if min_investment_score:
        queryset = queryset.filter(
            metrics__investment_score__gte=min_investment_score)
    if max_investment_score:
        queryset = queryset.filter(
            metrics__investment_score__lte=max_investment_score)

    # Limit to reasonable number for map performance
    limit = int(request.GET.get('limit', 500))
    properties = queryset.order_by('-metrics__investment_score')[:limit]

    # Create map-optimized response
    map_properties = []
    for prop in properties:
        # Determine color based on investment score
        investment_score = float(
            prop.metrics.investment_score) if prop.metrics.investment_score else 0

        # Color categories: Green (High), Yellow (Medium), Red (Low)
        if investment_score >= 70:
            color = '#10B981'  # Green
            category = 'high'
        elif investment_score >= 40:
            color = '#F59E0B'  # Yellow
            category = 'medium'
        else:
            color = '#EF4444'  # Red
            category = 'low'

        map_properties.append({
            'id': prop.id,
            'latitude': float(prop.latitude),
            'longitude': float(prop.longitude),
            'address': prop.address,
            'city': prop.city,
            'state': prop.state,
            'current_price': float(prop.current_price) if prop.current_price else None,
            'estimated_rent': float(prop.estimated_rent) if prop.estimated_rent else None,
            'property_type': prop.property_type,
            'bedrooms': prop.bedrooms,
            'bathrooms': float(prop.bathrooms) if prop.bathrooms else None,
            'square_feet': prop.square_feet,
            'investment_score': investment_score,
            'cap_rate': float(prop.metrics.cap_rate) if prop.metrics.cap_rate else None,
            'estimated_profit': float(prop.metrics.estimated_profit) if prop.metrics.estimated_profit else None,
            'net_operating_income': float(prop.metrics.net_operating_income) if prop.metrics.net_operating_income else None,
            'color': color,
            'category': category
        })

    # Calculate map bounds
    if map_properties:
        lats = [p['latitude'] for p in map_properties]
        lngs = [p['longitude'] for p in map_properties]
        bounds = {
            'north': max(lats),
            'south': min(lats),
            'east': max(lngs),
            'west': min(lngs)
        }
        # Add padding
        lat_padding = (bounds['north'] - bounds['south']) * 0.1
        lng_padding = (bounds['east'] - bounds['west']) * 0.1
        bounds['north'] += lat_padding
        bounds['south'] -= lat_padding
        bounds['east'] += lng_padding
        bounds['west'] -= lng_padding
    else:
        bounds = None

    return Response({
        'properties': map_properties,
        'count': len(map_properties),
        'bounds': bounds,
        'color_legend': {
            'high': {'color': '#10B981', 'label': 'High Score (70+)', 'description': 'Excellent investment opportunity'},
            'medium': {'color': '#F59E0B', 'label': 'Medium Score (40-69)', 'description': 'Good investment potential'},
            'low': {'color': '#EF4444', 'label': 'Low Score (<40)', 'description': 'Lower investment potential'}
        }
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def best_deals(request):
    """Advanced filtering and sorting for best investment deals"""

    # Get base queryset for synced properties with metrics
    queryset = Property.objects.filter(
        last_api_sync__isnull=False,
        metrics__isnull=False
    ).select_related('metrics')

    # Apply advanced filtering using PropertyFilter
    property_filter = PropertyFilter(request.GET, queryset=queryset)
    filtered_queryset = property_filter.qs

    # Handle custom sorting if no ordering specified
    ordering = request.GET.get('ordering', '-metrics__investment_score')
    if ordering:
        try:
            filtered_queryset = filtered_queryset.order_by(ordering)
        except Exception:
            # Fallback to default ordering
            filtered_queryset = filtered_queryset.order_by(
                '-metrics__investment_score')

    # Pagination
    limit = int(request.GET.get('limit', 50))
    offset = int(request.GET.get('offset', 0))

    total_count = filtered_queryset.count()
    properties = filtered_queryset[offset:offset + limit]

    # Serialize results
    results = []
    for prop in properties:
        # Calculate ROI
        roi = None
        if prop.metrics.net_operating_income and prop.current_price and prop.current_price > 0:
            roi = (float(prop.metrics.net_operating_income) /
                   float(prop.current_price)) * 100

        property_data = {
            'id': prop.id,
            'address': prop.address,
            'city': prop.city,
            'state': prop.state,
            'zip_code': prop.zip_code,
            'property_type': prop.property_type,
            'bedrooms': prop.bedrooms,
            'bathrooms': float(prop.bathrooms) if prop.bathrooms else None,
            'square_feet': prop.square_feet,
            'lot_size': float(prop.lot_size) if prop.lot_size else None,
            'year_built': prop.year_built,
            'current_price': float(prop.current_price) if prop.current_price else None,
            'estimated_value': float(prop.estimated_value) if prop.estimated_value else None,
            'tax_assessment': float(prop.tax_assessment) if prop.tax_assessment else None,
            'annual_taxes': float(prop.annual_taxes) if prop.annual_taxes else None,
            'estimated_rent': float(prop.estimated_rent) if prop.estimated_rent else None,
            'latitude': float(prop.latitude) if prop.latitude else None,
            'longitude': float(prop.longitude) if prop.longitude else None,
            'attom_id': prop.attom_id,
            'created_at': prop.created_at,
            'last_api_sync': prop.last_api_sync,
            'metrics': {
                'investment_score': float(prop.metrics.investment_score) if prop.metrics.investment_score else None,
                'cap_rate': float(prop.metrics.cap_rate) if prop.metrics.cap_rate else None,
                'gross_rental_yield': float(prop.metrics.gross_rental_yield) if prop.metrics.gross_rental_yield else None,
                'net_operating_income': float(prop.metrics.net_operating_income) if prop.metrics.net_operating_income else None,
                'price_to_rent_ratio': float(prop.metrics.price_to_rent_ratio) if prop.metrics.price_to_rent_ratio else None,
                'risk_score': float(prop.metrics.risk_score) if prop.metrics.risk_score else None,
                'estimated_profit': float(prop.metrics.estimated_profit) if prop.metrics.estimated_profit else None,
                'cash_on_cash_return': float(prop.metrics.cash_on_cash_return) if prop.metrics.cash_on_cash_return else None,
                'roi': roi,  # Calculated ROI
            }
        }

        results.append(property_data)

    # Get available filter options for frontend
    filter_options = {
        'sort_options': [
            {'value': '-metrics__investment_score',
                'label': 'Investment Score (High to Low)'},
            {'value': 'metrics__investment_score',
                'label': 'Investment Score (Low to High)'},
            {'value': '-metrics__cap_rate', 'label': 'Cap Rate (High to Low)'},
            {'value': 'metrics__cap_rate', 'label': 'Cap Rate (Low to High)'},
            {'value': '-metrics__gross_rental_yield',
                'label': 'Rental Yield (High to Low)'},
            {'value': 'metrics__gross_rental_yield',
                'label': 'Rental Yield (Low to High)'},
            {'value': '-metrics__cash_on_cash_return',
                'label': 'Cash-on-Cash Return (High to Low)'},
            {'value': 'metrics__cash_on_cash_return',
                'label': 'Cash-on-Cash Return (Low to High)'},
            {'value': '-metrics__net_operating_income',
                'label': 'NOI (High to Low)'},
            {'value': 'metrics__net_operating_income',
                'label': 'NOI (Low to High)'},
            {'value': '-metrics__estimated_profit',
                'label': 'Estimated Profit (High to Low)'},
            {'value': 'metrics__estimated_profit',
                'label': 'Estimated Profit (Low to High)'},
            {'value': 'metrics__risk_score',
                'label': 'Risk Score (Low to High)'},
            {'value': '-metrics__risk_score',
                'label': 'Risk Score (High to Low)'},
            {'value': 'current_price', 'label': 'Price (Low to High)'},
            {'value': '-current_price', 'label': 'Price (High to Low)'},
        ],
        'property_types': list(Property.objects.filter(
            last_api_sync__isnull=False
        ).values_list('property_type', flat=True).distinct()),
    }

    return Response({
        'count': len(results),
        'total_count': total_count,
        'results': results,
        'filter_options': filter_options,
        'has_next': offset + limit < total_count,
        'has_previous': offset > 0,
        'applied_filters': dict(request.GET.items()),
        'source': 'advanced-filtered-attom-data'
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def property_valuation(request):
    """
    Generate AI-powered property valuation using OpenAI and ATTOM Data

    Expected payload:
    {
        "property_id": 123
    }
    """
    property_id = request.data.get('property_id')

    if not property_id:
        return Response({
            'error': 'property_id is required'
        }, status=status.HTTP_400_BAD_REQUEST)

    try:
        # Get the property object
        property_obj = Property.objects.get(id=property_id)

    except Property.DoesNotExist:
        return Response({
            'error': 'Property not found'
        }, status=status.HTTP_404_NOT_FOUND)

    try:
        # Use the PropertyValuationService to generate valuation
        from .services import PropertyValuationService
        valuation_service = PropertyValuationService()

        result = valuation_service.get_property_valuation(
            property_obj, request.user)

        if result['success']:
            return Response(result, status=status.HTTP_200_OK)
        else:
            return Response(result, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    except Exception as e:
        return Response({
            'error': 'Valuation service error',
            'details': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def property_valuations(request, property_id):
    """
    Get all valuations for a specific property
    """
    try:
        property_obj = Property.objects.get(id=property_id)

        # Import here to avoid circular imports
        from .models import PropertyValuation

        # Get all valuations for this property, most recent first
        valuations = PropertyValuation.objects.filter(
            property_ref=property_obj
        ).order_by('-created_at')

        valuation_data = []
        for valuation in valuations:
            data = {
                'id': valuation.id,
                'fair_market_value': valuation.fair_market_value,
                'annual_noi': valuation.annual_noi,
                'five_year_roi_percent': valuation.five_year_roi_percent,
                'monthly_gross_rent': valuation.monthly_gross_rent,
                'annual_operating_expenses': valuation.annual_operating_expenses,
                'annual_appreciation_rate': valuation.annual_appreciation_rate,
                'investment_recommendation': valuation.investment_recommendation,
                'analysis_summary': valuation.analysis_summary,
                'key_assumptions': valuation.key_assumptions,
                'valuation_successful': valuation.valuation_successful,
                'error_message': valuation.error_message if not valuation.valuation_successful else None,
                'created_at': valuation.created_at.isoformat(),
                'requested_by': valuation.requested_by.username if valuation.requested_by else None,
                'attom_endpoints_used': valuation.attom_endpoints_used,
                'gross_rental_yield': valuation.gross_rental_yield,
                'cap_rate': valuation.cap_rate,
            }
            valuation_data.append(data)

        return Response({
            'property': {
                'id': property_obj.id,
                'address': property_obj.address,
                'city': property_obj.city,
                'state': property_obj.state
            },
            'valuations': valuation_data
        })

    except Property.DoesNotExist:
        return Response({
            'error': 'Property not found'
        }, status=status.HTTP_404_NOT_FOUND)


# Deal Pipeline Views

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def deals(request):
    """Get all deals or create a new deal"""
    if request.method == 'GET':
        # Get all deals for the kanban board
        deals_queryset = Deal.objects.select_related(
            'stage', 'property_ref', 'assigned_to', 'created_by'
        ).filter(created_by=request.user)

        # Organize deals by stage
        deals_by_stage = {}
        stages = DealStage.objects.all()

        for stage in stages:
            deals_by_stage[stage.name] = {
                'stage_info': {
                    'id': stage.id,
                    'name': stage.name,
                    'display_name': stage.display_name,
                    'color': stage.color,
                    'order': stage.order
                },
                'deals': []
            }

        for deal in deals_queryset:
            deal_data = {
                'id': deal.id,
                'title': deal.title,
                'description': deal.description,
                'priority': deal.priority,
                'status': deal.status,
                'expected_purchase_price': float(deal.expected_purchase_price) if deal.expected_purchase_price else None,
                'actual_purchase_price': float(deal.actual_purchase_price) if deal.actual_purchase_price else None,
                'estimated_profit': float(deal.estimated_profit) if deal.estimated_profit else None,
                'target_close_date': deal.target_close_date,
                'actual_close_date': deal.actual_close_date,
                'position': deal.position,
                'notes': deal.notes,
                'created_at': deal.created_at,
                'updated_at': deal.updated_at,
                'days_in_stage': deal.days_in_stage,
                'assigned_to': deal.assigned_to.username if deal.assigned_to else None,
                'created_by': deal.created_by.username,
                'property': {
                    'id': deal.property_ref.id,
                    'address': deal.property_ref.address,
                    'city': deal.property_ref.city,
                    'state': deal.property_ref.state,
                    'current_price': float(deal.property_ref.current_price) if deal.property_ref.current_price else None,
                } if deal.property_ref else None
            }

            deals_by_stage[deal.stage.name]['deals'].append(deal_data)

        return Response(deals_by_stage)

    elif request.method == 'POST':
        # Create a new deal
        title = request.data.get('title')
        stage_name = request.data.get('stage', 'acquisition')

        if not title:
            return Response({
                'error': 'Title is required'
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            stage = DealStage.objects.get(name=stage_name)
        except DealStage.DoesNotExist:
            return Response({
                'error': f'Invalid stage: {stage_name}'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Get highest position in this stage for new deal
        max_position = Deal.objects.filter(stage=stage).aggregate(
            models.Max('position'))['position__max']
        position = (max_position or 0) + 1

        # Optional property linking
        property_id = request.data.get('property_id')
        property_obj = None
        if property_id:
            try:
                property_obj = Property.objects.get(id=property_id)
            except Property.DoesNotExist:
                return Response({
                    'error': 'Property not found'
                }, status=status.HTTP_400_BAD_REQUEST)

        deal = Deal.objects.create(
            title=title,
            description=request.data.get('description', ''),
            property_ref=property_obj,
            stage=stage,
            priority=request.data.get('priority', 'medium'),
            expected_purchase_price=request.data.get(
                'expected_purchase_price'),
            estimated_profit=request.data.get('estimated_profit'),
            target_close_date=request.data.get('target_close_date'),
            notes=request.data.get('notes', ''),
            created_by=request.user,
            position=position
        )

        return Response({
            'id': deal.id,
            'title': deal.title,
            'stage': deal.stage.name,
            'message': 'Deal created successfully'
        }, status=status.HTTP_201_CREATED)


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def deal_detail(request, deal_id):
    """Get, update, or delete a specific deal"""
    try:
        deal = Deal.objects.select_related(
            'stage', 'property_ref', 'assigned_to', 'created_by'
        ).get(id=deal_id, created_by=request.user)
    except Deal.DoesNotExist:
        return Response({
            'error': 'Deal not found'
        }, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        deal_data = {
            'id': deal.id,
            'title': deal.title,
            'description': deal.description,
            'stage': {
                'name': deal.stage.name,
                'display_name': deal.stage.display_name,
                'color': deal.stage.color
            },
            'priority': deal.priority,
            'status': deal.status,
            'expected_purchase_price': float(deal.expected_purchase_price) if deal.expected_purchase_price else None,
            'actual_purchase_price': float(deal.actual_purchase_price) if deal.actual_purchase_price else None,
            'estimated_profit': float(deal.estimated_profit) if deal.estimated_profit else None,
            'target_close_date': deal.target_close_date,
            'actual_close_date': deal.actual_close_date,
            'position': deal.position,
            'notes': deal.notes,
            'created_at': deal.created_at,
            'updated_at': deal.updated_at,
            'days_in_stage': deal.days_in_stage,
            'assigned_to': {
                'id': deal.assigned_to.id,
                'username': deal.assigned_to.username,
            } if deal.assigned_to else None,
            'created_by': {
                'id': deal.created_by.id,
                'username': deal.created_by.username,
            },
            'property': {
                'id': deal.property_ref.id,
                'address': deal.property_ref.address,
                'city': deal.property_ref.city,
                'state': deal.property_ref.state,
                'current_price': float(deal.property_ref.current_price) if deal.property_ref.current_price else None,
                'estimated_rent': float(deal.property_ref.estimated_rent) if deal.property_ref.estimated_rent else None,
            } if deal.property_ref else None
        }
        return Response(deal_data)

    elif request.method == 'PUT':
        # Update deal
        deal.title = request.data.get('title', deal.title)
        deal.description = request.data.get('description', deal.description)
        deal.priority = request.data.get('priority', deal.priority)
        deal.status = request.data.get('status', deal.status)
        deal.expected_purchase_price = request.data.get(
            'expected_purchase_price', deal.expected_purchase_price)
        deal.actual_purchase_price = request.data.get(
            'actual_purchase_price', deal.actual_purchase_price)
        deal.estimated_profit = request.data.get(
            'estimated_profit', deal.estimated_profit)
        deal.target_close_date = request.data.get(
            'target_close_date', deal.target_close_date)
        deal.actual_close_date = request.data.get(
            'actual_close_date', deal.actual_close_date)
        deal.notes = request.data.get('notes', deal.notes)

        # Handle property assignment
        property_id = request.data.get('property_id')
        if property_id is not None:
            if property_id:
                try:
                    deal.property_ref = Property.objects.get(id=property_id)
                except Property.DoesNotExist:
                    return Response({
                        'error': 'Property not found'
                    }, status=status.HTTP_400_BAD_REQUEST)
            else:
                deal.property_ref = None

        # Handle user assignment
        assigned_to_id = request.data.get('assigned_to_id')
        if assigned_to_id is not None:
            if assigned_to_id:
                try:
                    deal.assigned_to = User.objects.get(id=assigned_to_id)
                except User.DoesNotExist:
                    return Response({
                        'error': 'Assigned user not found'
                    }, status=status.HTTP_400_BAD_REQUEST)
            else:
                deal.assigned_to = None

        deal.save()

        return Response({
            'id': deal.id,
            'title': deal.title,
            'message': 'Deal updated successfully'
        })

    elif request.method == 'DELETE':
        deal.delete()
        return Response({
            'message': 'Deal deleted successfully'
        })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def move_deal(request):
    """Move a deal to a different stage and position"""
    deal_id = request.data.get('deal_id')
    target_stage_name = request.data.get('target_stage')
    target_position = request.data.get('target_position', 0)

    if not deal_id or not target_stage_name:
        return Response({
            'error': 'deal_id and target_stage are required'
        }, status=status.HTTP_400_BAD_REQUEST)

    try:
        deal = Deal.objects.get(id=deal_id, created_by=request.user)
        target_stage = DealStage.objects.get(name=target_stage_name)
    except Deal.DoesNotExist:
        return Response({
            'error': 'Deal not found'
        }, status=status.HTTP_404_NOT_FOUND)
    except DealStage.DoesNotExist:
        return Response({
            'error': 'Invalid target stage'
        }, status=status.HTTP_400_BAD_REQUEST)

    # Use transaction to ensure data consistency
    with transaction.atomic():
        old_stage = deal.stage
        old_position = deal.position

        # If moving to a different stage, update positions in both stages
        if old_stage != target_stage:
            # Remove from old stage (shift positions down)
            Deal.objects.filter(
                stage=old_stage,
                position__gt=old_position,
                created_by=request.user
            ).update(position=models.F('position') - 1)

            # Make room in target stage (shift positions up)
            Deal.objects.filter(
                stage=target_stage,
                position__gte=target_position,
                created_by=request.user
            ).update(position=models.F('position') + 1)

            # Update the deal
            deal.stage = target_stage
            deal.position = target_position
            deal.save()

        # If moving within the same stage
        elif old_position != target_position:
            if old_position < target_position:
                # Moving down: shift items up
                Deal.objects.filter(
                    stage=target_stage,
                    position__gt=old_position,
                    position__lte=target_position,
                    created_by=request.user
                ).exclude(id=deal_id).update(position=models.F('position') - 1)
            else:
                # Moving up: shift items down
                Deal.objects.filter(
                    stage=target_stage,
                    position__gte=target_position,
                    position__lt=old_position,
                    created_by=request.user
                ).exclude(id=deal_id).update(position=models.F('position') + 1)

            # Update the deal position
            deal.position = target_position
            deal.save()

    return Response({
        'message': 'Deal moved successfully',
        'deal_id': deal.id,
        'new_stage': target_stage.display_name,
        'new_position': target_position
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def deal_stages(request):
    """Get all available deal stages"""
    stages = DealStage.objects.all()
    stages_data = [{
        'id': stage.id,
        'name': stage.name,
        'display_name': stage.display_name,
        'order': stage.order,
        'color': stage.color
    } for stage in stages]

    return Response(stages_data)
