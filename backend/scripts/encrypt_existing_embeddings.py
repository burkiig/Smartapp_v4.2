from app.database.connection import SessionLocal
from app.models.face_reference import FaceReference


def main() -> None:
    db = SessionLocal()
    try:
        refs = db.query(FaceReference).yield_per(100)
        count = 0
        for ref in refs:
            # Re-assign triggers EncryptedBinary.process_bind_param on commit.
            ref.embedding = ref.embedding
            count += 1
            if count % 100 == 0:
                db.commit()
        db.commit()
        print(f"Encrypted embeddings processed: {count}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
