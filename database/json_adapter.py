"""
JSON file-based database adapter
Implements DatabaseAdapter interface using JSON files for storage
"""

import json
import os
from typing import List, Dict, Optional, Any
from datetime import datetime
from .base import DatabaseAdapter


class JSONAdapter(DatabaseAdapter):
    """JSON file-based database implementation"""
    
    def __init__(self, base_dir: str = 'static'):
        self.base_dir = base_dir
        self.students_file = os.path.join(base_dir, 'students.json')
        self.attendance_file = os.path.join(base_dir, 'attendance', 'records.json')
        self.users_file = os.path.join(base_dir, 'users.json')
        self.courses_file = os.path.join(base_dir, 'courses.json')
        self.rooms_file = os.path.join(base_dir, 'rooms.json')
        
        # Ensure directories exist
        os.makedirs(os.path.join(base_dir, 'attendance'), exist_ok=True)
        
        # Initialize files if they don't exist
        self._init_file(self.students_file, {})
        self._init_file(self.attendance_file, [])
        self._init_file(self.users_file, {})
        self._init_file(self.courses_file, [])
        self._init_file(self.rooms_file, [])
    
    def _init_file(self, filepath: str, default_data: Any):
        """Initialize a JSON file if it doesn't exist"""
        if not os.path.exists(filepath):
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(default_data, f, ensure_ascii=False, indent=2)
    
    def _read_json(self, filepath: str) -> Any:
        """Read and parse a JSON file"""
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            return {} if 'students' in filepath or 'users' in filepath else []
    
    def _write_json(self, filepath: str, data: Any):
        """Write data to a JSON file"""
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    
    # ==================== STUDENTS ====================
    
    def get_students(self) -> List[Dict[str, Any]]:
        """Get all students"""
        students_dict = self._read_json(self.students_file)
        return list(students_dict.values())
    
    def get_student(self, student_id: str) -> Optional[Dict[str, Any]]:
        """Get a single student by ID"""
        students_dict = self._read_json(self.students_file)
        return students_dict.get(student_id)
    
    def create_student(self, student_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new student"""
        students_dict = self._read_json(self.students_file)
        student_id = student_data['student_id']
        
        # Add timestamp if not present
        if 'registered_at' not in student_data:
            student_data['registered_at'] = datetime.now().isoformat()
        
        students_dict[student_id] = student_data
        self._write_json(self.students_file, students_dict)
        return student_data
    
    def update_student(self, student_id: str, student_data: Dict[str, Any]) -> Dict[str, Any]:
        """Update an existing student"""
        students_dict = self._read_json(self.students_file)
        
        if student_id not in students_dict:
            raise ValueError(f"Student {student_id} not found")
        
        # Merge existing data with updates
        students_dict[student_id].update(student_data)
        students_dict[student_id]['updated_at'] = datetime.now().isoformat()
        
        self._write_json(self.students_file, students_dict)
        return students_dict[student_id]
    
    def delete_student(self, student_id: str) -> bool:
        """Delete a student"""
        students_dict = self._read_json(self.students_file)
        
        if student_id in students_dict:
            del students_dict[student_id]
            self._write_json(self.students_file, students_dict)
            return True
        return False
    
    # ==================== ATTENDANCE ====================
    
    def get_attendance_records(self, date: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get attendance records, optionally filtered by date"""
        records = self._read_json(self.attendance_file)
        
        if date:
            return [r for r in records if r.get('timestamp', '').startswith(date)]
        return records
    
    def create_attendance_record(self, record_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new attendance record"""
        records = self._read_json(self.attendance_file)
        
        # Add timestamp if not present
        if 'timestamp' not in record_data:
            record_data['timestamp'] = datetime.now().isoformat()
        
        records.append(record_data)
        self._write_json(self.attendance_file, records)
        return record_data
    
    def get_attendance_by_student(self, student_id: str) -> List[Dict[str, Any]]:
        """Get all attendance records for a specific student"""
        records = self._read_json(self.attendance_file)
        return [r for r in records if r.get('student_id') == student_id]
    
    # ==================== USERS ====================
    
    def get_users(self) -> List[Dict[str, Any]]:
        """Get all users"""
        users_dict = self._read_json(self.users_file)
        return list(users_dict.values())
    
    def get_user(self, username: str) -> Optional[Dict[str, Any]]:
        """Get a single user by username"""
        users_dict = self._read_json(self.users_file)
        return users_dict.get(username)
    
    def create_user(self, user_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new user"""
        users_dict = self._read_json(self.users_file)
        username = user_data['username']
        
        user_data['created_at'] = datetime.now().isoformat()
        users_dict[username] = user_data
        self._write_json(self.users_file, users_dict)
        return user_data
    
    def update_user(self, username: str, user_data: Dict[str, Any]) -> Dict[str, Any]:
        """Update an existing user"""
        users_dict = self._read_json(self.users_file)
        
        if username not in users_dict:
            raise ValueError(f"User {username} not found")
        
        users_dict[username].update(user_data)
        users_dict[username]['updated_at'] = datetime.now().isoformat()
        
        self._write_json(self.users_file, users_dict)
        return users_dict[username]
    
    def delete_user(self, username: str) -> bool:
        """Delete a user"""
        users_dict = self._read_json(self.users_file)
        
        if username in users_dict:
            del users_dict[username]
            self._write_json(self.users_file, users_dict)
            return True
        return False
    
    # ==================== COURSES ====================
    
    def get_courses(self) -> List[Dict[str, Any]]:
        """Get all courses"""
        return self._read_json(self.courses_file)
    
    def get_course(self, course_id: int) -> Optional[Dict[str, Any]]:
        """Get a single course by ID"""
        courses = self._read_json(self.courses_file)
        for course in courses:
            if course.get('id') == course_id:
                return course
        return None
    
    def create_course(self, course_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new course"""
        courses = self._read_json(self.courses_file)
        
        # Auto-generate ID
        course_data['id'] = max([c.get('id', 0) for c in courses], default=0) + 1
        course_data['created_at'] = datetime.now().isoformat()
        
        courses.append(course_data)
        self._write_json(self.courses_file, courses)
        return course_data
    
    def delete_course(self, course_id: int) -> bool:
        """Delete a course"""
        courses = self._read_json(self.courses_file)
        original_length = len(courses)
        
        courses = [c for c in courses if c.get('id') != course_id]
        
        if len(courses) < original_length:
            self._write_json(self.courses_file, courses)
            return True
        return False
    
    # ==================== ROOMS ====================
    
    def get_rooms(self) -> List[Dict[str, Any]]:
        """Get all rooms"""
        return self._read_json(self.rooms_file)
    
    def get_room(self, room_id: int) -> Optional[Dict[str, Any]]:
        """Get a single room by ID"""
        rooms = self._read_json(self.rooms_file)
        for room in rooms:
            if room.get('id') == room_id:
                return room
        return None
    
    def create_room(self, room_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new room"""
        rooms = self._read_json(self.rooms_file)
        
        # Auto-generate ID
        room_data['id'] = max([r.get('id', 0) for r in rooms], default=0) + 1
        room_data['created_at'] = datetime.now().isoformat()
        
        rooms.append(room_data)
        self._write_json(self.rooms_file, rooms)
        return room_data
    
    def delete_room(self, room_id: int) -> bool:
        """Delete a room"""
        rooms = self._read_json(self.rooms_file)
        original_length = len(rooms)
        
        rooms = [r for r in rooms if r.get('id') != room_id]
        
        if len(rooms) < original_length:
            self._write_json(self.rooms_file, rooms)
            return True
        return False
    
    # ==================== UTILITY ====================
    
    def health_check(self) -> Dict[str, Any]:
        """Check database health and return status"""
        try:
            # Check if all files are accessible
            files_ok = all([
                os.path.exists(self.students_file),
                os.path.exists(self.attendance_file),
                os.path.exists(self.users_file),
                os.path.exists(self.courses_file),
                os.path.exists(self.rooms_file)
            ])
            
            return {
                'status': 'healthy' if files_ok else 'degraded',
                'type': 'json',
                'files_accessible': files_ok,
                'base_dir': self.base_dir
            }
        except Exception as e:
            return {
                'status': 'unhealthy',
                'type': 'json',
                'error': str(e)
            }
