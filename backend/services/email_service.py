from __future__ import annotations

import logging
import os
import random
import smtplib
import string
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

logger = logging.getLogger(__name__)


def generate_otp() -> str:
    return "".join(random.choices(string.digits, k=6))


def send_otp_email(
    customer_email: str,
    customer_name: str,
    otp: str,
    hub_name: str,
    hub_address: str,
    package_id: str,
) -> None:
    """
    Send a clean HTML email to the customer with:
    - Their package ID
    - The hub name and address where their package is waiting
    - The 6-digit OTP in large styled text
    - Instruction: show this OTP to the hub owner to collect your package

    Runs synchronously — intended to be called via FastAPI BackgroundTasks
    which executes sync functions in a thread pool.
    """
    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER")
    smtp_password = os.getenv("SMTP_PASSWORD")
    sender_name = os.getenv("SMTP_SENDER_NAME", "NearDrop")

    if not smtp_user or not smtp_password:
        logger.warning(
            "SMTP credentials not configured (SMTP_USER / SMTP_PASSWORD) — OTP email skipped"
        )
        return

    html_body = f"""
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; background: #f4f4f4; padding: 20px; margin: 0;">
      <div style="max-width: 480px; margin: auto; background: white;
                  border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
        <div style="text-align: center; margin-bottom: 24px;">
          <span style="font-size: 22px; font-weight: bold; color: #00B4A6;">NearDrop</span>
        </div>
        <h2 style="color: #0F2137; margin-top: 0;">Your package is ready for pickup</h2>
        <p style="color: #444;">Hi {customer_name},</p>
        <p style="color: #444;">Your package <strong>{package_id}</strong> could not be
           delivered to your address. It is now safely stored at a NearDrop Hub near you.</p>
        <div style="background: #f8f8f8; border-radius: 8px; padding: 16px; margin: 20px 0;
                    border-left: 4px solid #00B4A6;">
          <p style="margin: 0; color: #888; font-size: 12px; text-transform: uppercase;
                    letter-spacing: 1px;">PICKUP LOCATION</p>
          <p style="margin: 6px 0 2px; font-size: 16px; font-weight: bold; color: #0F2137;">
            {hub_name}</p>
          <p style="margin: 0; color: #555; font-size: 14px;">{hub_address}</p>
        </div>
        <p style="color: #444;">Show this OTP to the hub owner to collect your package:</p>
        <div style="text-align: center; margin: 28px 0; padding: 20px;
                    background: #0F2137; border-radius: 10px;">
          <span style="font-size: 46px; font-weight: bold; letter-spacing: 14px;
                       color: #00B4A6; font-family: 'Courier New', monospace;">{otp}</span>
        </div>
        <p style="color: #888; font-size: 13px; text-align: center;">
          This OTP expires in 48 hours.<br>
          If you have questions, reply to this email.
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
        <p style="color: #bbb; font-size: 11px; text-align: center; margin: 0;">
          NearDrop — Intelligent Last-Mile Delivery
        </p>
      </div>
    </body>
    </html>
    """

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"Your NearDrop package is ready for pickup — OTP: {otp}"
    msg["From"] = f"{sender_name} <{smtp_user}>"
    msg["To"] = customer_email
    msg.attach(MIMEText(html_body, "html"))

    try:
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.ehlo()
            server.starttls()
            server.login(smtp_user, smtp_password)
            server.sendmail(smtp_user, customer_email, msg.as_string())
        logger.info(f"OTP email sent to {customer_email} for package {package_id}")
    except Exception as exc:
        logger.error(f"Failed to send OTP email to {customer_email}: {exc}")
