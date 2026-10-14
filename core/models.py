import re
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
    p=profile_for(user)
    permissions=p.permissions or [] if p else []
    # Keep elevated account access consistent even if an older profile still says "user".
    if 'super_admin_permission' in permissions: return 'super-admin'
    if p and p.role in {'admin','super-admin'}: return p.role
    # Django staff accounts are administrative accounts even if their legacy Profile role was never updated.
    if getattr(user,'is_staff',False): return 'admin'
    return p.role if p else 'user'
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
    # Public-facing organization / board. Kept as Paper for database compatibility.
    id=models.BigIntegerField(primary_key=True); name=models.CharField(max_length=255); country=models.CharField(max_length=80,default='Pakistan'); icon=models.TextField(blank=True,default='paper'); active=models.BooleanField(default=True)
class Job(OwnedStampedModel):
    # Legacy model kept temporarily so older installs can upgrade without losing references.
    # The hierarchy migration removes legacy Job rows after moving JobYear records to Paper.
    id=models.BigIntegerField(primary_key=True); name=models.CharField(max_length=255); paper=models.ForeignKey(Paper,on_delete=models.CASCADE,related_name='legacy_jobs'); icon=models.TextField(blank=True,default='grid'); active=models.BooleanField(default=True)
class JobYear(OwnedStampedModel):
    # Public-facing Past Paper belongs directly to an organization / board.
    id=models.BigIntegerField(primary_key=True); name=models.CharField(max_length=255)
    paper=models.ForeignKey(Paper,null=True,blank=True,on_delete=models.CASCADE,related_name='past_papers')
    job=models.ForeignKey(Job,null=True,blank=True,on_delete=models.SET_NULL,related_name='legacy_years')
    icon=models.TextField(blank=True,default='grid'); active=models.BooleanField(default=True)

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
    site_name=models.CharField(max_length=120,default='MCQCampus'); description=models.TextField(default='Explore subjects, practise MCQs and prepare with past papers.'); country=models.CharField(max_length=80,default='Pakistan')
    about=models.TextField(default='',blank=True); contact=models.TextField(default='',blank=True)
    seo_title=models.CharField(max_length=160,default='MCQCampus'); seo_description=models.TextField(default='Explore subjects, practise MCQs and prepare with past papers.')
    admin_permissions=models.JSONField(default=dict,blank=True)
    google_analytics_id=models.CharField(max_length=40,blank=True); analytics_enabled=models.BooleanField(default=False)
    adsense_client_id=models.CharField(max_length=40,blank=True); adsense_enabled=models.BooleanField(default=False)
    updated_at=models.DateTimeField(auto_now=True); updated_by=models.ForeignKey(User,null=True,blank=True,on_delete=models.SET_NULL)
    @classmethod
    def get_solo(cls):
        obj,_=cls.objects.get_or_create(pk=1)
        def branded(value):
            if isinstance(value,str): return re.sub(r'\bMCQs?\s*Campus\b','MCQCampus',value,flags=re.I)
            if isinstance(value,list): return [branded(item) for item in value]
            if isinstance(value,dict): return {key:branded(item) for key,item in value.items()}
            return value
        changed=[]
        for field in ('site_name','description','about','contact','seo_title','seo_description'):
            current=getattr(obj,field)
            updated=branded(current)
            if updated!=current:
                setattr(obj,field,updated); changed.append(field)
        permissions=branded(obj.admin_permissions)
        if permissions!=obj.admin_permissions:
            obj.admin_permissions=permissions; changed.append('admin_permissions')
        if changed:
            obj.save(update_fields=[*changed,'updated_at'])
        return obj

class AdPlacement(OwnedStampedModel):
    PROVIDERS=[('custom','Custom company ad'),('adsense','Google AdSense'),('custom_code','Custom Ad Code')]
    PLACEMENTS=[('top_banner','Top banner'),('home_inline','Home inline'),('mcq_inline','MCQ inline'),('sidebar','Sidebar'),('footer','Footer')]
    name=models.CharField(max_length=160); provider=models.CharField(max_length=20,choices=PROVIDERS,default='custom'); placement=models.CharField(max_length=30,choices=PLACEMENTS,default='top_banner')
    title=models.CharField(max_length=180,blank=True); body=models.TextField(blank=True); image_url=models.URLField(blank=True); target_url=models.URLField(blank=True); adsense_slot=models.CharField(max_length=40,blank=True)
    active=models.BooleanField(default=True); starts_at=models.DateTimeField(null=True,blank=True); ends_at=models.DateTimeField(null=True,blank=True); priority=models.IntegerField(default=0)

class TrashRecord(models.Model):
    kind=models.CharField(max_length=50); name=models.CharField(max_length=255); payload=models.JSONField(default=dict); deleted_by=models.ForeignKey(User,null=True,blank=True,on_delete=models.SET_NULL); deleted_at=models.DateTimeField(auto_now_add=True)

class PendingSignup(models.Model):
    email=models.EmailField(unique=True)
    first_name=models.CharField(max_length=150)
    last_name=models.CharField(max_length=150)
    country=models.CharField(max_length=80,default='Pakistan')
    password_hash=models.CharField(max_length=128)
    code_hash=models.CharField(max_length=64)
    expires_at=models.DateTimeField()
    attempt_count=models.PositiveSmallIntegerField(default=0)
    last_sent_at=models.DateTimeField(default=timezone.now)
    created_at=models.DateTimeField(auto_now_add=True)
    updated_at=models.DateTimeField(auto_now=True)

class OneTimeToken(models.Model):
    PURPOSE=[('verify','Verify email'),('reset','Reset password'),('change','Change password')]
    user=models.ForeignKey(User,on_delete=models.CASCADE)
    purpose=models.CharField(max_length=20,choices=PURPOSE)
    # Keep the existing production column name while exposing the safer OTP-specific name in code.
    code_hash=models.CharField(max_length=64,unique=True,db_column='token_hash')
    expires_at=models.DateTimeField()
    used_at=models.DateTimeField(null=True,blank=True)
    attempt_count=models.PositiveSmallIntegerField(default=0)
    created_at=models.DateTimeField(auto_now_add=True)
