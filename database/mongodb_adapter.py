"""
MongoDB database adapter
Implements DatabaseAdapter interface using MongoDB for storage
"""

from typing import List, Dict, Optional, Any
from datetime import datetime
from pymongo import MongoClient, ASCENDING
from pymongo.errors import ConnectionFailure, DuplicateKeyError
from .base import DatabaseAdapter
from .schemas import SCHEMAS


class MongoDBAdapter(DatabaseAdapter):
    """MongoDB database implementation"""
    
    def __init__(self, connection_uri: str, database_name: str):
        self.client = MongoClient(connection_uri)
        self.db = self.client[database_name]
        
        # Initialize collections with schema validation
        self._init_collections()
        
        # Create indexes
        self._create_indexes()
    
    def _init_collections(self):
        """Initialize collections with schema validation"""
        existing_collections = self.db.list_collection_names()
        
        for collection_name, schema in SCHEMAS.items():
            if collection_name not in existing_collections:
                # Create collection with validation
                self.db.create_collection(
                    collection_name,
                    validator={'$jsonSchema': schema}
                )
            else:
                # Update validation for existing collection
                self.db.command('collMod', collection_name, validator={'$jsonSchema': schema})
    
    def _create_indexes(self):
        """Create indexes for better query performance"""
        # Students indexes
        self.db.students.create_index([('student_id', ASCENDING)], unique=True)
        
        # Attendance indexes
        self.db.attendance_logs.create_index([('student_id', ASCENDING)])
        self.db.attendance_logs.create_index([('timestamp', ASCENDING)])
        
        # Users indexes
        self.db.users.create_index([('username', ASCENDING)], unique=True)
        self.db.users.create_index([('email', ASCENDING)], unique=True)
        
        # Courses indexes
        self.db.courses.create_index([('code', ASCENDING)], unique=True)
        
        # Rooms indexes
        self.db.rooms.create_index([('name', ASCENDING)], unique=True)
    
    def _convert_id(self, doc: Optional[Dict]) -> Optional[Dict]:
        """Convert MongoDB _id to string and remove it"""
        if doc and '_id' in doc:
            doc.pop('_id')
        return doc
    
    # ==================== STUDENTS ====================
    
    def get_students(self) -> List[Dict[str, Any]]:
        """Get all students"""
        students = list(self.db.students.find())
        return [self._convert_id(s) for s in students]
    
    def get_student(self, student_id: str) -> Optional[Dict[str, Any]]:
        """Get a single student by ID"""
        student = self.db.students.find_one({'student_id': student_id})
        return self._convert_id(student)
    
    def create_student(self, student_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new student"""
        if 'registered_at' not in student_data:
            student_data['registered_at'] = datetime.now()
        
        try:
            self.db.students.insert_one(student_data.copy())
            return self._convert_id(student_data)
        except DuplicateKeyError:
            raise ValueError(f"Student {student_data.get('student_id')} already exists")
    
    def update_student(self, student_id: str, student_data: Dict[str, Any]) -> Dict[str, Any]:
        """Update an existing student"""
        student_data['updated_at'] = datetime.now()
        
        result = self.db.students.update_one(
            {'student_id': student_id},
            {'$set': student_data}
        )
        
        if result.matched_count == 0:
            raise ValueError(f"Student {student_id} not found")
        
        return self.get_student(student_id)
    
    def delete_student(self, student_id: str) -> bool:
        """Delete a student"""
        result = self.db.students.delete_one({'student_id': student_id})
        return result.deleted_count > 0
    
    # ==================== ATTENDANCE ====================
    
    def get_attendance_records(self, date: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get attendance records, optionally filtered by date"""
        query = {}
        
        if date:
            # Parse date and create range query
            start_date = datetime.fromisoformat(date)
            end_date = datetime.fromisoformat(f"{date}T23:59:59")
            query['timestamp'] = {'$gte': start_date, '$lte': end_date}
        
        records = list(self.db.attendance_logs.find(query))
        return [self._convert_id(r) for r in records]
    
    def create_attendance_record(self, record_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new attendance record"""
        if 'timestamp' not in record_data:
            record_data['timestamp'] = datetime.now()
        
        self.db.attendance_logs.insert_one(record_data.copy())
        return self._convert_id(record_data)
    
    def get_attendance_by_student(self, student_id: str) -> List[Dict[str, Any]]:
        """Get all attendance records for a specific student"""
        records = list(self.db.attendance_logs.find({'student_id': student_id}))
        return [self._convert_id(r) for r in records]
    
    # ==================== USERS ====================
    
    def get_users(self) -> List[Dict[str, Any]]:
        """Get all users"""
        users = list(self.db.users.find())
        return [self._convert_id(u) for u in users]
    
    def get_user(self, username: str) -> Optional[Dict[str, Any]]:
        """Get a single user by username"""
        user = self.db.users.find_one({'username': username})
        return self._convert_id(user)
    
    def create_user(self, user_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new user"""
        user_data['created_at'] = datetime.now()
        
        try:
            self.db.users.insert_one(user_data.copy())
            return self._convert_id(user_data)
        except DuplicateKeyError:
            raise ValueError(f"User {user_data.get('username')} already exists")
    
    def update_user(self, username: str, user_data: Dict[str, Any]) -> Dict[str, Any]:
        """Update an existing user"""
        user_data['updated_at'] = datetime.now()
        
        result = self.db.users.update_one(
            {'username': username},
            {'$set': user_data}
        )
        
        if result.matched_count == 0:
            raise ValueError(f"User {username} not found")
        
        return self.get_user(username)
    
    def delete_user(self, username: str) -> bool:
        """Delete a user"""
        result = self.db.users.delete_one({'username': username})
        return result.deleted_count > 0
    
    # ==================== COURSES ====================
    
    def get_courses(self) -> List[Dict[str, Any]]:
        """Get all courses"""
        courses = list(self.db.courses.find())
        return [self._convert_id(c) for c in courses]
    
    def get_course(self, course_id: int) -> Optional[Dict[str, Any]]:
        """Get a single course by ID"""
        course = self.db.courses.find_one({'id': course_id})
        return self._convert_id(course)
    
    def create_course(self, course_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new course"""
        # Auto-increment ID
        last_course = self.db.courses.find_one(sort=[('id', -1)])
        course_data['id'] = (last_course['id'] + 1) if last_course else 1
        course_data['created_at'] = datetime.now()
        
        self.db.courses.insert_one(course_data.copy())
        return self._convert_id(course_data)
    
    def delete_course(self, course_id: int) -> bool:
        """Delete a course"""
        result = self.db.courses.delete_one({'id': course_id})
        return result.deleted_count > 0
    
    # ==================== ROOMS ====================
    
    def get_rooms(self) -> List[Dict[str, Any]]:
        """Get all rooms"""
        rooms = list(self.db.rooms.find())
        return [self._convert_id(r) for r in rooms]
    
    def get_room(self, room_id: int) -> Optional[Dict[str, Any]]:
        """Get a single room by ID"""
        room = self.db.rooms.find_one({'id': room_id})
        return self._convert_id(room)
    
    def create_room(self, room_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new room"""
        # Auto-increment ID
        last_room = self.db.rooms.find_one(sort=[('id', -1)])
        room_data['id'] = (last_room['id'] + 1) if last_room else 1
        room_data['created_at'] = datetime.now()
        
        self.db.rooms.insert_one(room_data.copy())
        return self._convert_id(room_data)
    
    def delete_room(self, room_id: int) -> bool:
        """Delete a room"""
        result = self.db.rooms.delete_one({'id': room_id})
        return result.deleted_count > 0
    
    # ==================== UTILITY ====================
    
    def health_check(self) -> Dict[str, Any]:
        """Check database health and return status"""
        try:
            # Ping the database
            self.client.admin.command('ping')
            
            # Get collection stats
            collections_count = len(self.db.list_collection_names())
            
            return {
                'status': 'healthy',
                'type': 'mongodb',
                'database': self.db.name,
                'collections': collections_count,
                'connected': True
            }
        except ConnectionFailure as e:
            return {
                'status': 'unhealthy',
                'type': 'mongodb',
                'error': str(e),
                'connected': False
            }
