import jwt
import requests
import datetime
import json

# Configuration
API_URL = "https://api.sampreeth.in/api/sessions"
JWT_SECRET = "super-secret-dev-key" 

# payload 
payload = {
    "userId": "verified-user-777",
    "email": "verified@sampreeth.in",
    "name": "Sampreeth Verified"
}

# Generate Token
token = jwt.encode(payload, JWT_SECRET, algorithm="HS256")
print(f"🔑 Generated Token: {token}\n")

# Fake session data (including required fields)
session_data = {
    "authToken": token,
    "userName": "Guest User", # This is what the frontend might send initially
    "chosenCareer": "Software Engineering",
    "conversationSummary": "Verification of JWT storage.",
    "domainScores": {"Engineering": 0.95}
}

# Send Request
print(f"🚀 Sending POST to {API_URL}...")
try:
    response = requests.post(API_URL, json=session_data)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")
    
    if response.status_code == 200:
        print("\n✅ SUCCESS: Backend accepted the signed JWT!")
        session_id = response.json().get('sessionId')
        print(f"📝 Session ID: {session_id}")
        print("👉 Now check the server logs or file to see if 'email' and 'userId' are saved.")
    else:
        print("\n❌ FAILED: Backend rejected the request.")
except Exception as e:
    print(f"\n❌ ERROR: {e}")
