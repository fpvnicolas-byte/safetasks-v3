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
        self.base_url = settings.INFINITYPAY_API_URL
        self.webhook_url = settings.INFINITYPAY_WEBHOOK_URL

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
            payload["customer"] = customer

        logger.info(f"Creating InfinityPay checkout for order {metadata.get('order_nsu')}")
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(f"{self.base_url}/links", json=payload)
                response.raise_for_status()
                data = response.json()
                
                # Official documentation confirms 'checkout_url' is the key.
                checkout_url = data.get("checkout_url")
                if not checkout_url:
                    logger.error(f"InfinityPay response missing 'checkout_url': {data}")
                    # Fallback just in case, though doc confirms checksout_url
                    checkout_url = data.get("url") or data.get("link")
                
                return checkout_url
                
            except httpx.HTTPError as e:
                logger.error(f"InfinityPay API error: {e}")
                if hasattr(e, 'response') and e.response:
                    logger.error(f"Response: {e.response.text}")
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="Failed to create payment link"
                )

    async def verify_payment(self, transaction_id: str, order_nsu: str, slug: str) -> bool:
        """
        Verify payment status.
        """
        payload = {
            "handle": self.handle,
            "order_nsu": order_nsu,
            "transaction_nsu": transaction_id,
            "slug": slug
        }
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(f"{self.base_url}/payment_check", json=payload)
                response.raise_for_status()
                data = response.json()
                return data.get("paid", False)
            except httpx.HTTPError as e:
                logger.error(f"InfinityPay verification error: {e}")
                return False

infinity_pay_service = InfinityPayService()
