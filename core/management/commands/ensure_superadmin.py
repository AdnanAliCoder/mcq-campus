import os
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from core.models import profile_for
class Command(BaseCommand):
    help='Create or update the owner account from environment variables.'
    def handle(self,*args,**opts):
        email=os.getenv('SUPERADMIN_EMAIL','').strip().lower(); password=os.getenv('SUPERADMIN_PASSWORD',''); name=os.getenv('SUPERADMIN_NAME','MCQ Campus Owner').strip()
        if not email or not password: self.stdout.write(self.style.WARNING('SUPERADMIN_EMAIL/PASSWORD not set; owner account not created.')); return
        u,created=User.objects.get_or_create(email=email,defaults={'username':email,'first_name':name,'is_staff':True,'is_superuser':True})
        u.username=email; u.first_name=name; u.is_staff=True; u.is_superuser=True; u.is_active=True; u.set_password(password); u.save(); p=profile_for(u); p.role='super-admin'; p.email_verified=True; p.save()
        self.stdout.write(self.style.SUCCESS(('Created' if created else 'Updated')+' super admin: '+email))
