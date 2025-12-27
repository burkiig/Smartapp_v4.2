"""
MongoDB schema validation definitions
Ensures data consistency in MongoDB collections
"""

# Students Collection Schema
STUDENT_SCHEMA = {
    "bsonType": "object",
    "required": ["student_id", "name"],
    "properties": {
        "student_id": {
            "bsonType": "string",
            "description": "Unique student identifier"
        },
        "name": {
            "bsonType": "string",
            "description": "Student full name"
        },
        "image": {
            "bsonType": "string",
            "description": "Face image filename"
        },
        "registered_at": {
            "bsonType": "date",
            "description": "Registration timestamp"
        },
        "updated_at": {
            "bsonType": "date",
            "description": "Last update timestamp"
        }
    }
}

# Attendance Records Schema
ATTENDANCE_SCHEMA = {
    "bsonType": "object",
    "required": ["student_id", "timestamp", "status"],
    "properties": {
        "student_id": {
            "bsonType": "string",
            "description": "Student identifier"
        },
        "name": {
            "bsonType": "string",
            "description": "Student name (denormalized)"
        },
        "timestamp": {
            "bsonType": "date",
            "description": "Attendance timestamp"
        },
        "status": {
            "bsonType": "string",
            "enum": ["present", "absent", "late"],
            "description": "Attendance status"
        },
        "course_id": {
            "bsonType": "int",
            "description": "Related course ID"
        }
    }
}

# Users Collection Schema
USER_SCHEMA = {
    "bsonType": "object",
    "required": ["username", "password", "role", "name", "email"],
    "properties": {
        "username": {
            "bsonType": "string",
            "description": "Unique username"
        },
        "password": {
            "bsonType": "string",
            "description": "Hashed password"
        },
        "role": {
            "bsonType": "string",
            "enum": ["admin", "instructor", "student"],
            "description": "User role"
        },
        "name": {
            "bsonType": "string",
            "description": "Full name"
        },
        "email": {
            "bsonType": "string",
            "pattern": "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
            "description": "Email address"
        },
        "department": {
            "bsonType": "string",
            "description": "Department (for instructors)"
        },
        "student_id": {
            "bsonType": "string",
            "description": "Student ID (for students)"
        },
        "created_at": {
            "bsonType": "date",
            "description": "Account creation timestamp"
        },
        "updated_at": {
            "bsonType": "date",
            "description": "Last update timestamp"
        }
    }
}

# Courses Collection Schema
COURSE_SCHEMA = {
    "bsonType": "object",
    "required": ["code", "name", "instructor"],
    "properties": {
        "id": {
            "bsonType": "int",
            "description": "Auto-incremented course ID"
        },
        "code": {
            "bsonType": "string",
            "description": "Course code (e.g., CS101)"
        },
        "name": {
            "bsonType": "string",
            "description": "Course name"
        },
        "instructor": {
            "bsonType": "string",
            "description": "Instructor name"
        },
        "schedule": {
            "bsonType": "string",
            "description": "Course schedule"
        },
        "room": {
            "bsonType": "string",
            "description": "Room number"
        },
        "students": {
            "bsonType": "int",
            "description": "Number of enrolled students"
        },
        "created_at": {
            "bsonType": "date",
            "description": "Course creation timestamp"
        }
    }
}

# Rooms Collection Schema
ROOM_SCHEMA = {
    "bsonType": "object",
    "required": ["name", "capacity", "type"],
    "properties": {
        "id": {
            "bsonType": "int",
            "description": "Auto-incremented room ID"
        },
        "name": {
            "bsonType": "string",
            "description": "Room name/number"
        },
        "capacity": {
            "bsonType": "int",
            "minimum": 1,
            "description": "Room capacity"
        },
        "type": {
            "bsonType": "string",
            "enum": ["classroom", "lab", "auditorium", "other"],
            "description": "Room type"
        },
        "equipment": {
            "bsonType": "string",
            "description": "Available equipment"
        },
        "status": {
            "bsonType": "string",
            "enum": ["available", "occupied", "maintenance"],
            "description": "Room status"
        },
        "created_at": {
            "bsonType": "date",
            "description": "Room creation timestamp"
        }
    }
}

# Collection schemas mapping
SCHEMAS = {
    'students': STUDENT_SCHEMA,
    'attendance_logs': ATTENDANCE_SCHEMA,
    'users': USER_SCHEMA,
    'courses': COURSE_SCHEMA,
    'rooms': ROOM_SCHEMA
}
