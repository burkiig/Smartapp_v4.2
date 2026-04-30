from sqlalchemy import LargeBinary
from sqlalchemy.types import TypeDecorator

from app.security.crypto import embedding_crypto


class EncryptedBinary(TypeDecorator):
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
