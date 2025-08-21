from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import Q, Avg
from django.db import models
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from .models import Property, InvestmentMetrics, UserWatchlist, MarketData
from .services import PropertyDataSyncer
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
    """Get investment opportunities from ATTOM API ONLY - NO FALLBACK DATA"""
    # For now, return empty results since ATTOM API requires specific addresses
    # City-wide searches are not supported by ATTOM API
    city = request.GET.get('city', '')
    state = request.GET.get('state', '')

    return Response({
        'count': 0,
        'results': [],
        'source': 'attom-api-only',
        'message': 'ATTOM API requires specific property addresses. City-wide searches not supported.',
        'search_location': f"{city}, {state}" if city or state else "No location specified"
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
