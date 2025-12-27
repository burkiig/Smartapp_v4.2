"""
Abstract base class for database adapters
Defines the interface that all adapters must implement
"""

from abc import ABC, abstractmethod
from typing import List, Dict, Optional, Any


class DatabaseAdapter(ABC):
    """Abstract base class for database operations"""
    
    # ==================== STUDENTS ====================
    
    @abstractmethod
    def get_students(self) -> List[Dict[str, Any]]:
        """Get all students"""
        pass
    
    @abstractmethod
    def get_student(self, student_id: str) -> Optional[Dict[str, Any]]:
        """Get a single student by ID"""
        pass
    
    @abstractmethod
    def create_student(self, student_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new student"""
        pass
    
    @abstractmethod
    def update_student(self, student_id: str, student_data: Dict[str, Any]) -> Dict[str, Any]:
        """Update an existing student"""
        pass
    
    @abstractmethod
    def delete_student(self, student_id: str) -> bool:
        """Delete a student"""
        pass
    
    # ==================== ATTENDANCE ====================
    
    @abstractmethod
    def get_attendance_records(self, date: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get attendance records, optionally filtered by date"""
        pass
    
    @abstractmethod
    def create_attendance_record(self, record_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new attendance record"""
        pass
    
    @abstractmethod
    def get_attendance_by_student(self, student_id: str) -> List[Dict[str, Any]]:
        """Get all attendance records for a specific student"""
        pass
    
    # ==================== USERS ====================
    
    @abstractmethod
    def get_users(self) -> List[Dict[str, Any]]:
        """Get all users"""
        pass
    
    @abstractmethod
    def get_user(self, username: str) -> Optional[Dict[str, Any]]:
        """Get a single user by username"""
        pass
    
    @abstractmethod
    def create_user(self, user_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new user"""
        pass
    
    @abstractmethod
    def update_user(self, username: str, user_data: Dict[str, Any]) -> Dict[str, Any]:
        """Update an existing user"""
        pass
    
    @abstractmethod
    def delete_user(self, username: str) -> bool:
        """Delete a user"""
        pass
    
    # ==================== COURSES ====================
    
    @abstractmethod
    def get_courses(self) -> List[Dict[str, Any]]:
        """Get all courses"""
        pass
    
    @abstractmethod
    def get_course(self, course_id: int) -> Optional[Dict[str, Any]]:
        """Get a single course by ID"""
        pass
    
    @abstractmethod
    def create_course(self, course_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new course"""
        pass
    
    @abstractmethod
    def delete_course(self, course_id: int) -> bool:
        """Delete a course"""
        pass
    
    # ==================== ROOMS ====================
    
    @abstractmethod
    def get_rooms(self) -> List[Dict[str, Any]]:
        """Get all rooms"""
        pass
    
    @abstractmethod
    def get_room(self, room_id: int) -> Optional[Dict[str, Any]]:
        """Get a single room by ID"""
        pass
    
    @abstractmethod
    def create_room(self, room_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new room"""
        pass
    
    @abstractmethod
    def delete_room(self, room_id: int) -> bool:
        """Delete a room"""
        pass
    
    # ==================== UTILITY ====================
    
    @abstractmethod
    def health_check(self) -> Dict[str, Any]:
        """Check database health and return status"""
        pass
