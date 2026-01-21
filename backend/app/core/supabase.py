from supabase import Client, create_client

from .config import settings


def get_supabase_client() -> Client:
    """
    Create and return a Supabase client instance.
    Used for interacting with Supabase Storage and Admin operations.
    """
    return create_client(
        supabase_url=settings.SUPABASE_URL,
        supabase_key=settings.SUPABASE_KEY,
    )