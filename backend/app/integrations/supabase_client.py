"""
Backward-compatibility shim.

All new code should import from app.adapters.supabase_storage instead:

    from app.adapters.supabase_storage import get_storage_adapter

This module is kept so that existing call-sites that do
    from app.integrations.supabase_client import get_supabase
continue to work without modification.
"""
from app.adapters.supabase_storage import _get_supabase_client as get_supabase

__all__ = ["get_supabase"]
