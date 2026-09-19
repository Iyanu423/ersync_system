import os

# Tests must never touch the real dev database (the old suite dropped every table in ai_governor.db).
os.environ["DATABASE_URL"] = "sqlite:///./test_ersync.db"
