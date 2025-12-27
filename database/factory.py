"""
Database adapter factory
Returns the appropriate database adapter based on configuration
"""

import os
from .base import DatabaseAdapter
from .json_adapter import JSONAdapter
from .mongodb_adapter import MongoDBAdapter


def get_database_adapter() -> DatabaseAdapter:
    """
    Factory function to get the appropriate database adapter
    based on environment configuration
    
    Returns:
        DatabaseAdapter: Either JSONAdapter or MongoDBAdapter
    """
    use_mongodb = os.getenv('USE_MONGODB', 'false').lower() == 'true'
    
    if use_mongodb:
        # MongoDB configuration
        mongodb_uri = os.getenv('MONGODB_URI', 'mongodb://localhost:27017/')
        mongodb_database = os.getenv('MONGODB_DATABASE', 'smart_attendance')
        
        return MongoDBAdapter(
            connection_uri=mongodb_uri,
            database_name=mongodb_database
        )
    else:
        # JSON configuration
        base_dir = os.getenv('JSON_BASE_DIR', 'static')
        return JSONAdapter(base_dir=base_dir)
