from .models import AuditEvent


def audit(event_type, user=None, metadata=None):
    AuditEvent.objects.create(
        event_type=event_type,
        actor=user if user and user.is_authenticated else None,
        actor_email=user.email if user and user.is_authenticated else "",
        metadata=metadata or {},
    )
