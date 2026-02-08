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
