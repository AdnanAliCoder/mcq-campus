from django.contrib.auth.models import User
from django.db import models
from django.utils import timezone

class Profile(models.Model):
    ROLE_CHOICES=[('user','Learner'),('admin','Admin'),('super-admin','Super admin')]
    user=models.OneToOneField(User,on_delete=models.CASCADE,related_name='profile')
    role=models.CharField(max_length=20,choices=ROLE_CHOICES,default='user')
    permissions=models.JSONField(default=list,blank=True)
    country=models.CharField(max_length=80,default='Pakistan',blank=True)
    avatar=models.TextField(blank=True)
    email_verified=models.BooleanField(default=True)
    def __str__(self): return f'{self.user.email} ({self.role})'

def profile_for(user):
    if not user or not getattr(user,'is_authenticated',False): return None
    cached=getattr(user,'_mcq_profile_cache',None)
    if cached is not None: return cached
    try: p=user.profile
    except Profile.DoesNotExist:
        p,_=Profile.objects.get_or_create(user=user,defaults={'role':'super-admin' if user.is_superuser else 'admin' if user.is_staff else 'user'})
    user._mcq_profile_cache=p
    return p

def user_role(user):
    if not user or not getattr(user,'is_authenticated',False): return 'user'
    if user.is_superuser: return 'super-admin'
    p=profile_for(user); return p.role if p else ('admin' if user.is_staff else 'user')
def user_permissions(user):
    p=profile_for(user); return p.permissions or [] if p else []
def user_name(user):
    if not user: return 'Unknown'
    return user.get_full_name().strip() or user.first_name.strip() or user.username or user.email

class OwnedStampedModel(models.Model):
    created_at=models.DateTimeField(default=timezone.now)
    updated_at=models.DateTimeField(auto_now=True)
    created_by=models.ForeignKey(User,null=True,blank=True,on_delete=models.SET_NULL,related_name='created_%(class)ss')
    updated_by=models.ForeignKey(User,null=True,blank=True,on_delete=models.SET_NULL,related_name='updated_%(class)ss')
    class Meta: abstract=True

class Category(OwnedStampedModel):
    id=models.BigIntegerField(primary_key=True); name=models.CharField(max_length=255); icon=models.TextField(blank=True,default='grid'); active=models.BooleanField(default=True)
class Subcategory(OwnedStampedModel):
    id=models.BigIntegerField(primary_key=True); name=models.CharField(max_length=255); icon=models.TextField(blank=True,default='grid'); category=models.ForeignKey(Category,on_delete=models.CASCADE,related_name='subcategories'); active=models.BooleanField(default=True)
class ChildCategory(OwnedStampedModel):
    id=models.BigIntegerField(primary_key=True); name=models.CharField(max_length=255); icon=models.TextField(blank=True,default='grid'); subcategory=models.ForeignKey(Subcategory,on_delete=models.CASCADE,related_name='children'); active=models.BooleanField(default=True)
class Paper(OwnedStampedModel):
    id=models.BigIntegerField(primary_key=True); name=models.CharField(max_length=255); country=models.CharField(max_length=80,default='Pakistan'); icon=models.TextField(blank=True,default='paper'); active=models.BooleanField(default=True)
class Job(OwnedStampedModel):
    id=models.BigIntegerField(primary_key=True); name=models.CharField(max_length=255); paper=models.ForeignKey(Paper,on_delete=models.CASCADE,related_name='jobs'); icon=models.TextField(blank=True,default='grid'); active=models.BooleanField(default=True)
class JobYear(OwnedStampedModel):
    id=models.BigIntegerField(primary_key=True); name=models.CharField(max_length=255); job=models.ForeignKey(Job,on_delete=models.CASCADE,related_name='years'); icon=models.TextField(blank=True,default='grid'); active=models.BooleanField(default=True)

class MCQ(OwnedStampedModel):
    STATUS=[('pending','Pending'),('approved','Approved'),('rejected','Rejected')]
    id=models.BigIntegerField(primary_key=True)
    question=models.TextField(); option1=models.TextField(); option2=models.TextField(); option3=models.TextField(); option4=models.TextField(); correct_answer=models.TextField(); description=models.TextField(blank=True)
    category=models.ForeignKey(Category,on_delete=models.PROTECT,related_name='mcqs')
    subcategory_ids=models.JSONField(default=list); child_subcategory_ids=models.JSONField(default=list); paper_ids=models.JSONField(default=list); job_ids=models.JSONField(default=list); job_year_ids=models.JSONField(default=list)
    country=models.CharField(max_length=80,default='Pakistan'); status=models.CharField(max_length=20,choices=STATUS,default='pending'); important=models.BooleanField(default=False)
    source=models.TextField(blank=True); seo_description=models.CharField(max_length=180,blank=True)
    reviewed_by=models.ForeignKey(User,null=True,blank=True,on_delete=models.SET_NULL,related_name='reviewed_mcqs'); approved_by=models.ForeignKey(User,null=True,blank=True,on_delete=models.SET_NULL,related_name='approved_mcqs')
    rejection_reason=models.TextField(blank=True); submission_type=models.CharField(max_length=30,default='new'); submitted_by=models.ForeignKey(User,null=True,blank=True,on_delete=models.SET_NULL,related_name='submitted_mcqs'); submitted_at=models.DateTimeField(default=timezone.now)
    pending_update=models.JSONField(null=True,blank=True); audit_history=models.JSONField(default=list,blank=True)

class Bookmark(models.Model):
    user=models.ForeignKey(User,on_delete=models.CASCADE,related_name='mcq_bookmarks'); mcq=models.ForeignKey(MCQ,on_delete=models.CASCADE); created_at=models.DateTimeField(auto_now_add=True)
    class Meta: constraints=[models.UniqueConstraint(fields=['user','mcq'],name='uniq_bookmark')]
class SavedPaper(models.Model):
    user=models.ForeignKey(User,on_delete=models.CASCADE,related_name='mcq_saved_papers'); paper=models.ForeignKey(Paper,on_delete=models.CASCADE); created_at=models.DateTimeField(auto_now_add=True)
    class Meta: constraints=[models.UniqueConstraint(fields=['user','paper'],name='uniq_saved_paper')]
class Attempt(models.Model):
    user=models.ForeignKey(User,on_delete=models.CASCADE,related_name='mcq_attempts'); mcq=models.ForeignKey(MCQ,on_delete=models.CASCADE); answer=models.TextField(); correct=models.BooleanField(default=False); created_at=models.DateTimeField(auto_now_add=True)
class Report(models.Model):
    user=models.ForeignKey(User,null=True,blank=True,on_delete=models.SET_NULL,related_name='mcq_reports'); mcq=models.ForeignKey(MCQ,on_delete=models.CASCADE); reason=models.TextField(); status=models.CharField(max_length=20,default='open'); created_at=models.DateTimeField(auto_now_add=True); resolved_at=models.DateTimeField(null=True,blank=True); resolved_by=models.ForeignKey(User,null=True,blank=True,on_delete=models.SET_NULL,related_name='resolved_mcq_reports')
class ContactMessage(models.Model):
    user=models.ForeignKey(User,null=True,blank=True,on_delete=models.SET_NULL); name=models.CharField(max_length=160,blank=True); email=models.EmailField(blank=True); message=models.TextField(); created_at=models.DateTimeField(auto_now_add=True)
class AuditLog(models.Model):
    user=models.ForeignKey(User,null=True,blank=True,on_delete=models.SET_NULL,related_name='mcq_audit_logs'); action=models.CharField(max_length=160); detail=models.TextField(blank=True); created_at=models.DateTimeField(auto_now_add=True)

class Guide(OwnedStampedModel):
    name=models.CharField(max_length=255); tag=models.CharField(max_length=80,default='STUDY SKILLS'); summary=models.TextField(blank=True); body=models.TextField(blank=True); published=models.BooleanField(default=True)
class Post(OwnedStampedModel):
    title=models.CharField(max_length=255); slug=models.SlugField(max_length=120,unique=True); excerpt=models.TextField(blank=True); body=models.TextField(blank=True); featured_image=models.URLField(blank=True); category=models.CharField(max_length=120,blank=True); seo_title=models.CharField(max_length=80,blank=True); seo_description=models.TextField(blank=True); links=models.JSONField(default=list,blank=True); status=models.CharField(max_length=20,default='draft')

class SiteSetting(models.Model):
    singleton=models.PositiveSmallIntegerField(primary_key=True,default=1,editable=False)
    site_name=models.CharField(max_length=120,default='MCQ Campus'); description=models.TextField(default='Explore subjects, practise MCQs and prepare with past papers.'); country=models.CharField(max_length=80,default='Pakistan')
    about=models.TextField(default='',blank=True); contact=models.TextField(default='',blank=True)
    seo_title=models.CharField(max_length=160,default='MCQ Campus'); seo_description=models.TextField(default='Explore subjects, practise MCQs and prepare with past papers.')
    admin_permissions=models.JSONField(default=dict,blank=True)
    google_analytics_id=models.CharField(max_length=40,blank=True); analytics_enabled=models.BooleanField(default=False)
    adsense_client_id=models.CharField(max_length=40,blank=True); adsense_enabled=models.BooleanField(default=False)
    updated_at=models.DateTimeField(auto_now=True); updated_by=models.ForeignKey(User,null=True,blank=True,on_delete=models.SET_NULL)
    @classmethod
    def get_solo(cls): return cls.objects.get_or_create(pk=1)[0]

class AdPlacement(OwnedStampedModel):
    PROVIDERS=[('custom','Custom company ad'),('adsense','Google AdSense')]
    PLACEMENTS=[('top_banner','Top banner'),('home_inline','Home inline'),('mcq_inline','MCQ inline'),('sidebar','Sidebar'),('footer','Footer')]
    name=models.CharField(max_length=160); provider=models.CharField(max_length=20,choices=PROVIDERS,default='custom'); placement=models.CharField(max_length=30,choices=PLACEMENTS,default='top_banner')
    title=models.CharField(max_length=180,blank=True); body=models.TextField(blank=True); image_url=models.URLField(blank=True); target_url=models.URLField(blank=True); adsense_slot=models.CharField(max_length=40,blank=True)
    active=models.BooleanField(default=True); starts_at=models.DateTimeField(null=True,blank=True); ends_at=models.DateTimeField(null=True,blank=True); priority=models.IntegerField(default=0)

class TrashRecord(models.Model):
    kind=models.CharField(max_length=50); name=models.CharField(max_length=255); payload=models.JSONField(default=dict); deleted_by=models.ForeignKey(User,null=True,blank=True,on_delete=models.SET_NULL); deleted_at=models.DateTimeField(auto_now_add=True)

class OneTimeToken(models.Model):
    PURPOSE=[('verify','Verify email'),('reset','Reset password')]
    user=models.ForeignKey(User,on_delete=models.CASCADE)
    purpose=models.CharField(max_length=20,choices=PURPOSE)
    # Keep the existing production column name while exposing the safer OTP-specific name in code.
    code_hash=models.CharField(max_length=64,unique=True,db_column='token_hash')
    expires_at=models.DateTimeField()
    used_at=models.DateTimeField(null=True,blank=True)
    attempt_count=models.PositiveSmallIntegerField(default=0)
    created_at=models.DateTimeField(auto_now_add=True)
