# StoryForge AI - Complete System

A full-stack AI-powered episodic story generation platform with emotional analysis, cliffhanger scoring, and retention prediction.

## 🚀 Quick Start

### Option 1: One-Click Start (Recommended)
Double-click `START_ALL.bat` to launch both servers automatically.

### Option 2: Manual Start
Open two terminal windows:

**Terminal 1 - Python Backend:**
```bash
cd "episodic_engine"
python api.py
```

**Terminal 2 - Node.js Frontend:**
```bash
cd "temp_repo"
npm start
```

## 🌐 Access Points

- **Frontend App**: http://localhost:5000
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs
- **Backend Test UI**: http://localhost:8000/

## ✅ Current Status

### Authentication
✅ **Google Auth Bypassed** - No login required!
- Auto-logs in as "Demo User"
- Full access to all features
- No API keys needed for auth

### LLM Configuration
⚠️ **Demo Mode Active** - Using mock responses
- To enable real AI generation, add your OpenAI API key to `.env` files
- See configuration section below

## 📋 System Architecture

### Python Backend (Port 8000)
**Episodic Intelligence Engine** - FastAPI server that:
- Breaks stories into 5-8 episode arcs
- Analyzes emotional progression
- Scores cliffhanger strength
- Predicts retention risk
- Suggests improvements

**Tech Stack:**
- FastAPI
- Pydantic (validation)
- OpenAI-compatible LLM client

### Node.js Frontend (Port 5000)
**StoryForge Dashboard** - Express server with:
- Interactive story creation wizard
- Episode visualization
- Character management
- Emotional arc charts
- Hashtag generation
- Story analytics

**Tech Stack:**
- Express.js
- SQLite database
- Google OAuth (bypassed)
- D3.js for visualizations

## ⚙️ Configuration

### Enable Real AI Generation

#### Python Backend (.env)
Edit `episodic_engine/.env`:
```env
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=sk-your-actual-openai-key-here
LLM_MODEL=gpt-4o-mini
```

#### Node.js Frontend (.env)
Edit `temp_repo/.env`:
```env
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=sk-your-actual-openai-key-here
LLM_MODEL=gpt-4o-mini
```

### Re-enable Google Authentication (Optional)

If you want to restore Google OAuth:

1. Get credentials from [Google Cloud Console](https://console.cloud.google.com/)
2. Update `temp_repo/.env`:
   ```env
   GOOGLE_CLIENT_ID=your-client-id
   GOOGLE_CLIENT_SECRET=your-client-secret
   ```
3. Revert changes in:
   - `temp_repo/src/middleware/authenticate.js`
   - `temp_repo/public/app.js`

## 📦 Dependencies

### Python Requirements
- Python 3.8+
- fastapi
- uvicorn
- pydantic
- httpx
- python-dotenv

All installed via: `pip install -r episodic_engine/requirements.txt`

### Node.js Requirements
- Node.js 16+
- express
- cors
- dotenv
- jsonwebtoken
- google-auth-library
- sql.js

All installed via: `npm install` in `temp_repo/`

## 🎯 Features

### Story Generation
- Multi-genre support (thriller, horror, romance, sci-fi, etc.)
- Customizable episode count (5-15 episodes)
- AI-generated or user-defined characters
- Emotional mood selection

### Analysis & Optimization
- **Emotional Arc Analysis**: Tracks valence, intensity, surprise, empathy
- **Cliffhanger Scoring**: Rates hook strength per episode
- **Retention Prediction**: Identifies drop-off risk points
- **Plot Twists**: Generates unexpected story turns
- **Hashtag Generation**: Creates optimized social media tags

### Visualization
- Episode timeline view
- Character relationship maps
- Emotional progression charts
- Retention risk indicators

## 🔧 Troubleshooting

### Python Backend Issues
- **Port 8000 in use**: Change `PORT` in `episodic_engine/.env`
- **Module not found**: Run `pip install -r requirements.txt`
- **Python not found**: Try `python3` or `py` instead of `python`

### Node.js Frontend Issues
- **Port 5000 in use**: Change `PORT` in `temp_repo/.env`
- **Dependencies missing**: Run `npm install` in `temp_repo/`
- **Database errors**: Delete `temp_repo/data/app.db` and restart

### Both Servers Must Be Running
The frontend (port 5000) communicates with the backend (port 8000). Both must be active for full functionality.

## 📁 Project Structure

```
vbox backend/
├── episodic_engine/          # Python Backend
│   ├── agents/               # Coordinator agent
│   ├── modules/              # Core analysis modules
│   ├── schemas/              # Pydantic models
│   ├── services/             # Intelligence engine
│   ├── utils/                # LLM client & helpers
│   ├── api.py                # FastAPI server
│   ├── pipeline_orchestrator.py
│   └── requirements.txt
│
├── temp_repo/                # Node.js Frontend
│   ├── public/               # Frontend assets
│   │   ├── index.html        # Main app
│   │   ├── app.js            # Frontend logic
│   │   └── styles.css
│   ├── src/
│   │   ├── controllers/      # Request handlers
│   │   ├── services/         # Business logic
│   │   ├── routes/           # API routes
│   │   └── middleware/       # Auth (bypassed)
│   ├── server.js             # Express server
│   └── package.json
│
├── START_ALL.bat             # Launch both servers
├── SETUP_GUIDE.md            # Detailed setup
└── README.md                 # This file
```

## 🎬 Usage Example

1. Open http://localhost:5000
2. You'll be auto-logged in as "Demo User"
3. Fill in the story wizard:
   - Select genre (e.g., "Thriller")
   - Choose mood (e.g., "Suspense")
   - Set episode count (e.g., 6)
   - Enter story description
4. Click "Generate Story"
5. View results:
   - Episode breakdown
   - Character profiles
   - Emotional arc
   - Plot twists
   - Hashtags

## 🔐 Security Notes

- Auth bypass is for development only
- Don't expose to public internet with auth disabled
- Keep API keys in `.env` files (never commit them)
- `.env` files are gitignored by default

## 📝 License

See individual project licenses.

## 🤝 Support

For issues or questions, check:
- Backend API docs: http://localhost:8000/docs
- Setup guide: `SETUP_GUIDE.md`
- Server logs in terminal windows

---

**Status**: ✅ Both servers running | 🔓 Auth bypassed | ⚡ Demo mode active
