"""
Career Compass React - Backend Server
Provides ephemeral token endpoint for secure Gemini Live API access
"""

import datetime
import json
import logging
import os
from pathlib import Path

from aiohttp import web
from aiohttp.web import middleware
from dotenv import load_dotenv
from google import genai
import jwt

# Load environment variables
load_dotenv()

API_KEY = os.getenv("GEMINI_API_KEY")
if not API_KEY:
    raise ValueError("GEMINI_API_KEY not found in .env file")

JWT_SECRET = os.getenv("JWT_SECRET", "super-secret-dev-key") # TODO: Change in production

# Configuration
PORT = int(os.getenv("PORT", 8000))
HOST = os.getenv("HOST", "0.0.0.0")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
SESSIONS_DIR = Path(__file__).parent / "data"
SESSIONS_DIR.mkdir(parents=True, exist_ok=True)

# Initialize Gemini client
client = genai.Client(api_key=API_KEY, http_options={"api_version": "v1alpha"})

# Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger('CareerCompass')
logger.info(f"🔑 API Key loaded: {API_KEY[:4]}...{API_KEY[-4:]}")


# ============================================================================
# MIDDLEWARE
# ============================================================================

@middleware
async def cors_middleware(request, handler):
    """Handle CORS for React frontend"""
    if request.method == 'OPTIONS':
        response = web.Response()
    else:
        try:
            response = await handler(request)
        except web.HTTPException as ex:
            response = ex
    
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate'
    
    return response


# ============================================================================
# API ROUTES
# ============================================================================

async def get_ephemeral_token(request):
    """Generate ephemeral token for client-side Gemini connection"""
    try:
        now = datetime.datetime.now(tz=datetime.timezone.utc)
        
        token = client.auth_tokens.create(
            config={
                'uses': 1,
                'expire_time': now + datetime.timedelta(minutes=30),
                'new_session_expire_time': now + datetime.timedelta(minutes=2),
                'http_options': {'api_version': 'v1alpha'}
            }
        )
        
        logger.info("✅ Ephemeral token generated")
        
        return web.json_response({
            'token': token.name,
            'expiresAt': (now + datetime.timedelta(minutes=30)).isoformat(),
            'model': 'gemini-2.5-flash-native-audio-preview-09-2025'
        })
        
    except Exception as e:
        logger.error(f"❌ Token generation failed: {e}")
        return web.json_response({'error': str(e)}, status=500)


async def save_session(request):
    """Save session summary"""
    try:
        data = await request.json()
        
        # Basic Validation for Deterministic Engine
        required_fields = ['userName', 'chosenCareer', 'conversationSummary']
        for field in required_fields:
            if field not in data:
                return web.json_response({'error': f'Missing required field: {field}'}, status=400)

        # Ensure scores are present if this is an assessment session
        if 'traitScores' not in data and 'domainScores' not in data:
            logger.warning("⚠️ Saving session without scores (legacy format?)")
        
        session_id = data.get('sessionId', f'session_{int(datetime.datetime.now().timestamp() * 1000)}')
        
        # Verify Auth Token if present
        auth_token = data.get('authToken')
        user_info = {}
        
        if auth_token:
            try:
                # expecting token signed by parent site
                payload = jwt.decode(auth_token, JWT_SECRET, algorithms=["HS256"])
                user_info = {
                    'userId': payload.get('userId'),
                    'email': payload.get('email'),
                    'name': payload.get('name')
                }
                logger.info(f"🔐 Verified user: {user_info.get('email')}")
            except jwt.ExpiredSignatureError:
                logger.warning("⚠️ Token expired")
            except jwt.InvalidTokenError:
                logger.warning("⚠️ Invalid token")
        
        # Merge verified user info into data
        if user_info:
            data.update(user_info)
            # data['userName'] = user_info.get('name', data.get('userName')) # Optional: override name
            
        filepath = SESSIONS_DIR / f"{session_id}.json"
        
        with open(filepath, 'w') as f:
            json.dump(data, f, indent=2)
        
        logger.info(f"💾 Session saved: {session_id}")
        return web.json_response({'success': True, 'sessionId': session_id})
    except Exception as e:
        logger.error(f"❌ Save failed: {e}")
        return web.json_response({'error': str(e)}, status=500)


async def list_sessions(request):
    """List all saved sessions"""
    try:
        sessions = []
        for f in SESSIONS_DIR.glob('*.json'):
            try:
                with open(f) as file:
                    data = json.load(file)
                    
                    # Extract top domain score if available
                    chosen_score = None
                    if 'domainScores' in data and 'chosenCareer' in data:
                        chosen_score = data['domainScores'].get(data['chosenCareer'])

                    sessions.append({
                        'id': f.stem,
                        'userName': data.get('userName', 'Unknown'),
                        'createdAt': data.get('createdAt'),
                        'chosenCareer': data.get('chosenCareer'),
                        'score': chosen_score,
                        'confidence': data.get('confidenceMetrics', {}).get('overall')
                    })
            except Exception as e:
                logger.error(f"Failed to load session {f}: {e}")
                continue
                
        sessions.sort(key=lambda x: x.get('createdAt', ''), reverse=True)
        return web.json_response({'sessions': sessions})
    except Exception as e:
        return web.json_response({'error': str(e)}, status=500)


async def get_session(request):
    """Get a specific session by ID"""
    session_id = request.match_info['id']
    filepath = SESSIONS_DIR / f"{session_id}.json"
    
    if not filepath.exists():
        return web.json_response({'error': 'Session not found'}, status=404)
    
    with open(filepath) as f:
        data = json.load(f)
    
    return web.json_response(data)


async def health_check(request):
    """Health check endpoint"""
    return web.json_response({'status': 'ok', 'service': 'career-compass-api'})


# ============================================================================
# APPLICATION
# ============================================================================

def create_app():
    app = web.Application(middlewares=[cors_middleware])
    
    # API routes
    app.router.add_get('/api/token', get_ephemeral_token)
    app.router.add_post('/api/sessions', save_session)
    app.router.add_get('/api/sessions', list_sessions)
    app.router.add_get('/api/sessions/{id}', get_session)
    app.router.add_get('/api/health', health_check)
    app.router.add_options('/{path:.*}', lambda r: web.Response())
    
    return app


def main():
    logger.info("=" * 50)
    logger.info("🧭 CAREER COMPASS - API Server")
    logger.info("=" * 50)
    logger.info(f"   Port: {PORT}")
    logger.info(f"   Frontend: {FRONTEND_URL}")
    logger.info("")
    logger.info("   Endpoints:")
    logger.info("   GET  /api/token        - Get ephemeral token")
    logger.info("   POST /api/sessions     - Save session")
    logger.info("   GET  /api/sessions     - List sessions")
    logger.info("   GET  /api/sessions/:id - Get session")
    logger.info("")
    
    app = create_app()
    web.run_app(app, host=HOST, port=PORT, print=None)


if __name__ == "__main__":
    main()
