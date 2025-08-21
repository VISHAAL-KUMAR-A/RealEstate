from django.core.management.base import BaseCommand
from Dashboard.services import PropertyDataSyncer


class Command(BaseCommand):
    help = 'Sync real property data from ATTOM API'

    def add_arguments(self, parser):
        parser.add_argument(
            '--city',
            type=str,
            help='Specific city to sync properties from'
        )
        parser.add_argument(
            '--state',
            type=str,
            help='Specific state to sync properties from'
        )
        parser.add_argument(
            '--limit',
            type=int,
            default=50,
            help='Number of properties to sync per location'
        )

    def handle(self, *args, **options):
        syncer = PropertyDataSyncer()

        city = options.get('city')
        state = options.get('state')
        limit = options['limit']

        if city and state:
            # Sync specific city/state
            self.stdout.write(f'Syncing properties from {city}, {state}...')
            properties = syncer.sync_properties_by_location(city, state, limit)

            if properties:
                self.stdout.write(
                    self.style.SUCCESS(
                        f'Successfully synced {len(properties)} properties from ATTOM API!')
                )
            else:
                self.stdout.write(
                    self.style.WARNING(
                        f'No properties found for {city}, {state} via ATTOM API')
                )
        else:
            # Sync from multiple markets
            self.stdout.write(
                'Syncing properties from multiple markets via ATTOM API...')
            properties = syncer.bulk_sync_attom_data()

            if properties:
                self.stdout.write(
                    self.style.SUCCESS(
                        f'Successfully synced {len(properties)} total properties from ATTOM API!')
                )
            else:
                self.stdout.write(
                    self.style.WARNING(
                        'No properties found via ATTOM API')
                )
