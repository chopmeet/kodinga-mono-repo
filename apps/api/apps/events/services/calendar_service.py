from datetime import timezone as dt_tz

from django.utils import timezone

from apps.events.models.event import Event


class CalendarService:
    """
    Generates standard RFC 5545 iCalendar (.ics) format files for Google Calendar,
    Apple Calendar, and Outlook.
    """

    @classmethod
    def format_ics_date(cls, dt) -> str:
        """Format datetime to UTC iCalendar format (YYYYMMDDTHHMMSSZ)."""
        if timezone.is_aware(dt):
            utc_dt = dt.astimezone(dt_tz.utc)
        else:
            utc_dt = timezone.make_aware(dt, dt_tz.utc)
        return utc_dt.strftime("%Y%m%dT%H%M%SZ")

    @classmethod
    def generate_ics(cls, event: Event) -> str:
        """
        Builds standard RFC 5545 iCalendar payload string.
        """
        now_str = cls.format_ics_date(timezone.now())
        start_str = cls.format_ics_date(event.start_time)
        end_str = cls.format_ics_date(event.end_time)

        # Sanitize summary and description
        summary = event.title.replace("\n", " ")
        description = (event.description or "").replace("\n", "\\n").replace("\r", "")
        location = event.location_url or (
            f"LiveKit: {event.live_room_name}"
            if event.live_room_name
            else "Kodinga Community Space"
        )

        uid = f"event-{event.id}@kodinga.com"

        lines = [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "PRODID:-//Kodinga Platform//Events//FR",
            "CALSCALE:GREGORIAN",
            "METHOD:PUBLISH",
            "BEGIN:VEVENT",
            f"UID:{uid}",
            f"DTSTAMP:{now_str}",
            f"DTSTART:{start_str}",
            f"DTEND:{end_str}",
            f"SUMMARY:{summary}",
            f"DESCRIPTION:{description}",
            f"LOCATION:{location}",
            f"STATUS:{'CONFIRMED' if event.status != 'cancelled' else 'CANCELLED'}",
            "END:VEVENT",
            "END:VCALENDAR",
        ]
        return "\r\n".join(lines) + "\r\n"
