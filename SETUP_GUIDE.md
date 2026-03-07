# Complete Setup Guide

This workspace contains two applications that work together:

## 1. Python Backend (Episodic Engine) - Port 8000

### Setup Steps:

1. Navigate to the episodic_engine directory:
   ```
   cd "vbox backend\episodic_engine"
   ```

2. Create a virtual environment (recommended):
   ```
   python -m venv venv
   venv\Scripts\activate
   ```

3. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

4. Configure environment variables:
   - Edit `.env` file
   - Add your OpenAI API key to `LLM_API_KEY`

5. Start the server:
   ```
   python api.py
   ```
   OR double-click `START_SERVER.bat`

6. Access:
   - API: http://localhost:8000
   - Docs: http://localhost:8000/docs
   - Frontend: http://localhost:8000/

---

## 2. Node.js Frontend (Story App) - Port 5000

### Setup Steps:

1. Navigate to the temp_repo directory:
   ```
   cd "vbox backend\temp_repo"
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Configure environment variables:
   - Edit `.env` file
   - Add your OpenAI API key to `LLM_API_KEY`
   - Add Google OAuth credentials (optional for auth features)
   - Generate JWT secret: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`

4. Start the server:
   ```
   npm start
   ```
   OR for development with auto-reload:
   ```
   npm run dev
   ```

5. Access:
   - App: http://localhost:5000

---

## Quick Start (Both Servers)

Open two terminal windows:

**Terminal 1 (Python Backend):**
```
cd "vbox backend\episodic_engine"
python api.py
```

**Terminal 2 (Node.js Frontend):**
```
cd "vbox backend\temp_repo"
npm start
```

---

## Requirements

- Python 3.8+
- Node.js 16+
- OpenAI API key (or compatible LLM endpoint)
- Google OAuth credentials (optional, for authentication features)

---

## Troubleshooting

### Python Backend Issues:
- If `python` command not found, try `python3` or `py`
- Ensure virtual environment is activated
- Check `.env` file has valid API key

### Node.js Frontend Issues:
- Run `npm install` if modules are missing
- Check port 5000 is not already in use
- Verify `.env` file configuration

### Both servers must be running for full functionality
