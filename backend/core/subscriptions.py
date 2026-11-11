"""Subscription entitlements and manual Raast payment helpers.

Premium decisions are made on the server. The frontend only displays the
resulting locked/free state and cannot grant access by changing browser data.
"""
from datetime import timedelta

from django.utils import timezone

from .models import (
    MCQ, Subscription, SubscriptionConfig, SubscriptionPaymentProof,
)


PLAN_DAYS = {'monthly': 30, 'quarterly': 90, 'yearly': 365}
PLAN_KEYS = tuple(PLAN_DAYS)


def get_subscription_config():
    config = SubscriptionConfig.get_solo()
    raw = config.free_access if isinstance(config.free_access, dict) else {}
    # Upgrade untouched installations from the original 1/1/1 defaults.
    # Explicit Super Admin changes are preserved via updated_by.
    if all(
        str(raw.get(key, 1)) == '1'
        for key in ('regular_levels', 'important_levels', 'category_levels')
    ) and not raw.get('free_past_paper_ids'):
        upgraded = dict(raw)
        upgraded.update({
            'regular_levels': 10,
            'important_levels': 5,
            'category_levels': 1,
        })
        config.free_access = upgraded
        config.save(update_fields=['free_access', 'updated_at'])
    return config


def current_subscription(user, now=None):
    if not user or not getattr(user, 'is_authenticated', False):
        return None
    now = now or timezone.now()
    return (
        Subscription.objects
        .filter(user=user, is_active=True, ends_at__gt=now)
        .first()
    )


def has_premium_access(user, now=None):
    return current_subscription(user, now=now) is not None


def subscription_payload(user):
    row = current_subscription(user)
    if not row:
        return {'active': False, 'plan': None, 'starts_at': None, 'ends_at': None}
    return {
        'active': True,
        'plan': row.plan,
        'starts_at': row.starts_at.isoformat(),
        'ends_at': row.ends_at.isoformat(),
        'days_remaining': max(0, (row.ends_at - timezone.now()).days),
    }


def normalized_free_access(config=None):
    config = config or get_subscription_config()
    raw = config.free_access if isinstance(config.free_access, dict) else {}
    def level(key, default=None):
        if default is None:
            default = {'regular_levels': 10, 'important_levels': 5, 'category_levels': 1}.get(key, 1)
        try:
            return max(0, min(10, int(raw.get(key, default))))
        except (TypeError, ValueError):
            return default
    def ids(key):
        result = []
        for value in raw.get(key, []) if isinstance(raw.get(key, []), (list, tuple)) else []:
            try:
                ident = int(value)
                if 0 < ident <= 2147483647 and ident not in result:
                    result.append(ident)
            except (TypeError, ValueError):
                continue
        return result[:2000]
    return {
        'regular_levels': level('regular_levels'),
        'important_levels': level('important_levels'),
        'category_levels': level('category_levels'),
        'free_past_paper_ids': ids('free_past_paper_ids'),
        'free_pdf_ids': ids('free_pdf_ids'),
    }


def free_mcq_ids(user=None, country=None, config=None):
    """IDs covered by the configured free allowance for an unpaid learner."""
    if has_premium_access(user):
        return None
    if user and getattr(user, 'is_authenticated', False):
        profile = getattr(user, 'profile', None)
        role = getattr(profile, 'role', 'user')
        if user.is_superuser or user.is_staff or role in {'admin', 'super-admin'}:
            return None

    config = config or get_subscription_config()
    free = normalized_free_access(config)
    regular_limit = free['regular_levels'] * 100
    important_limit = free['important_levels'] * 100
    category_limit = free['category_levels'] * 100
    allowed = set()
    regular_count = important_count = 0
    category_counts = {}

    rows = MCQ.objects.filter(status='approved')
    if country:
        rows = rows.filter(country__iexact=str(country).strip())
    for ident, category_id, manual_important, year_ids in rows.order_by('id').values_list(
        'id', 'category_id', 'important', 'job_year_ids'
    ).iterator(chunk_size=2000):
        linked_years = set()
        for value in year_ids or []:
            try:
                linked_years.add(int(value))
            except (TypeError, ValueError):
                continue
        is_important = bool(manual_important) or len(linked_years) >= 2
        category_count = category_counts.get(category_id, 0)
        category_counts[category_id] = category_count + 1
        included = category_count < category_limit
        if is_important:
            included = included or important_count < important_limit
            important_count += 1
        else:
            included = included or regular_count < regular_limit
            regular_count += 1
        if included:
            allowed.add(int(ident))
    return allowed


def plan_payload(config=None):
    config = config or get_subscription_config()
    stored = config.plans if isinstance(config.plans, dict) else {}
    defaults = SubscriptionConfig._meta.get_field('plans').get_default()
    result = {}
    for key in ('free',) + PLAN_KEYS:
        source = stored.get(key) if isinstance(stored.get(key), dict) else {}
        fallback = defaults.get(key, {})
        features = source.get('features', fallback.get('features', []))
        if key == 'free':
            features = [
                'First 10 levels of Regular MCQs',
                'First 5 levels of Important MCQs',
                'First level in each category',
                'All Past Papers require a Premium subscription',
                'Latest jobs with application links',
                'All blogs and helping articles',
            ]
        if not isinstance(features, list):
            features = []
        item = {
            'key': key,
            'name': str(source.get('name') or fallback.get('name') or key.title())[:100],
            'amount': 0 if key == 'free' else max(1, int(source.get('amount') or fallback.get('amount') or 1)),
            'days': 0 if key == 'free' else PLAN_DAYS[key],
            'period': str(source.get('period') or fallback.get('period') or '')[:40],
            'tagline': str(source.get('tagline') or fallback.get('tagline') or '')[:180],
            'features': [str(x)[:180] for x in features[:16] if str(x).strip()],
            'active': True if key == 'free' else source.get('active', fallback.get('active', True)) is not False,
        }
        result[key] = item
    return result


def public_pricing_payload(user=None):
    config = get_subscription_config()
    return {
        'plans': plan_payload(config),
        'raast_id': config.raast_id,
        'qr_url': '/api/subscription/qr' if config.qr_image else '',
        'subscription': subscription_payload(user),
        'requires_login': not bool(user and getattr(user, 'is_authenticated', False)),
    }


def proof_payload(row):
    return {
        'id': row.id,
        'reference': f'PAY-{row.id:06d}',
        'name': row.full_name,
        'email': row.email,
        'user_id': row.user_id,
        'username': row.user.get_username(),
        'plan': row.plan,
        'plan_name': row.plan_name,
        'amount': row.amount,
        'transaction_id': row.transaction_id,
        'status': row.status,
        'review_note': row.review_note,
        'created_at': row.created_at.isoformat(),
        'reviewed_at': row.reviewed_at.isoformat() if row.reviewed_at else None,
        'screenshot_url': f'/api/admin/subscriptions/{row.id}/screenshot',
    }
