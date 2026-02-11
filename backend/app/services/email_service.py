"""
Email Service using Resend

Sends transactional emails (e.g. invoices) with optional PDF attachments.
"""

import base64
import logging
from typing import Optional

import resend

from app.core.config import settings

logger = logging.getLogger(__name__)


def send_invoice_email(
    to: str,
    subject: str,
    html_body: str,
    pdf_bytes: Optional[bytes] = None,
    pdf_filename: Optional[str] = None,
) -> dict:
    """
    Send an invoice email, optionally attaching a PDF.

    Args:
        to: Recipient email address
        subject: Email subject line
        html_body: HTML content for the email body
        pdf_bytes: Raw PDF bytes to attach (optional)
        pdf_filename: Filename for the attachment (optional)

    Returns:
        Resend API response dict (contains 'id' on success)

    Raises:
        RuntimeError: If Resend is not configured
        resend.exceptions.*: On API errors
    """
    if not settings.RESEND_API_KEY:
        raise RuntimeError("RESEND_API_KEY is not configured")

    from_email = settings.RESEND_FROM_EMAIL or "noreply@safetasks.app"

    resend.api_key = settings.RESEND_API_KEY

    params: dict = {
        "from": from_email,
        "to": [to],
        "subject": subject,
        "html": html_body,
    }

    if pdf_bytes and pdf_filename:
        params["attachments"] = [
            {
                "filename": pdf_filename,
                "content": list(pdf_bytes),
            }
        ]

    response = resend.Emails.send(params)
    logger.info(f"Invoice email sent to {to} (resend id={response.get('id', 'unknown')})")
    return response
def send_email(
    to: list[str],
    subject: str,
    html: str,
) -> dict:
    if not settings.RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not set. Skipping email.")
        return {}

    from_email = settings.RESEND_FROM_EMAIL or "noreply@safetasks.app"
    resend.api_key = settings.RESEND_API_KEY

    params = {
        "from": from_email,
        "to": to,
        "subject": subject,
        "html": html,
    }
    
    try:
        response = resend.Emails.send(params)
        logger.info(f"Email sent to {to}: {subject}")
        return response
    except Exception as e:
        logger.error(f"Failed to send email to {to}: {e}")
        return {}


def send_plan_expiry_warning(to_email: str, org_name: str, days_left: int, renew_link: str):
    subject = f"Action Required: Your SafeTasks plan expires in {days_left} days"
    html = f"""
    <h1>Your plan is expiring soon</h1>
    <p>Hello,</p>
    <p>The Pro plan for <strong>{org_name}</strong> will expire in {days_left} days.</p>
    <p>To avoid losing access to premium features, please renew your plan now.</p>
    <br>
    <a href="{renew_link}" style="background:#000;color:#fff;padding:10px 20px;text-decoration:none;border-radius:5px;">Renew Plan</a>
    <br><br>
    <p>Or copy this link: {renew_link}</p>
    """
    return send_email([to_email], subject, html)


def send_plan_expired_notice(to_email: str, org_name: str, renew_link: str):
    subject = f"Your SafeTasks plan has expired"
    html = f"""
    <h1>Plan Expired</h1>
    <p>Hello,</p>
    <p>The Pro plan for <strong>{org_name}</strong> has expired today.</p>
    <p>You have lost access to premium features. Renew now to restore access immediately.</p>
    <br>
    <a href="{renew_link}" style="background:#000;color:#fff;padding:10px 20px;text-decoration:none;border-radius:5px;">Restore Access</a>
    """
    return send_email([to_email], subject, html)
