"""
Database package for Smart Attendance System
Supports both JSON and MongoDB backends via adapter pattern
"""

from .factory import get_database_adapter

__all__ = ['get_database_adapter']
