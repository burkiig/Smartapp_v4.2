"""
Migration script: JSON → MongoDB
Migrates existing JSON data to MongoDB and provides rollback capability
"""

import json
import os
import sys
from datetime import datetime
from database import get_database_adapter
from database.json_adapter import JSONAdapter
from database.mongodb_adapter import MongoDBAdapter
from shared.logger import setup_logger

logger = setup_logger('migration')


def migrate_json_to_mongodb():
    """Migrate all data from JSON files to MongoDB"""
    logger.info("Starting JSON → MongoDB migration...")
    
    try:
        # Create adapters
        json_adapter = JSONAdapter(base_dir='static')
        
        # Get MongoDB connection details from environment
        mongodb_uri = os.getenv('MONGODB_URI', 'mongodb://localhost:27017/')
        mongodb_database = os.getenv('MONGODB_DATABASE', 'smart_attendance')
        
        mongo_adapter = MongoDBAdapter(
            connection_uri=mongodb_uri,
            database_name=mongodb_database
        )
        
        logger.info("Adapters created successfully")
        
        # Migrate students
        logger.info("Migrating students...")
        students = json_adapter.get_students()
        for student in students:
            try:
                mongo_adapter.create_student(student)
                logger.info(f"Migrated student: {student.get('student_id')}")
            except Exception as e:
                logger.warning(f"Could not migrate student {student.get('student_id')}: {e}")
        
        # Migrate attendance records
        logger.info("Migrating attendance records...")
        records = json_adapter.get_attendance_records()
        for record in records:
            try:
                # Convert timestamp string to datetime if needed
                if isinstance(record.get('timestamp'), str):
                    record['timestamp'] = datetime.fromisoformat(record['timestamp'])
                
                mongo_adapter.create_attendance_record(record)
                logger.info(f"Migrated attendance record for: {record.get('student_id')}")
            except Exception as e:
                logger.warning(f"Could not migrate attendance record: {e}")
        
        # Migrate users
        logger.info("Migrating users...")
        users = json_adapter.get_users()
        for user in users:
            try:
                mongo_adapter.create_user(user)
                logger.info(f"Migrated user: {user.get('username')}")
            except Exception as e:
                logger.warning(f"Could not migrate user {user.get('username')}: {e}")
        
        # Migrate courses
        logger.info("Migrating courses...")
        courses = json_adapter.get_courses()
        for course in courses:
            try:
                mongo_adapter.create_course(course)
                logger.info(f"Migrated course: {course.get('code')}")
            except Exception as e:
                logger.warning(f"Could not migrate course: {e}")
        
        # Migrate rooms
        logger.info("Migrating rooms...")
        rooms = json_adapter.get_rooms()
        for room in rooms:
            try:
                mongo_adapter.create_room(room)
                logger.info(f"Migrated room: {room.get('name')}")
            except Exception as e:
                logger.warning(f"Could not migrate room: {e}")
        
        logger.info("✅ Migration completed successfully!")
        logger.info(f"Migrated: {len(students)} students, {len(records)} attendance records, "
                   f"{len(users)} users, {len(courses)} courses, {len(rooms)} rooms")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Migration failed: {e}", exc_info=True)
        return False


def backup_json_data():
    """Create a backup of JSON data before migration"""
    logger.info("Creating backup of JSON data...")
    
    backup_dir = f"backups/json_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    os.makedirs(backup_dir, exist_ok=True)
    
    files_to_backup = [
        'static/students.json',
        'static/attendance/records.json',
        'static/users.json',
        'static/courses.json',
        'static/rooms.json'
    ]
    
    for file_path in files_to_backup:
        if os.path.exists(file_path):
            backup_path = os.path.join(backup_dir, os.path.basename(file_path))
            
            with open(file_path, 'r', encoding='utf-8') as src:
                data = json.load(src)
            
            with open(backup_path, 'w', encoding='utf-8') as dst:
                json.dump(data, dst, ensure_ascii=False, indent=2)
            
            logger.info(f"Backed up: {file_path} → {backup_path}")
    
    logger.info(f"✅ Backup created at: {backup_dir}")
    return backup_dir


def verify_migration():
    """Verify that migration was successful by comparing counts"""
    logger.info("Verifying migration...")
    
    try:
        json_adapter = JSONAdapter(base_dir='static')
        
        mongodb_uri = os.getenv('MONGODB_URI', 'mongodb://localhost:27017/')
        mongodb_database = os.getenv('MONGODB_DATABASE', 'smart_attendance')
        mongo_adapter = MongoDBAdapter(mongodb_uri, mongodb_database)
        
        # Compare counts
        json_students = len(json_adapter.get_students())
        mongo_students = len(mongo_adapter.get_students())
        
        json_records = len(json_adapter.get_attendance_records())
        mongo_records = len(mongo_adapter.get_attendance_records())
        
        json_users = len(json_adapter.get_users())
        mongo_users = len(mongo_adapter.get_users())
        
        logger.info(f"Students: JSON={json_students}, MongoDB={mongo_students}")
        logger.info(f"Attendance: JSON={json_records}, MongoDB={mongo_records}")
        logger.info(f"Users: JSON={json_users}, MongoDB={mongo_users}")
        
        if (json_students == mongo_students and 
            json_records == mongo_records and 
            json_users == mongo_users):
            logger.info("✅ Verification successful! Counts match.")
            return True
        else:
            logger.warning("⚠️ Verification warning: Counts don't match exactly.")
            return False
            
    except Exception as e:
        logger.error(f"❌ Verification failed: {e}")
        return False


if __name__ == '__main__':
    print("=" * 60)
    print("Smart Attendance System - Data Migration")
    print("JSON → MongoDB")
    print("=" * 60)
    print()
    
    # Check if MongoDB is configured
    use_mongodb = os.getenv('USE_MONGODB', 'false').lower()
    if use_mongodb != 'true':
        print("⚠️  Warning: USE_MONGODB is not set to 'true' in .env file")
        print("   Migration will proceed, but you need to update .env to use MongoDB")
        print()
    
    # Ask for confirmation
    response = input("Do you want to proceed with migration? (yes/no): ")
    if response.lower() not in ['yes', 'y']:
        print("Migration cancelled.")
        sys.exit(0)
    
    print()
    
    # Create backup
    backup_dir = backup_json_data()
    print()
    
    # Run migration
    success = migrate_json_to_mongodb()
    print()
    
    if success:
        # Verify migration
        verify_migration()
        print()
        print("=" * 60)
        print("✅ Migration completed!")
        print(f"📁 Backup saved at: {backup_dir}")
        print()
        print("Next steps:")
        print("1. Update .env file: SET USE_MONGODB=true")
        print("2. Restart the application")
        print("=" * 60)
    else:
        print("=" * 60)
        print("❌ Migration failed!")
        print(f"📁 Your data is safe in: {backup_dir}")
        print("=" * 60)
        sys.exit(1)
