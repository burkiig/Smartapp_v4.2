"""
Flask uygulama yapılandırması
"""
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

class Config:
    """Temel yapılandırma"""
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-key-change-in-production'
    
    # Dizinler
    BASE_DIR = os.path.abspath(os.path.dirname(__file__))
    STATIC_DIR = os.path.join(BASE_DIR, 'static')
    FACES_DIR = os.path.join(STATIC_DIR, 'faces')
    ATTENDANCE_DIR = os.path.join(STATIC_DIR, 'attendance')
    
    # Dosyalar
    STUDENTS_DB = os.path.join(STATIC_DIR, 'students.json')
    ATTENDANCE_RECORDS = os.path.join(ATTENDANCE_DIR, 'records.json')
    
    # Database Mode
    USE_MONGODB = os.environ.get('USE_MONGODB', 'false').lower() == 'true'
    
    # MongoDB ayarları
    MONGODB_URI = os.environ.get('MONGODB_URI', 'mongodb://localhost:27017/')
    MONGODB_DATABASE = os.environ.get('MONGODB_DATABASE', 'smart_attendance')
    
    # JSON ayarları
    JSON_BASE_DIR = os.environ.get('JSON_BASE_DIR', 'static')
    
    # Yüz tanıma ayarları
    FACE_RECOGNITION_TOLERANCE = float(os.environ.get('FACE_RECOGNITION_TOLERANCE', '0.6'))
    FACE_DETECTION_MODEL = os.environ.get('FACE_DETECTION_MODEL', 'hog')  # 'hog' veya 'cnn'
    
    # Flask ayarları
    DEBUG = os.environ.get('DEBUG', 'true').lower() == 'true'
    HOST = os.environ.get('HOST', '0.0.0.0')
    PORT = int(os.environ.get('PORT', '5000'))
    
    # CORS ayarları
    CORS_ORIGINS = os.environ.get('CORS_ORIGINS', 'http://localhost:3000,http://127.0.0.1:3000').split(',')
    
    # Logging ayarları
    LOG_LEVEL = os.environ.get('LOG_LEVEL', 'INFO')
    LOG_FILE = os.environ.get('LOG_FILE', '')

class DevelopmentConfig(Config):
    """Geliştirme ortamı yapılandırması"""
    DEBUG = True
    TESTING = False

class ProductionConfig(Config):
    """Üretim ortamı yapılandırması"""
    DEBUG = False
    TESTING = False
    # Üretimde SECRET_KEY mutlaka değiştirilmeli!

# Yapılandırma sözlüğü
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}

