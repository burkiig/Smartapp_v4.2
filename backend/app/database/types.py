"""
Özel SQLAlchemy tipleri.

CompatibleJSON:
  PostgreSQL'de JSONB (binary, index'lenebilir) olarak,
  SQLite'da (test ortamı) standart JSON olarak render edilir.
  Modeller tek tip kullanır, dialect farkını bu sınıf yönetir.

EncryptedBinary:
  Yüz embedding verisini Fernet ile şifreler/çözer.
"""

from sqlalchemy import JSON, LargeBinary
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.types import TypeDecorator

from app.security.crypto import embedding_crypto


class CompatibleJSON(TypeDecorator):
    """
    Dialect-aware JSON tip sarmalayıcısı.

    - PostgreSQL  → JSONB  (binary, GIN index desteği, daha hızlı)
    - SQLite/diğer → JSON  (test ve geliştirme ortamları için)

    Kullanım:
        from app.database.types import CompatibleJSON
        detail = Column(CompatibleJSON, nullable=True)
    """

    impl = JSON
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(JSONB())
        return dialect.type_descriptor(JSON())

    def process_bind_param(self, value, dialect):
        # Serileştirme SQLAlchemy'ye bırakılır
        return value

    def process_result_value(self, value, dialect):
        # Deserializasyon SQLAlchemy'ye bırakılır
        return value


class EncryptedBinary(TypeDecorator):
    """Yüz embedding verisini Fernet ile şifreler/çözer."""

    impl = LargeBinary
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        return embedding_crypto.encrypt(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        return embedding_crypto.decrypt(value)
