"""
Standardized error handling for Smart Attendance System
"""


class APIError(Exception):
    """Base API error class"""
    
    def __init__(self, message: str, status_code: int = 500, payload: dict = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.payload = payload or {}
    
    def to_dict(self):
        """Convert error to dictionary for JSON response"""
        response = {
            'error': self.message,
            'status': self.status_code
        }
        if self.payload:
            response.update(self.payload)
        return response


class ValidationError(APIError):
    """Raised when input validation fails"""
    
    def __init__(self, message: str, field: str = None):
        payload = {'field': field} if field else {}
        super().__init__(message, status_code=400, payload=payload)


class NotFoundError(APIError):
    """Raised when a resource is not found"""
    
    def __init__(self, resource: str, identifier: str):
        message = f"{resource} '{identifier}' not found"
        super().__init__(message, status_code=404, payload={'resource': resource, 'identifier': identifier})


class DuplicateError(APIError):
    """Raised when trying to create a duplicate resource"""
    
    def __init__(self, resource: str, identifier: str):
        message = f"{resource} '{identifier}' already exists"
        super().__init__(message, status_code=409, payload={'resource': resource, 'identifier': identifier})


class AuthenticationError(APIError):
    """Raised when authentication fails"""
    
    def __init__(self, message: str = "Authentication failed"):
        super().__init__(message, status_code=401)


class AuthorizationError(APIError):
    """Raised when user doesn't have permission"""
    
    def __init__(self, message: str = "Insufficient permissions"):
        super().__init__(message, status_code=403)


class DatabaseError(APIError):
    """Raised when database operation fails"""
    
    def __init__(self, message: str, original_error: Exception = None):
        payload = {'original_error': str(original_error)} if original_error else {}
        super().__init__(message, status_code=500, payload=payload)
