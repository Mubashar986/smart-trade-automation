import os
import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from sqlalchemy import text
from backend.db.database import engine

def check_and_fix_enum():
    with engine.connect() as conn:
        result = conn.execute(text("SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE typname = 'jobstatus'"))
        labels = [row[0] for row in result.fetchall()]
        print("Current labels:", labels)
        
        for new_label in ['PARSING', 'VALIDATING']:
            if new_label not in labels:
                try:
                    conn.execute(text(f"ALTER TYPE jobstatus ADD VALUE '{new_label}'"))
                    conn.commit()
                    print(f"Added {new_label}")
                except Exception as e:
                    print(f"Error adding {new_label}: {e}")

if __name__ == "__main__":
    check_and_fix_enum()
