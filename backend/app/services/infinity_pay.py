"""InfinityPay service for checkout link generation."""
import logging
from typing import Dict, List, Optional
import httpx
from datetime import datetime, timezone

from fastapi import HTTPException, status
from app.core.config import settings

logger = logging.getLogger(__name__)

class InfinityPayService:
    def __init__(self):
        self.handle = settings.INFINITYPAY_HANDLE
        self.base_url = str(settings.INFINITYPAY_API_URL).rstrip("/")
        self.webhook_url = settings.INFINITYPAY_WEBHOOK_URL

    @staticmethod
    def _extract_checkout_url(data: Dict) -> Optional[str]:
        """Extract checkout URL across known InfinityPay response shapes."""
        if not isinstance(data, dict):
            return None

        direct = data.get("checkout_url") or data.get("url") or data.get("link")
        if isinstance(direct, str) and direct:
            return direct

        nested = data.get("data")
        if isinstance(nested, dict):
            nested_url = nested.get("checkout_url") or nested.get("url") or nested.get("link")
            if isinstance(nested_url, str) and nested_url:
                return nested_url

        return None

    @staticmethod
    def _sanitize_customer(customer: Dict) -> Dict:
        """
        Keep only checkout-safe identity fields for plan sales.

        Important:
        - Do NOT pass delivery/shipping address fields for SaaS plan purchases.
        - Ignore empty values.
        """
        if not isinstance(customer, dict):
            return {}

        allowed_keys = {"name", "email", "phone_number"}
        sanitized: Dict[str, str] = {}
        for key in allowed_keys:
            value = customer.get(key)
            if value is None:
                continue
            if isinstance(value, str):
                value = value.strip()
                if not value:
                    continue
            sanitized[key] = value

        return sanitized

    async def create_checkout_link(
        self,
        items: List[Dict],
        metadata: Dict,
        customer: Optional[Dict] = None,
        redirect_url: Optional[str] = None
    ) -> str:
        """
        Create a checkout link via InfinityPay.
        
        Args:
            items: List of items [{'quantity': 1, 'price': 1000, 'description': '...'}] (price in cents)
            metadata: Dict with 'order_nsu' (required) and other data
            customer: Optional customer data
            redirect_url: Optional return URL
            
        Returns:
            Checkout URL
        """
        if not self.handle:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
                detail="InfinityPay handle not configured"
            )

        payload = {
            "handle": self.handle,
            "items": items,
            "order_nsu": metadata.get("order_nsu"),
        }

        if redirect_url:
            payload["redirect_url"] = redirect_url
            
        if self.webhook_url:
            payload["webhook_url"] = self.webhook_url
            
        if customer:
            sanitized_customer = self._sanitize_customer(customer)
            if sanitized_customer:
                payload["customer"] = sanitized_customer

        logger.info(f"Creating InfinityPay checkout for order {metadata.get('order_nsu')}")
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(f"{self.base_url}/links", json=payload)
                response.raise_for_status()
                data = response.json()
                
                checkout_url = self._extract_checkout_url(data)
                if not checkout_url:
                    logger.error(f"InfinityPay response missing checkout URL: {data}")
                    raise HTTPException(
                        status_code=status.HTTP_502_BAD_GATEWAY,
                        detail="Payment provider did not return a checkout URL"
                    )

                return checkout_url
                
            except httpx.HTTPError as e:
                logger.error(f"InfinityPay API error: {e}")
                if hasattr(e, 'response') and e.response:
                    logger.error(f"Response: {e.response.text}")
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="Failed to create payment link"
                )

    async def verify_payment(self, transaction_id: str, order_nsu: str, slug: str) -> (bool, dict):
        """
        Verify payment status and return full transaction details.
        
        Args:
            transaction_id: The transaction NSU from InfinityPay
            order_nsu: The order NSU from our system
            slug: The invoice slug from InfinityPay
            
        Returns:
            Tuple (is_paid, transaction_data)
        """
        # If any required field is missing, we can't verify
        if not all([transaction_id, order_nsu, slug]):
             logger.warning("Missing params for verify_payment")
             return False, {}

        payload = {
            "handle": self.handle,
            "order_nsu": order_nsu,
            "transaction_nsu": transaction_id,
            "slug": slug
        }
        
        async with httpx.AsyncClient() as client:
            try:
                # Documentation endpoint: POST /payment_check
                response = await client.post(f"{self.base_url}/payment_check", json=payload)
                response.raise_for_status()
                data = response.json()
                
                # Check explicit 'paid' status
                is_paid = data.get("paid", False)
                return is_paid, data
                
            except httpx.HTTPError as e:
                logger.error(f"InfinityPay verification error: {e}")
                if hasattr(e, 'response') and e.response:
                     logger.error(f"Response: {e.response.text}")
                return False, {}

infinity_pay_service = InfinityPayService()
