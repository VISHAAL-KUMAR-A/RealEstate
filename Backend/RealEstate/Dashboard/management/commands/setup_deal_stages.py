from django.core.management.base import BaseCommand
from Dashboard.models import DealStage


class Command(BaseCommand):
    help = 'Set up initial deal stages for the pipeline'

    def handle(self, *args, **options):
        stages_data = [
            {
                'name': 'acquisition',
                'display_name': 'Acquisition',
                'order': 1,
                'color': '#3B82F6'  # Blue
            },
            {
                'name': 'review',
                'display_name': 'Review',
                'order': 2,
                'color': '#F59E0B'  # Orange
            },
            {
                'name': 'active',
                'display_name': 'Active',
                'order': 3,
                'color': '#10B981'  # Green
            },
            {
                'name': 'closed',
                'display_name': 'Closed',
                'order': 4,
                'color': '#6B7280'  # Gray
            }
        ]

        for stage_data in stages_data:
            stage, created = DealStage.objects.get_or_create(
                name=stage_data['name'],
                defaults={
                    'display_name': stage_data['display_name'],
                    'order': stage_data['order'],
                    'color': stage_data['color']
                }
            )

            if created:
                self.stdout.write(
                    self.style.SUCCESS(
                        f'Created deal stage: {stage.display_name}')
                )
            else:
                self.stdout.write(
                    self.style.WARNING(
                        f'Deal stage already exists: {stage.display_name}')
                )

        self.stdout.write(
            self.style.SUCCESS('Successfully set up deal stages!')
        )
