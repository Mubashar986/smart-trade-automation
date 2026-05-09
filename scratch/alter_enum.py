from sqlalchemy import text
from backend.db.database import engine

def add_enum_values():
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TYPE jobstatus ADD VALUE 'parsing'"))
            conn.commit()
            print("Added 'parsing' to jobstatus")
        except Exception as e:
            print(f"Error adding 'parsing': {e}")
            
        try:
            conn.execute(text("ALTER TYPE jobstatus ADD VALUE 'validating'"))
            conn.commit()
            print("Added 'validating' to jobstatus")
        except Exception as e:
            print(f"Error adding 'validating': {e}")

if __name__ == "__main__":
    add_enum_values()
