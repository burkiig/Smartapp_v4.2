from flask import Flask, send_from_directory, request, jsonify, Response, session
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, create_refresh_token, jwt_required, get_jwt_identity
import os
import math
from datetime import datetime, timedelta
import json
import base64
from werkzeug.security import generate_password_hash, check_password_hash
from dotenv import load_dotenv

# requests — Expo Push API için HTTP çağrısı
try:
    import requests as http_requests
    REQUESTS_AVAILABLE = True
except ImportError:
    REQUESTS_AVAILABLE = False
    print("WARNING: requests not installed. Push notifications will be disabled.")
    print("Install with: pip install requests")

# APScheduler — otomatik oturum yönetimi için
try:
    from apscheduler.schedulers.background import BackgroundScheduler  # type: ignore
    from apscheduler.triggers.cron import CronTrigger  # type: ignore
    SCHEDULER_AVAILABLE = True
except ImportError:
    SCHEDULER_AVAILABLE = False
    print("WARNING: APScheduler not installed. Run: pip install APScheduler==3.10.4")

# Optional imports for face recognition (can run without these for testing)
try:
    import cv2  # type: ignore
    import face_recognition  # type: ignore
    import numpy as np
    FACE_RECOGNITION_AVAILABLE = True
except ImportError:
    FACE_RECOGNITION_AVAILABLE = False
    print("WARNING: OpenCV and face_recognition not installed. Face recognition features will be disabled.")
    print("Install with: pip install opencv-python face-recognition numpy")

# Load environment variables from .env file
load_dotenv()

# Import data layer and error handling (optional for mock mode)
try:
    from database import get_database_adapter
    from shared.errors import APIError, ValidationError, NotFoundError, DuplicateError
    from shared.logger import setup_logger, get_logger
    from config import Config
    DATABASE_AVAILABLE = True
except ImportError:
    DATABASE_AVAILABLE = False
    print("WARNING: Database modules not available. Running in mock mode.")
    # Mock classes for when database is not available
    class APIError(Exception):
        def __init__(self, message, status_code=500):
            self.message = message
            self.status_code = status_code
        def to_dict(self):
            return {'error': self.message, 'status': self.status_code}
    
    class ValidationError(APIError):
        def __init__(self, message):
            super().__init__(message, 400)
    
    class NotFoundError(APIError):
        def __init__(self, message):
            super().__init__(message, 404)
    
    class DuplicateError(APIError):
        def __init__(self, message):
            super().__init__(message, 409)
    
    class MockLogger:
        def info(self, msg): print(f"[INFO] {msg}")
        def warning(self, msg): print(f"[WARNING] {msg}")
        def error(self, msg, **kwargs): print(f"[ERROR] {msg}")
    
    def setup_logger(*args, **kwargs):
        return MockLogger()
    
    def get_logger(*args, **kwargs):
        return MockLogger()
    
    class Config:
        DEBUG = True
        HOST = '0.0.0.0'
        PORT = 5000
        LOG_LEVEL = 'INFO'
        LOG_FILE = None

app = Flask(__name__, static_folder=None)
app.secret_key = os.environ.get('SECRET_KEY') or os.environ.get('JWT_SECRET_KEY') or 'dev-secret-key-change-in-production'
app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY') or app.secret_key
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=1)
app.config['JWT_REFRESH_TOKEN_EXPIRES'] = timedelta(days=30)

CORS(app, supports_credentials=True, origins=os.environ.get('CORS_ORIGINS', 'http://localhost:3000').split(','))

# Initialize JWT Manager
jwt = JWTManager(app)

# Setup logger
log_file = Config.LOG_FILE if hasattr(Config, 'LOG_FILE') and Config.LOG_FILE else None
logger = setup_logger('smart_attendance', log_file=log_file, level=getattr(Config, 'LOG_LEVEL', 'INFO'))

# Initialize database adapter (if available)
if DATABASE_AVAILABLE:
    db = get_database_adapter()
    logger.info(f"Database adapter initialized: {db.__class__.__name__}")
else:
    db = None
    logger.info("Running in MOCK MODE - no database connection")

# Dizinleri oluştur
os.makedirs('static/faces', exist_ok=True)
os.makedirs('static/attendance', exist_ok=True)

# Initialize default users if database is empty
def init_default_users():
    """Ensure all default/demo users exist in DB with correct passwords."""
    try:
        default_users = [
            {
                'username': 'admin',
                'password': generate_password_hash('admin123'),
                'role': 'admin',
                'name': 'System Administrator',
                'email': 'admin@attendance.com'
            },
            {
                'username': 'instructor1',
                'password': generate_password_hash('pass123'),
                'role': 'instructor',
                'name': 'Dr. Robert Chen',
                'department': 'Computer Science',
                'email': 'robert.chen@university.edu'
            },
            {
                'username': 'student1',
                'password': generate_password_hash('pass123'),
                'role': 'student',
                'name': 'John Doe',
                'student_id': '2021001',
                'email': 'john.doe@student.edu'
            },
            {
                'username': 'instructor_demo',
                'password': generate_password_hash('demo123'),
                'role': 'instructor',
                'name': 'Dr. Demo Instructor',
                'department': 'Computer Science',
                'email': 'instructor@demo.com'
            },
            {
                'username': 'student_demo',
                'password': generate_password_hash('demo123'),
                'role': 'student',
                'name': 'Demo Student',
                'student_id': 'DEMO001',
                'email': 'student@demo.com'
            }
        ]

        for user_data in default_users:
            try:
                existing = db.get_user(user_data['username'])
                if not existing:
                    db.create_user(user_data)
                    logger.info(f"Created default user: {user_data['username']}")
                else:
                    logger.debug(f"User already exists: {user_data['username']}")
            except Exception as e:
                logger.warning(f"Could not upsert user {user_data['username']}: {e}")
    except Exception as e:
        logger.error(f"Error initializing default users: {e}")

def require_role(*allowed_roles):
    """
    Decorator that checks JWT identity and enforces role-based access.
    Must be placed AFTER @jwt_required().

    Usage:
        @jwt_required()
        @require_role('admin')
        def admin_only(): ...

        @jwt_required()
        @require_role('admin', 'instructor')
        def admin_or_instructor(): ...
    """
    from functools import wraps

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            current_username = get_jwt_identity()
            user = get_user_from_db(current_username)
            if not user:
                return jsonify({'success': False, 'message': 'Kullanıcı bulunamadı'}), 401
            if user.get('role') not in allowed_roles:
                return jsonify({
                    'success': False,
                    'message': f"Bu işlem için yetkiniz yok. Gerekli rol: {', '.join(allowed_roles)}"
                }), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator


# ==================== PUSH NOTIFICATION YARDIMCI FONKSİYONLAR ====================

EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'


def _send_expo_push(tokens: list, title: str, body: str, data: dict = None) -> dict:
    """
    Expo Push Notification API'ye istek gönderir.
    Birden fazla token'a tek seferinde bildirim yollar (batch).

    Args:
        tokens : ['ExponentPushToken[xxx]', ...]
        title  : Bildirim başlığı
        body   : Bildirim içeriği
        data   : Ek veri (dict)

    Returns:
        Expo API cevabı veya hata dict'i
    """
    if not REQUESTS_AVAILABLE:
        logger.warning("[Push] requests kütüphanesi yüklü değil, bildirim gönderilemedi")
        return {'error': 'requests not installed'}

    if not tokens:
        return {'sent': 0}

    messages = [
        {
            'to': token,
            'sound': 'default',
            'title': title,
            'body': body,
            'data': data or {}
        }
        for token in tokens
    ]

    try:
        response = http_requests.post(
            EXPO_PUSH_URL,
            json=messages,
            headers={
                'Accept': 'application/json',
                'Accept-encoding': 'gzip, deflate',
                'Content-Type': 'application/json',
            },
            timeout=10
        )
        result = response.json()
        logger.info(f"[Push] {len(tokens)} bildirim gönderildi. Expo yanıtı: {response.status_code}")
        return result
    except Exception as e:
        logger.error(f"[Push] Expo API hatası: {e}")
        return {'error': str(e)}


def notify_instructor_flagged_attendance(session_id: str, student_name: str, flag_reason: str, course_code: str):
    """
    Şüpheli yoklama tespit edildiğinde ilgili dersin hocanın telefonuna push bildirim gönderir.

    Args:
        session_id   : Aktif oturum UUID'si
        student_name : Şüpheli öğrencinin adı
        flag_reason  : Şüphe sebebi (kod adı, örn. 'duplicate_attendance')
        course_code  : Ders kodu (görüntüleme için)
    """
    if not (DATABASE_AVAILABLE and db):
        return

    REASON_LABELS = {
        'duplicate_attendance':   'Aynı oturumda çift yoklama denemesi',
        'location_bypassed':      'GPS doğrulaması atlandı (geliştirme modu)',
        'face_simulated':         'Yüz tanıma simüle edildi (gerçek kontrol yapılmadı)',
        'location_and_face_bypass': 'GPS ve yüz tanıma ikisi de atlandı',
    }
    reason_label = REASON_LABELS.get(flag_reason, flag_reason)

    try:
        session = db.get_session(session_id)
        if not session:
            return

        course_id = session.get('course_id')
        course = db.get_course(course_id) if course_id else None
        if not course:
            return

        instructor_username = course.get('instructor')
        if not instructor_username:
            return

        instructor = db.get_user(instructor_username)
        if not instructor or not instructor.get('push_token'):
            logger.info(f"[Push] Hoca '{instructor_username}' için push token bulunamadı")
            return

        _send_expo_push(
            tokens=[instructor['push_token']],
            title='⚠️ Şüpheli Yoklama Tespit Edildi',
            body=f'{course_code} — {student_name}: {reason_label}',
            data={
                'type': 'flagged_attendance',
                'session_id': session_id,
                'course_id': course_id,
                'course_code': course_code,
                'flag_reason': flag_reason
            }
        )
        logger.info(f"[Push] Şüpheli yoklama bildirimi gönderildi: {instructor_username} → {student_name} ({flag_reason})")
    except Exception as e:
        logger.error(f"[Push] notify_instructor_flagged_attendance hatası: {e}")


def notify_class_cancelled(course_id: int, course_code: str, reason: str):
    """
    Ders iptal bildirimini tüm kayıtlı öğrencilere gönderir.
    cancel_class endpoint'i tarafından çağrılır.
    """
    if not (DATABASE_AVAILABLE and db):
        return

    try:
        course = db.get_course(course_id)
        if not course:
            return

        enrolled_student_ids = course.get('enrolled_students', [])
        if not enrolled_student_ids:
            logger.info(f"[Push] {course_code} için kayıtlı öğrenci yok, bildirim gönderilmedi")
            return

        # Kayıtlı öğrencilerin push token'larını topla
        push_tokens = []
        for sid in enrolled_student_ids:
            student = db.get_student(sid)
            if student and student.get('push_token'):
                push_tokens.append(student['push_token'])

        if not push_tokens:
            logger.info(f"[Push] {course_code}: push token kayıtlı öğrenci yok")
            return

        _send_expo_push(
            tokens=push_tokens,
            title='Ders İptal Edildi 📢',
            body=f'{course_code} dersi iptal edildi. Sebep: {reason}',
            data={'type': 'class_cancelled', 'course_id': course_id, 'course_code': course_code}
        )
        logger.info(f"[Push] {course_code} iptali için {len(push_tokens)} bildirim gönderildi")
    except Exception as e:
        logger.error(f"[Push] notify_class_cancelled hatası: {e}")


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great-circle distance (metres) between two GPS coordinates
    using the Haversine formula.
    """
    R = 6_371_000  # Earth radius in metres
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def load_known_faces():
    """Kayıtlı yüzleri yükle"""
    known_faces = []
    known_names = []
    
    faces_dir = 'static/faces'
    if os.path.exists(faces_dir):
        for filename in os.listdir(faces_dir):
            if filename.endswith(('.jpg', '.jpeg', '.png')):
                image_path = os.path.join(faces_dir, filename)
                image = face_recognition.load_image_file(image_path)
                encodings = face_recognition.face_encodings(image)
                if encodings:
                    known_faces.append(encodings[0])
                    name = os.path.splitext(filename)[0]
                    known_names.append(name)
    
    return known_faces, known_names

# ==================== REACT WEB PANEL SERVE ====================

REACT_BUILD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'web-panel', 'build')

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_react(path):
    """React build'i serve eder. /api/ rotaları öncelikli eşleştiğinden buraya düşmez."""
    if not os.path.exists(REACT_BUILD_DIR):
        return jsonify({
            'message': 'Web panel bulunamadi. Lutfen web-panel klasorunde "npm run build" komutunu calistirin.',
            'build_dir': REACT_BUILD_DIR
        }), 404

    # /static/ isteklerini build klasöründen açıkça sun (Flask'ın built-in static handler'ı devre dışı)
    if path.startswith('static/'):
        file_path = os.path.join(REACT_BUILD_DIR, path)
        if os.path.exists(file_path):
            return send_from_directory(REACT_BUILD_DIR, path)
        return jsonify({'error': 'Dosya bulunamadı', 'path': path}), 404

    # Diğer mevcut dosyalar (favicon.ico, manifest.json vb.)
    file_path = os.path.join(REACT_BUILD_DIR, path)
    if path and os.path.exists(file_path):
        return send_from_directory(REACT_BUILD_DIR, path)

    # SPA fallback — tüm bilinmeyen route'lar için index.html
    return send_from_directory(REACT_BUILD_DIR, 'index.html')

# ==================== HEALTH CHECK ====================

@app.route('/health', methods=['GET'])
def health_check():
    """System health check endpoint"""
    try:
        db_health = db.health_check()
        
        return jsonify({
            'status': 'healthy',
            'database': db_health,
            'version': '2.0.0',
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return jsonify({
            'status': 'unhealthy',
            'error': str(e),
            'timestamp': datetime.now().isoformat()
        }), 500

@app.route('/api/health', methods=['GET'])
def api_health_check():
    """API health check endpoint"""
    return jsonify({
        'status': 'ok',
        'message': 'API is running',
        'version': '2.0.0',
        'timestamp': datetime.now().isoformat(),
        'scheduler': 'active' if (SCHEDULER_AVAILABLE and scheduler and scheduler.running) else 'inactive'
    })


@app.route('/api/scheduler/status', methods=['GET'])
@jwt_required()
@require_role('admin')
def scheduler_status():
    """Scheduler durumunu ve planlanmış görevleri göster (sadece admin)"""
    if not SCHEDULER_AVAILABLE or not scheduler:
        return jsonify({'success': True, 'scheduler': {'running': False, 'jobs': []}})

    jobs = []
    for job in scheduler.get_jobs():
        jobs.append({
            'id': job.id,
            'name': job.name,
            'next_run': job.next_run_time.isoformat() if job.next_run_time else None
        })

    return jsonify({
        'success': True,
        'scheduler': {
            'running': scheduler.running,
            'jobs': jobs
        }
    })

# ==================== PUSH TOKEN ====================

@app.route('/api/users/push-token', methods=['POST'])
@jwt_required()
def save_push_token():
    """
    Mobil uygulamadan gelen Expo push token'ı kaydeder.
    Kullanıcı tipi student ise students tablosuna, tüm kullanıcılar için users tablosuna yazar.

    Body: { push_token: "ExponentPushToken[xxx]" }
    """
    try:
        data = request.json
        push_token = data.get('push_token')
        current_username = get_jwt_identity()

        if not push_token:
            return jsonify({'success': False, 'message': 'push_token gerekli'}), 400

        if not (DATABASE_AVAILABLE and db):
            return jsonify({'success': True, 'message': 'Dev mode — token kaydedilmedi'})

        # Users tablosuna kaydet
        user = db.get_user(current_username)
        if user:
            db.update_user(current_username, {'push_token': push_token})

        # Student ise students tablosuna da kaydet
        if user and user.get('role') == 'student':
            student_id = user.get('student_id')
            if student_id:
                student = db.get_student(student_id)
                if student:
                    db.update_student(student_id, {'push_token': push_token})

        logger.info(f"Push token saved for user: {current_username}")
        return jsonify({'success': True, 'message': 'Push token kaydedildi'})

    except Exception as e:
        logger.error(f"Save push token error: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500


# ==================== ERROR HANDLERS ====================

@app.errorhandler(APIError)
def handle_api_error(error):
    """Handle custom API errors"""
    logger.warning(f"API Error: {error.message}")
    return jsonify(error.to_dict()), error.status_code

@app.errorhandler(Exception)
def handle_generic_error(error):
    """Handle unexpected errors"""
    logger.error(f"Unexpected error: {error}", exc_info=True)
    return jsonify({
        'error': 'Internal server error',
        'status': 500
    }), 500

# ==================== MOCK USER DATA (Temporary - Replace with DB later) ====================

# MOCK USERS - Geçici hardcoded kullanıcılar
# TODO: DB hazır olunca get_user_from_db() fonksiyonunu gerçek DB sorgusu ile değiştir
MOCK_USERS = {
    'admin': {
        'username': 'admin',
        'password': generate_password_hash('admin123'),
        'role': 'admin',
        'name': 'System Administrator',
        'email': 'admin@attendance.com'
    },
    'instructor1': {
        'username': 'instructor1',
        'password': generate_password_hash('pass123'),
        'role': 'instructor',
        'name': 'Dr. Robert Chen',
        'department': 'Computer Science',
        'email': 'robert.chen@university.edu'
    },
    'student1': {
        'username': 'student1',
        'password': generate_password_hash('pass123'),
        'role': 'student',
        'name': 'John Doe',
        'student_id': '2021001',
        'email': 'john.doe@student.edu'
    },
    'instructor_demo': {
        'username': 'instructor_demo',
        'password': generate_password_hash('demo123'),
        'role': 'instructor',
        'name': 'Dr. Demo Instructor',
        'department': 'Computer Science',
        'email': 'instructor@demo.com'
    },
    'student_demo': {
        'username': 'student_demo',
        'password': generate_password_hash('demo123'),
        'role': 'student',
        'name': 'Demo Student',
        'student_id': 'DEMO001',
        'email': 'student@demo.com'
    }
}

def get_user_from_db(username):
    """
    Get user from database. Falls back to MOCK_USERS if DB is unavailable.
    
    Args:
        username (str): Username to lookup
        
    Returns:
        dict: User data or None if not found
    """
    if DATABASE_AVAILABLE and db:
        return db.get_user(username)
    return MOCK_USERS.get(username)

# ==================== AUTHENTICATION ====================

@app.route('/api/login', methods=['POST'])
def login():
    """Kullanıcı girişi - JWT token ile"""
    try:
        data = request.json
        username = data.get('username')
        password = data.get('password')
        
        if not username or not password:
            raise ValidationError('Kullanıcı adı ve şifre gerekli')
        
        # Get user from database (currently mock data)
        user = get_user_from_db(username)
        
        if user and check_password_hash(user['password'], password):
            # Create JWT tokens
            access_token = create_access_token(identity=username)
            refresh_token = create_refresh_token(identity=username)
            
            # Şifreyi response'dan çıkar
            user_data = {k: v for k, v in user.items() if k != 'password'}
            
            logger.info(f"User logged in: {username}")
            return jsonify({
                'success': True,
                'message': 'Giriş başarılı',
                'user': user_data,
                'access_token': access_token,
                'refresh_token': refresh_token
            })
        
        logger.warning(f"Failed login attempt: {username}")
        return jsonify({'success': False, 'message': 'Kullanıcı adı veya şifre hatalı'}), 401
        
    except APIError:
        raise
    except Exception as e:
        logger.error(f"Login error: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/logout', methods=['POST'])
@jwt_required()
def logout():
    """Kullanıcı çıkışı"""
    current_user = get_jwt_identity()
    logger.info(f"User logged out: {current_user}")
    return jsonify({'success': True, 'message': 'Çıkış başarılı'})

@app.route('/api/auth/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    """Refresh access token"""
    try:
        identity = get_jwt_identity()
        access_token = create_access_token(identity=identity)
        
        logger.info(f"Token refreshed for user: {identity}")
        return jsonify({
            'success': True,
            'access_token': access_token
        })
    except Exception as e:
        logger.error(f"Token refresh error: {e}")
        return jsonify({'success': False, 'message': str(e)}), 401

@app.route('/api/users', methods=['GET'])
@jwt_required()
@require_role('admin')
def get_users():
    """Tüm kullanıcıları getir (sadece admin)"""
    try:
        if DATABASE_AVAILABLE and db:
            users = db.get_users()
            users_list = [{k: v for k, v in user.items() if k != 'password'} for user in users]
            return jsonify({'success': True, 'users': users_list})
        else:
            # Mock users
            mock_users = [
                {k: v for k, v in user.items() if k != 'password'} 
                for user in MOCK_USERS.values()
            ]
            return jsonify({'success': True, 'users': mock_users})
    except Exception as e:
        logger.error(f"Get users error: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/users', methods=['POST'])
@jwt_required()
@require_role('admin')
def add_user():
    """Yeni kullanıcı ekle (sadece admin)"""
    try:
        data = request.json
        username = data.get('username')
        name = data.get('name')
        email = data.get('email')
        role = data.get('role')
        password = data.get('password')

        if not all([username, name, email, role, password]):
            return jsonify({'success': False, 'message': 'Tüm alanlar gerekli'}), 400

        if not (DATABASE_AVAILABLE and db):
            return jsonify({'success': False, 'message': 'Database not available'}), 503

        existing = db.get_user(username)
        if existing:
            return jsonify({'success': False, 'message': 'Kullanıcı adı zaten kullanılıyor'}), 409

        user_data = {
            'username': username,
            'password': generate_password_hash(password),
            'role': role,
            'name': name,
            'email': email
        }

        if role == 'instructor':
            user_data['department'] = data.get('department', 'Not specified')
        elif role == 'student':
            user_data['student_id'] = data.get('student_id', 'TBD')

        created = db.create_user(user_data)
        user_response = {k: v for k, v in created.items() if k != 'password'}

        logger.info(f"New user created: {username} (role: {role})")
        return jsonify({'success': True, 'message': 'Kullanıcı eklendi', 'user': user_response})

    except Exception as e:
        logger.error(f"Add user error: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/users/<username>', methods=['DELETE'])
@jwt_required()
@require_role('admin')
def delete_user(username):
    """Kullanıcı sil (sadece admin)"""
    try:
        if not (DATABASE_AVAILABLE and db):
            return jsonify({'success': False, 'message': 'Database not available'}), 503

        result = db.delete_user(username)
        if result:
            logger.info(f"User deleted: {username}")
            return jsonify({'success': True, 'message': 'Kullanıcı silindi'})

        return jsonify({'success': False, 'message': 'Kullanıcı bulunamadı'}), 404

    except Exception as e:
        logger.error(f"Delete user error: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/courses', methods=['GET'])
def get_courses():
    """Tüm dersleri getir"""
    courses = load_courses()
    return jsonify({'success': True, 'courses': courses})

@app.route('/api/courses', methods=['POST'])
@jwt_required()
@require_role('admin', 'instructor')
def add_course():
    """Yeni ders ekle (sadece admin)"""
    try:
        data = request.json
        courses = load_courses()
        
        course = {
            'id': len(courses) + 1,
            'code': data.get('code'),
            'name': data.get('name'),
            'instructor': data.get('instructor'),
            'schedule': data.get('schedule'),
            'room': data.get('room'),
            'students': 0
        }
        
        courses.append(course)
        save_courses(courses)
        
        return jsonify({'success': True, 'message': 'Ders eklendi', 'course': course})
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/courses/<int:course_id>', methods=['DELETE'])
@jwt_required()
@require_role('admin')
def delete_course(course_id):
    """Ders sil (sadece admin)"""
    courses = load_courses()
    courses = [c for c in courses if c['id'] != course_id]
    save_courses(courses)
    return jsonify({'success': True, 'message': 'Ders silindi'})

@app.route('/api/rooms', methods=['GET'])
def get_rooms():
    """Tüm sınıfları getir"""
    rooms = load_rooms()
    return jsonify({'success': True, 'rooms': rooms})

@app.route('/api/rooms', methods=['POST'])
@jwt_required()
@require_role('admin')
def add_room():
    """Yeni sınıf ekle (sadece admin)"""
    try:
        data = request.json
        rooms = load_rooms()
        
        room = {
            'id': len(rooms) + 1,
            'name': data.get('name'),
            'capacity': data.get('capacity'),
            'type': data.get('type'),
            'equipment': data.get('equipment'),
            'status': 'available'
        }
        
        rooms.append(room)
        save_rooms(rooms)
        
        return jsonify({'success': True, 'message': 'Sınıf eklendi', 'room': room})
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/rooms/<int:room_id>', methods=['DELETE'])
@jwt_required()
@require_role('admin')
def delete_room(room_id):
    """Sınıf sil (sadece admin)"""
    rooms = load_rooms()
    rooms = [r for r in rooms if r['id'] != room_id]
    save_rooms(rooms)
    return jsonify({'success': True, 'message': 'Sınıf silindi'})

@app.route('/api/register', methods=['POST'])
@jwt_required()
@require_role('admin', 'instructor')
def register_student():
    """Yeni öğrenci kaydet"""
    try:
        data = request.json
        student_id = data.get('student_id')
        name = data.get('name')
        image_data = data.get('image')

        if not all([student_id, name]):
            return jsonify({'success': False, 'message': 'student_id ve name gerekli'}), 400

        if not (DATABASE_AVAILABLE and db):
            return jsonify({'success': False, 'message': 'Database not available'}), 503

        student_record = {
            'name': name,
            'student_id': student_id,
            'registered_at': datetime.now().isoformat()
        }

        # Yüz işleme (opsiyonel — kütüphane yüklüyse)
        if image_data and FACE_RECOGNITION_AVAILABLE:
            try:
                img_bytes = image_data.split(',')[1] if ',' in image_data else image_data
                image_bytes = base64.b64decode(img_bytes)
                nparr = np.frombuffer(image_bytes, np.uint8)
                image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
                face_locations = face_recognition.face_locations(rgb_image)

                if not face_locations:
                    return jsonify({'success': False, 'message': 'Görüntüde yüz bulunamadı'}), 400

                filename = f"{student_id}.jpg"
                filepath = os.path.join('static/faces', filename)
                cv2.imwrite(filepath, image)
                student_record['image'] = filename
            except Exception as face_error:
                logger.warning(f"Face processing failed for {student_id}: {face_error}")

        created = db.create_student(student_record)
        logger.info(f"Student registered: {student_id} ({name})")
        return jsonify({
            'success': True,
            'message': 'Öğrenci başarıyla kaydedildi',
            'student': created
        })

    except Exception as e:
        logger.error(f"Register student error: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/attendance', methods=['POST'])
@jwt_required()
@require_role('student')
def mark_attendance():
    """Yoklama işaretle"""
    try:
        data = request.json
        image_data = data.get('image')

        if not image_data:
            return jsonify({'success': False, 'message': 'Görüntü bulunamadı'}), 400

        if not FACE_RECOGNITION_AVAILABLE:
            return jsonify({'success': False, 'message': 'Yüz tanıma modülü yüklü değil'}), 503

        if not (DATABASE_AVAILABLE and db):
            return jsonify({'success': False, 'message': 'Database not available'}), 503

        # Base64 görüntüyü decode et
        img_b64 = image_data.split(',')[1] if ',' in image_data else image_data
        image_bytes = base64.b64decode(img_b64)
        nparr = np.frombuffer(image_bytes, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

        face_locations = face_recognition.face_locations(rgb_image)
        face_encodings = face_recognition.face_encodings(rgb_image, face_locations)

        if not face_encodings:
            return jsonify({'success': False, 'message': 'Yüz bulunamadı'}), 400

        known_faces, known_names = load_known_faces()
        if not known_faces:
            return jsonify({'success': False, 'message': 'Kayıtlı öğrenci bulunamadı'}), 400

        tolerance = float(os.environ.get('FACE_RECOGNITION_TOLERANCE', '0.6'))
        for face_encoding in face_encodings:
            matches = face_recognition.compare_faces(known_faces, face_encoding, tolerance=tolerance)
            face_distances = face_recognition.face_distance(known_faces, face_encoding)

            if True in matches:
                best_match_index = np.argmin(face_distances)
                if matches[best_match_index]:
                    student_id = known_names[best_match_index]

                    student = db.get_student(student_id)
                    student_name = student.get('name', 'Unknown') if student else 'Unknown'

                    attendance_record = {
                        'student_id': student_id,
                        'name': student_name,
                        'timestamp': datetime.now().isoformat(),
                        'status': 'present'
                    }

                    created = db.create_attendance_record(attendance_record)
                    logger.info(f"Attendance marked: {student_id} ({student_name})")
                    return jsonify({
                        'success': True,
                        'message': 'Yoklama başarıyla işaretlendi',
                        'student': created
                    })

        return jsonify({'success': False, 'message': 'Öğrenci tanınamadı'}), 404

    except Exception as e:
        logger.error(f"Mark attendance error: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/students', methods=['GET'])
def get_students():
    """Tüm öğrencileri getir"""
    try:
        if DATABASE_AVAILABLE and db:
            students = db.get_students()
            return jsonify({'success': True, 'students': students})
        else:
            # Mock data
            return jsonify({'success': True, 'students': []})
    except Exception as e:
        logger.error(f"Get students error: {e}")
        return jsonify({'success': False, 'message': str(e), 'students': []}), 500

@app.route('/api/attendance/records', methods=['GET'])
@jwt_required()
@require_role('admin', 'instructor')
def get_attendance_records():
    """Yoklama kayıtlarını getir"""
    try:
        date = request.args.get('date')
        
        if DATABASE_AVAILABLE and db:
            # DB'den al
            records = db.get_attendance_records()
            if date and records:
                records = [r for r in records if r.get('timestamp', '').startswith(date)]
            return jsonify({'success': True, 'records': records or []})
        else:
            # Mock data
            return jsonify({'success': True, 'records': []})
    except Exception as e:
        logger.error(f"Get attendance records error: {e}")
        return jsonify({'success': False, 'message': str(e), 'records': []}), 500

@app.route('/api/dashboard/stats', methods=['GET'])
def get_dashboard_stats():
    """Dashboard istatistiklerini getir"""
    try:
        # Toplam öğrenci sayısı
        if DATABASE_AVAILABLE and db:
            students = db.get_students()
            total_students = len(students) if students else 0
        else:
            total_students = 0
        
        # Toplam ders sayısı (benzersiz tarihler)
        if DATABASE_AVAILABLE and db:
            records = db.get_attendance_records() or []
        else:
            records = []
            
        unique_dates = set()
        for record in records:
            date = record.get('timestamp', '').split('T')[0]
            if date:
                unique_dates.add(date)
        total_classes = len(unique_dates)
        
        # Ortalama yoklama oranı
        if total_classes > 0 and total_students > 0:
            avg_attendance = round((len(records) / (total_classes * total_students)) * 100)
        else:
            avg_attendance = 0
        
        # Bugünkü yoklama
        today = datetime.now().strftime('%Y-%m-%d')
        today_records = [r for r in records if r.get('timestamp', '').startswith(today)]
        present_today = len(today_records)
        
        # Son ayın istatistikleri
        from datetime import timedelta
        last_month = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
        last_month_records = [r for r in records if r.get('timestamp', '') >= last_month]
        
        stats = {
            'total_students': total_students,
            'total_classes': total_classes,
            'avg_attendance': avg_attendance,
            'auto_attendance': 95,  # Mock data
            'manual_reviews': 30,   # Mock data
            'present_today': present_today,
            'absent_today': total_students - present_today,
            'last_month_records': len(last_month_records)
        }
        
        return jsonify({'success': True, 'stats': stats})
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/dashboard/course-performance', methods=['GET'])
def get_course_performance():
    """Ders performans verilerini getir"""
    try:
        # Mock data - gerçek uygulamada veritabanından gelecek
        performance = [
            {'course': 'CS101', 'attendance': 95, 'students': 45},
            {'course': 'CS102', 'attendance': 88, 'students': 38},
            {'course': 'CS103', 'attendance': 92, 'students': 42},
            {'course': 'CS104', 'attendance': 90, 'students': 40}
        ]
        
        return jsonify({'success': True, 'performance': performance})
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/dashboard/recent-activity', methods=['GET'])
def get_recent_activity():
    """Son aktiviteleri getir"""
    try:
        # Son 10 yoklama kaydını al
        if DATABASE_AVAILABLE and db:
            all_records = db.get_attendance_records() or []
        else:
            all_records = []
            
        recent_records = sorted(
            all_records, 
            key=lambda x: x.get('timestamp', ''), 
            reverse=True
        )[:10]
        
        activities = []
        for record in recent_records:
            activities.append({
                'type': 'attendance',
                'title': f"{record['name']} - Yoklama",
                'timestamp': record['timestamp'],
                'details': f"Öğrenci No: {record['student_id']}"
            })
        
        return jsonify({'success': True, 'activities': activities})
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/students/<student_id>', methods=['DELETE'])
@jwt_required()
@require_role('admin')
def delete_student(student_id):
    """Öğrenci sil"""
    try:
        if DATABASE_AVAILABLE and db:
            # Görüntü dosyasını sil
            student = db.get_student(student_id)
            if student and student.get('image'):
                filepath = os.path.join('static/faces', student['image'])
                if os.path.exists(filepath):
                    os.remove(filepath)
            
            db.delete_student(student_id)
            return jsonify({'success': True, 'message': 'Öğrenci silindi'})
        else:
            return jsonify({'success': False, 'message': 'Database not available'}), 503
    except Exception as e:
        logger.error(f"Delete student error: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500

# ==================== CLASS MANAGEMENT ====================

@app.route('/api/classes/upcoming', methods=['GET'])
def get_upcoming_classes():
    """Gelecek tarihli dersleri getir"""
    try:
        instructor_id = request.args.get('instructor_id')
        
        # Mock data - gerçekte veritabanından gelecek
        from datetime import timedelta
        today = datetime.now()
        
        upcoming_classes = [
            {
                'id': 1,
                'course': 'CS101',
                'title': 'Introduction to Programming',
                'date': (today + timedelta(days=1)).strftime('%Y-%m-%d'),
                'time': '09:00 - 10:30',
                'room': 'Room 401',
                'status': 'scheduled',
                'students_enrolled': 45
            },
            {
                'id': 2,
                'course': 'CS201',
                'title': 'Data Structures',
                'date': (today + timedelta(days=1)).strftime('%Y-%m-%d'),
                'time': '14:00 - 15:30',
                'room': 'Lab 204',
                'status': 'scheduled',
                'students_enrolled': 38
            },
            {
                'id': 3,
                'course': 'CS301',
                'title': 'Algorithms',
                'date': (today + timedelta(days=2)).strftime('%Y-%m-%d'),
                'time': '16:00 - 17:30',
                'room': 'Room 405',
                'status': 'scheduled',
                'students_enrolled': 32
            },
            {
                'id': 4,
                'course': 'CS102',
                'title': 'Advanced Programming',
                'date': (today + timedelta(days=3)).strftime('%Y-%m-%d'),
                'time': '10:00 - 11:30',
                'room': 'Lab 301',
                'status': 'scheduled',
                'students_enrolled': 40
            },
        ]
        
        logger.info(f"Fetched {len(upcoming_classes)} upcoming classes for instructor: {instructor_id}")
        return jsonify({
            'success': True,
            'classes': upcoming_classes
        })
        
    except Exception as e:
        logger.error(f"Get upcoming classes error: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/classes/cancel', methods=['POST'])
@jwt_required()
@require_role('instructor', 'admin')
def cancel_class():
    """Dersi iptal et ve DB'ye kaydet"""
    try:
        data = request.json
        class_id = data.get('class_id')
        reason = data.get('reason')
        instructor_id = data.get('instructor_id')
        date = data.get('date', datetime.now().strftime('%Y-%m-%d'))

        if not all([class_id, reason, instructor_id]):
            raise ValidationError('class_id, reason ve instructor_id gerekli')

        cancellation_data = {
            'course_id': class_id,
            'instructor_id': instructor_id,
            'date': date,
            'reason': reason
        }

        course_code = str(class_id)
        if DATABASE_AVAILABLE and db:
            created = db.create_cancellation(cancellation_data)
            # İlgili aktif session varsa kapat
            sessions = db.get_sessions(course_id=class_id, status='active')
            for session in sessions:
                db.update_session(session['id'], {'status': 'cancelled'})
            # Kurs kodunu al
            course = db.get_course(class_id)
            if course:
                course_code = course.get('code', str(class_id))
        else:
            created = {**cancellation_data, 'notified_at': datetime.now().isoformat()}

        # Kayıtlı öğrencilere push bildirim gönder (hata olursa işlemi durdurmaz)
        try:
            notify_class_cancelled(class_id, course_code, reason)
        except Exception as notify_err:
            logger.warning(f"Push notification gönderilemedi: {notify_err}")

        logger.info(f"Class {class_id} cancelled by {instructor_id}. Reason: {reason}")
        return jsonify({
            'success': True,
            'message': 'Ders başarıyla iptal edildi',
            'cancellation': created
        })

    except APIError:
        raise
    except Exception as e:
        logger.error(f"Class cancellation error: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500


# ==================== ATTENDANCE SESSIONS ====================

@app.route('/api/sessions', methods=['GET'])
@jwt_required()
def get_sessions():
    """Yoklama oturumlarını listele"""
    try:
        course_id = request.args.get('course_id', type=int)
        status = request.args.get('status')

        if not (DATABASE_AVAILABLE and db):
            return jsonify({'success': True, 'sessions': []})

        sessions = db.get_sessions(course_id=course_id, status=status)
        return jsonify({'success': True, 'sessions': sessions})
    except Exception as e:
        logger.error(f"Get sessions error: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/sessions/active', methods=['GET'])
@jwt_required()
def get_active_sessions():
    """Aktif yoklama oturumlarını getir"""
    try:
        if not (DATABASE_AVAILABLE and db):
            return jsonify({'success': True, 'sessions': []})

        sessions = db.get_sessions(status='active')
        return jsonify({'success': True, 'sessions': sessions})
    except Exception as e:
        logger.error(f"Get active sessions error: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/sessions', methods=['POST'])
@jwt_required()
@require_role('admin', 'instructor')
def create_session():
    """Yeni yoklama oturumu başlat (instructor/admin)"""
    try:
        data = request.json
        course_id = data.get('course_id')
        date = data.get('date', datetime.now().strftime('%Y-%m-%d'))
        start_time = data.get('start_time', datetime.now().strftime('%H:%M'))
        end_time = data.get('end_time')

        if not course_id:
            return jsonify({'success': False, 'message': 'course_id gerekli'}), 400

        if not (DATABASE_AVAILABLE and db):
            return jsonify({'success': False, 'message': 'Database not available'}), 503

        session_data = {
            'course_id': course_id,
            'date': date,
            'start_time': start_time,
            'end_time': end_time
        }
        created = db.create_session(session_data)
        logger.info(f"Session created for course {course_id}: {created['id']}")
        return jsonify({'success': True, 'session': created}), 201
    except Exception as e:
        logger.error(f"Create session error: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/sessions/<session_id>/close', methods=['POST'])
@jwt_required()
@require_role('admin', 'instructor')
def close_session(session_id):
    """Yoklama oturumunu manuel kapat"""
    try:
        if not (DATABASE_AVAILABLE and db):
            return jsonify({'success': False, 'message': 'Database not available'}), 503

        updated = db.update_session(session_id, {
            'status': 'closed',
            'end_time': datetime.now().strftime('%H:%M')
        })
        logger.info(f"Session {session_id} closed manually")
        return jsonify({'success': True, 'session': updated})
    except ValueError:
        return jsonify({'success': False, 'message': 'Oturum bulunamadı'}), 404
    except Exception as e:
        logger.error(f"Close session error: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/sessions/<session_id>', methods=['GET'])
@jwt_required()
def get_session(session_id):
    """Tek oturum detayını getir"""
    try:
        if not (DATABASE_AVAILABLE and db):
            return jsonify({'success': False, 'message': 'Database not available'}), 503

        session = db.get_session(session_id)
        if not session:
            return jsonify({'success': False, 'message': 'Oturum bulunamadı'}), 404
        return jsonify({'success': True, 'session': session})
    except Exception as e:
        logger.error(f"Get session error: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500


# ==================== CANCELLATIONS ====================

@app.route('/api/cancellations', methods=['GET'])
@jwt_required()
def get_cancellations():
    """İptal kayıtlarını listele"""
    try:
        course_id = request.args.get('course_id', type=int)

        if not (DATABASE_AVAILABLE and db):
            return jsonify({'success': True, 'cancellations': []})

        cancellations = db.get_cancellations(course_id=course_id)
        return jsonify({'success': True, 'cancellations': cancellations})
    except Exception as e:
        logger.error(f"Get cancellations error: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500


# ==================== EXCUSES ====================

@app.route('/api/excuses', methods=['GET'])
@jwt_required()
def get_excuses():
    """Mazeretleri listele (öğrenci kendi, instructor tümünü görür)"""
    try:
        student_id = request.args.get('student_id')
        course_id = request.args.get('course_id', type=int)

        if not (DATABASE_AVAILABLE and db):
            return jsonify({'success': True, 'excuses': []})

        excuses = db.get_excuses(student_id=student_id, course_id=course_id)
        return jsonify({'success': True, 'excuses': excuses})
    except Exception as e:
        logger.error(f"Get excuses error: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/excuses', methods=['POST'])
@jwt_required()
def create_excuse():
    """Öğrenci mazeret gönderir"""
    try:
        data = request.json
        student_id = data.get('student_id')
        course_id = data.get('course_id')
        session_date = data.get('session_date')
        excuse_type = data.get('excuse_type', 'other')
        description = data.get('description', '')
        document_url = data.get('document_url', '')

        if not all([student_id, course_id, session_date]):
            return jsonify({'success': False, 'message': 'student_id, course_id, session_date gerekli'}), 400

        if not (DATABASE_AVAILABLE and db):
            return jsonify({'success': False, 'message': 'Database not available'}), 503

        excuse_data = {
            'student_id': student_id,
            'course_id': course_id,
            'session_date': session_date,
            'excuse_type': excuse_type,
            'description': description,
            'document_url': document_url,
            'instructor_notes': ''
        }
        created = db.create_excuse(excuse_data)
        logger.info(f"Excuse submitted: student={student_id}, course={course_id}, date={session_date}")
        return jsonify({'success': True, 'excuse': created}), 201
    except Exception as e:
        logger.error(f"Create excuse error: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/excuses/<excuse_id>', methods=['GET'])
@jwt_required()
def get_excuse(excuse_id):
    """Tekil mazeret kaydını getirir"""
    try:
        if not (DATABASE_AVAILABLE and db):
            return jsonify({'success': False, 'message': 'Database not available'}), 503
        excuse = db.get_excuse(excuse_id)
        if not excuse:
            return jsonify({'success': False, 'message': 'Mazeret bulunamadı'}), 404
        return jsonify({'success': True, 'excuse': excuse})
    except Exception as e:
        logger.error(f"Get excuse error: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/excuses/<excuse_id>', methods=['PATCH'])
@jwt_required()
@require_role('admin', 'instructor')
def review_excuse(excuse_id):
    """Instructor mazeret onaylar, reddeder veya geri alır (pending)"""
    try:
        data = request.json
        status = data.get('status')
        notes = data.get('instructor_notes', '')

        if status not in ('approved', 'rejected', 'pending'):
            return jsonify({'success': False, 'message': "status 'approved', 'rejected' veya 'pending' olmalı"}), 400

        if not (DATABASE_AVAILABLE and db):
            return jsonify({'success': False, 'message': 'Database not available'}), 503

        update_data = {'status': status, 'instructor_notes': notes}
        updated = db.update_excuse(excuse_id, update_data)
        logger.info(f"Excuse {excuse_id} updated to {status}")
        return jsonify({'success': True, 'excuse': updated})
    except ValueError:
        return jsonify({'success': False, 'message': 'Mazeret bulunamadı'}), 404
    except Exception as e:
        logger.error(f"Review excuse error: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500


# ==================== QR KOD DOĞRULAMA ====================

@app.route('/api/verify/qr', methods=['POST'])
@jwt_required()
@require_role('student')
def verify_qr():
    """
    QR Kod doğrulama + Yoklama Kaydı Oluşturma — yoklama zincirinin 3. ve son adımı.

    Body:
        session_id        : str   — aktif oturum UUID'si (zorunlu)
        qr_code           : str   — QR okuyucudan okunan değer (zorunlu)
        location_bypassed : bool  — GPS doğrulaması dev modda atlandıysa True (opsiyonel)
        face_simulated    : bool  — Yüz tanıma simüle edildiyse True (opsiyonel)
        location_distance : float — Öğrencinin odaya mesafesi (opsiyonel)
        face_confidence   : float — Yüz tanıma güven skoru 0-1 (opsiyonel)

    Response:
        attendance_record : dict  — Oluşturulan yoklama kaydı
        is_flagged        : bool  — Şüpheli işaretlenip işaretlenmediği
        flag_reason       : str|null
    """
    try:
        data = request.json
        session_id = data.get('session_id')
        qr_code = data.get('qr_code')
        location_bypassed = data.get('location_bypassed', False)
        face_simulated = data.get('face_simulated', False)
        location_distance = data.get('location_distance')
        face_confidence = data.get('face_confidence')

        if not all([session_id, qr_code]):
            return jsonify({'success': False, 'message': 'session_id ve qr_code gerekli'}), 400

        current_username = get_jwt_identity()

        if not (DATABASE_AVAILABLE and db):
            logger.warning("QR verification skipped: database not available (dev mode)")
            return jsonify({'success': True, 'message': 'QR doğrulandı (dev mode)', 'dev_mode': True})

        # ── Oturum kontrolü ──────────────────────────────────────────
        session = db.get_session(session_id)
        if not session:
            return jsonify({'success': False, 'message': 'Oturum bulunamadı'}), 404

        if session.get('status') != 'active':
            return jsonify({'success': False, 'message': 'Bu oturum artık aktif değil'}), 410

        # QR karşılaştır
        if session.get('qr_code') != qr_code:
            logger.warning(f"Invalid QR attempt for session {session_id} by {current_username}")
            return jsonify({'success': False, 'message': 'QR kod geçersiz veya süresi dolmuş'}), 403

        # ── Öğrenci bilgisi ──────────────────────────────────────────
        user = db.get_user(current_username)
        student_id = user.get('student_id') if user else None

        # student_id yoksa kullanıcı adını fallback olarak kullan
        if not student_id:
            student_id = current_username

        student = db.get_student(student_id) if student_id else None
        student_name = student.get('name', current_username) if student else current_username

        course_id = session.get('course_id')
        course = db.get_course(course_id) if course_id else None
        course_code = course.get('code', str(course_id)) if course else str(course_id)

        # ── Mükerrer yoklama kontrolü ────────────────────────────────
        # Aynı oturumda bu öğrenci daha önce yoklama işaretledi mi?
        today = datetime.now().strftime('%Y-%m-%d')
        existing_records = db.get_attendance_records(date=today)
        already_marked = any(
            r.get('student_id') == student_id and r.get('session_id') == session_id
            for r in existing_records
        )

        if already_marked:
            logger.warning(f"Duplicate attendance attempt: {student_id} for session {session_id}")
            # Mükerrer girişi flag'li kaydet
            flag_reason = 'duplicate_attendance'
            is_flagged = True
        else:
            # ── Flag analizi — hangi adımlar atlandı? ────────────────
            flag_reason = None
            if location_bypassed and face_simulated:
                flag_reason = 'location_and_face_bypass'
            elif location_bypassed:
                flag_reason = 'location_bypassed'
            elif face_simulated:
                flag_reason = 'face_simulated'
            is_flagged = flag_reason is not None

        # ── Yoklama kaydı oluştur ────────────────────────────────────
        attendance_record = {
            'student_id': student_id,
            'name': student_name,
            'session_id': session_id,
            'course_id': course_id,
            'timestamp': datetime.now().isoformat(),
            'status': 'present',
            'is_flagged': is_flagged,
            'flag_reason': flag_reason,
            'verification_steps': {
                'location_ok': not location_bypassed,
                'face_ok': not face_simulated,
                'qr_ok': True,
                'location_distance': location_distance,
                'face_confidence': face_confidence
            }
        }

        created = db.create_attendance_record(attendance_record)
        logger.info(
            f"Attendance recorded: {student_id} ({student_name}) "
            f"session={session_id} flagged={is_flagged} reason={flag_reason}"
        )

        # ── Şüpheli ise hocanın telefonuna bildirim ──────────────────
        if is_flagged:
            try:
                notify_instructor_flagged_attendance(
                    session_id=session_id,
                    student_name=student_name,
                    flag_reason=flag_reason,
                    course_code=course_code
                )
            except Exception as notify_err:
                logger.warning(f"Flag notification gönderilemedi: {notify_err}")

        return jsonify({
            'success': True,
            'message': 'Yoklama başarıyla kaydedildi',
            'attendance_record': created,
            'is_flagged': is_flagged,
            'flag_reason': flag_reason
        })

    except Exception as e:
        logger.error(f"QR verification error: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500


# ==================== GPS / GEOFENCING ====================

@app.route('/api/verify/location', methods=['POST'])
@jwt_required()
@require_role('student')
def verify_location():
    """
    GPS doğrulama — öğrencinin aktif oturum sınıfı içinde olup olmadığını kontrol et.

    Body:
        session_id  : str  (zorunlu)
        latitude    : float
        longitude   : float

    Response:
        inside          : bool
        distance_m      : float   (öğrenci ↔ sınıf arası metre)
        geofence_radius : int     (izin verilen maksimum metre)
        room_name       : str
    """
    try:
        data = request.json
        session_id = data.get('session_id')
        student_lat = data.get('latitude')
        student_lng = data.get('longitude')

        if not all([session_id, student_lat is not None, student_lng is not None]):
            return jsonify({'success': False, 'message': 'session_id, latitude ve longitude gerekli'}), 400

        if not (DATABASE_AVAILABLE and db):
            # DB yoksa geçici olarak her konumu kabul et (development modu)
            logger.warning("GPS verification skipped: database not available (dev mode)")
            return jsonify({
                'success': True,
                'inside': True,
                'distance_m': 0,
                'geofence_radius': 50,
                'room_name': 'Dev Mode',
                'dev_mode': True
            })

        # Oturumu bul
        session = db.get_session(session_id)
        if not session:
            return jsonify({'success': False, 'message': 'Oturum bulunamadı'}), 404

        if session.get('status') != 'active':
            return jsonify({'success': False, 'message': 'Bu oturum artık aktif değil'}), 410

        # Ders → oda bilgilerini al
        course_id = session.get('course_id')
        course = db.get_course(course_id) if course_id else None

        room_id = None
        if course and isinstance(course.get('schedule'), dict):
            room_id = course['schedule'].get('room_id')

        room = db.get_room(room_id) if room_id else None

        if not room or room.get('latitude') is None or room.get('longitude') is None:
            # Oda GPS koordinatı tanımlı değilse — yetersiz veri, geçir
            logger.warning(f"Room {room_id} has no GPS coordinates. Skipping geofence check.")
            return jsonify({
                'success': True,
                'inside': True,
                'distance_m': None,
                'geofence_radius': None,
                'room_name': room.get('name', 'Unknown') if room else 'Unknown',
                'warning': 'Room has no GPS data configured'
            })

        room_lat = room['latitude']
        room_lng = room['longitude']
        geofence_radius = room.get('geofence_radius', 50)

        distance = haversine_distance(student_lat, student_lng, room_lat, room_lng)
        inside = distance <= geofence_radius

        logger.info(
            f"GPS check: student at ({student_lat},{student_lng}), "
            f"room '{room['name']}' at ({room_lat},{room_lng}), "
            f"distance={distance:.1f}m, radius={geofence_radius}m, inside={inside}"
        )

        return jsonify({
            'success': True,
            'inside': inside,
            'distance_m': round(distance, 1),
            'geofence_radius': geofence_radius,
            'room_name': room.get('name', 'Unknown')
        })

    except Exception as e:
        logger.error(f"Location verification error: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500


# ==================== FLAGGED ATTENDANCE ====================

@app.route('/api/attendance/flagged', methods=['GET'])
@jwt_required()
@require_role('admin', 'instructor')
def get_flagged_attendance():
    """Şüpheli (flagged) yoklama kayıtlarını listele"""
    try:
        if not (DATABASE_AVAILABLE and db):
            return jsonify({'success': True, 'records': []})

        records = db.get_flagged_attendance()
        return jsonify({'success': True, 'records': records})
    except Exception as e:
        logger.error(f"Get flagged attendance error: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/attendance/<record_id>/review', methods=['PATCH'])
@jwt_required()
@require_role('admin', 'instructor')
def review_attendance(record_id):
    """Şüpheli yoklamayı manuel incele ve sonucu kaydet"""
    try:
        data = request.json
        is_flagged = data.get('is_flagged', False)
        flag_reason = data.get('flag_reason')
        status = data.get('status')

        if not (DATABASE_AVAILABLE and db):
            return jsonify({'success': False, 'message': 'Database not available'}), 503

        update = {'is_flagged': is_flagged, 'flag_reason': flag_reason}
        if status:
            update['status'] = status

        updated = db.update_attendance_record(record_id, update)
        logger.info(f"Attendance {record_id} reviewed: flagged={is_flagged}")
        return jsonify({'success': True, 'record': updated})
    except ValueError:
        return jsonify({'success': False, 'message': 'Yoklama kaydı bulunamadı'}), 404
    except Exception as e:
        logger.error(f"Review attendance error: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500


def load_courses():
    """Dersleri yükle"""
    if os.path.exists('static/courses.json'):
        with open('static/courses.json', 'r', encoding='utf-8') as f:
            return json.load(f)
    return []

def save_courses(courses):
    """Dersleri kaydet"""
    with open('static/courses.json', 'w', encoding='utf-8') as f:
        json.dump(courses, f, ensure_ascii=False, indent=2)

def load_rooms():
    """Sınıfları yükle"""
    if os.path.exists('static/rooms.json'):
        with open('static/rooms.json', 'r', encoding='utf-8') as f:
            return json.load(f)
    return []

def save_rooms(rooms):
    """Sınıfları kaydet"""
    with open('static/rooms.json', 'w', encoding='utf-8') as f:
        json.dump(rooms, f, ensure_ascii=False, indent=2)

def load_data():
    """DEPRECATED: Verileri yükle - Now using database adapter"""
    logger.warning("load_data() is deprecated. Using database adapter instead.")
    pass


# ==================== APScheduler — OTOMATİK OTURUM YÖNETİMİ ====================

def _open_scheduled_sessions():
    """
    Her dakika çalışır. courses tablosundaki schedule yapısına göre
    bugün başlaması gereken derslerin oturumunu otomatik açar.

    Kural:
      - course.schedule.days   → bugün o gün listesinde mi?
      - course.schedule.start_time → şu anki dakika = başlangıç dakikası mı?
      - Aynı course_id + date için zaten bir session varsa tekrar açılmaz.
    """
    if not (DATABASE_AVAILABLE and db):
        return

    now = datetime.now()
    today_name = now.strftime('%A')        # 'Monday', 'Tuesday' …
    today_date = now.strftime('%Y-%m-%d')
    current_hhmm = now.strftime('%H:%M')

    try:
        courses = db.get_courses()
    except Exception as e:
        logger.error(f"[Scheduler] get_courses error: {e}")
        return

    for course in courses:
        schedule = course.get('schedule')
        if not schedule or not isinstance(schedule, dict):
            continue

        days = schedule.get('days', [])
        start_time = schedule.get('start_time')

        if today_name not in days or start_time != current_hhmm:
            continue

        # Bugün bu ders için zaten açık/kapanmış session var mı?
        try:
            existing = db.get_sessions(course_id=course['id'])
            already_opened = any(s.get('date') == today_date for s in existing)
            if already_opened:
                continue

            # Oturumu aç
            session_data = {
                'course_id': course['id'],
                'date': today_date,
                'start_time': start_time,
                'end_time': schedule.get('end_time'),
            }
            created = db.create_session(session_data)
            logger.info(
                f"[Scheduler] Auto-opened session {created['id']} "
                f"for course {course.get('code','?')} at {start_time}"
            )
        except Exception as e:
            logger.error(f"[Scheduler] Failed to open session for course {course.get('id')}: {e}")


def _close_expired_sessions():
    """
    Her dakika çalışır. Bitiş saati geçmiş aktif oturumları otomatik kapatır.

    Kural:
      - session.status == 'active'
      - session.end_time <= şu anki saat
      - session.date == bugün
    """
    if not (DATABASE_AVAILABLE and db):
        return

    now = datetime.now()
    today_date = now.strftime('%Y-%m-%d')
    current_hhmm = now.strftime('%H:%M')

    try:
        active_sessions = db.get_sessions(status='active')
    except Exception as e:
        logger.error(f"[Scheduler] get_sessions error: {e}")
        return

    for session in active_sessions:
        if session.get('date') != today_date:
            continue

        end_time = session.get('end_time')
        if not end_time:
            continue

        if current_hhmm >= end_time:
            try:
                db.update_session(session['id'], {'status': 'closed'})
                logger.info(
                    f"[Scheduler] Auto-closed session {session['id']} "
                    f"(end_time={end_time}, now={current_hhmm})"
                )
            except Exception as e:
                logger.error(f"[Scheduler] Failed to close session {session['id']}: {e}")


def start_scheduler():
    """APScheduler'ı başlat ve dakika bazlı görevleri kaydet."""
    if not SCHEDULER_AVAILABLE:
        logger.warning("[Scheduler] APScheduler not available. Automatic session management disabled.")
        return None

    scheduler = BackgroundScheduler(timezone='Europe/Istanbul')

    # Her dakikanın 0. saniyesinde çalış
    scheduler.add_job(
        _open_scheduled_sessions,
        trigger=CronTrigger(second=0),
        id='open_sessions',
        name='Auto-open scheduled sessions',
        replace_existing=True
    )
    scheduler.add_job(
        _close_expired_sessions,
        trigger=CronTrigger(second=10),   # Aynı dakikada kapama 10 sn sonra
        id='close_sessions',
        name='Auto-close expired sessions',
        replace_existing=True
    )

    scheduler.start()
    logger.info("[Scheduler] APScheduler started — auto session management active")
    return scheduler


# ==================== BAŞLATMA ====================

# Initialize default users on startup
if DATABASE_AVAILABLE and db:
    init_default_users()

# Start background scheduler (otomatik session yönetimi)
scheduler = start_scheduler()

if __name__ == '__main__':
    logger.info(f"Starting Smart Attendance System v2.0.0")
    logger.info(f"Database mode: {db.__class__.__name__ if db else 'NONE'}")

    debug_mode = os.environ.get('DEBUG', 'true').lower() == 'true'
    host = os.environ.get('HOST', '0.0.0.0')
    port = int(os.environ.get('PORT', '5000'))

    logger.info(f"Server starting on {host}:{port} (debug={debug_mode})")

    try:
        app.run(debug=debug_mode, host=host, port=port)
    finally:
        # Uygulama kapanırken scheduler'ı temizle
        if scheduler and scheduler.running:
            scheduler.shutdown()
            logger.info("[Scheduler] APScheduler stopped")

