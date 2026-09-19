import sqlite3
import json

conn = sqlite3.connect('ai_governor.db')
c = conn.cursor()
c.execute("SELECT h.name, m.eligibility, m.rejection_reason FROM matches m JOIN hospitals h ON m.hospital_id = h.id WHERE m.emergency_id = (SELECT id FROM emergencies ORDER BY created_at DESC LIMIT 1);")
rows = c.fetchall()
for row in rows:
    print(f"Hospital: {row[0]}")
    print(f"Eligible: {row[1]}")
    print(f"Reason: {row[2]}")
    print("-" * 20)
conn.close()
