from django.contrib import admin
from .models import *
for model in [Profile,Category,Subcategory,ChildCategory,Paper,Job,JobYear,MCQ,Bookmark,SavedPaper,Attempt,Report,ContactMessage,AuditLog,Guide,Post,SiteSetting,AdPlacement,TrashRecord,OneTimeToken]:
    try: admin.site.register(model)
    except admin.sites.AlreadyRegistered: pass
