import os

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from core.models import profile_for


class Command(BaseCommand):
    help = 'Create the first owner from environment variables; preserve existing accounts.'

    @transaction.atomic
    def handle(self, *args, **opts):
        email = os.getenv('SUPERADMIN_EMAIL', '').strip().lower()
        password = os.getenv('SUPERADMIN_PASSWORD', '')
        name = os.getenv('SUPERADMIN_NAME', 'MCQ Campus Owner').strip()
        if not email or not password:
            self.stdout.write(self.style.WARNING(
                'SUPERADMIN_EMAIL/PASSWORD not set; owner account not created.'
            ))
            return

        existing = list(User.objects.filter(email__iexact=email)[:2])
        if len(existing) > 1:
            raise CommandError('Multiple accounts match the owner email; resolve the conflict manually.')
        if existing:
            user = existing[0]
            profile = profile_for(user)
            if not (user.is_superuser and user.is_staff and user.is_active and profile.role == 'super-admin'):
                raise CommandError('Owner email belongs to an existing non-owner or inactive account; no account changed.')
            self.stdout.write(self.style.SUCCESS('Owner already exists; credentials and profile preserved.'))
            return

        if User.objects.filter(username=email).exists():
            raise CommandError('Owner username is already in use; no account changed.')
        if len(password) < 12 or password.lower().startswith(('change-', 'password')):
            raise CommandError('Use a unique owner password of at least 12 characters.')

        user = User.objects.create_superuser(username=email, email=email, password=password, first_name=name)
        profile = profile_for(user)
        profile.role = 'super-admin'
        profile.email_verified = True
        profile.save(update_fields=['role', 'email_verified'])
        self.stdout.write(self.style.SUCCESS('Created super admin.'))
