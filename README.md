# SyncBoard Collab

Real-time collaborative workspace & task management system built with React, FastAPI, and PostgreSQL. 

> **Note:** This project is designed to run natively on your local machine. **No Docker** or third-party message brokers like Redis are required!

## 🚀 Features

- 🔐 **JWT Authentication** — Secure registration and login
- 📋 **Workspace Management** — Create and manage team workspaces
- 🏗️ **Kanban Board** — Drag-and-drop task management with To Do, In Progress, Review, and Done columns
- ⚡ **Real-Time Updates** — WebSocket-powered live synchronization (In-memory broadcasting)
- 👥 **RBAC Permissions** — Admin, Editor, and Viewer roles per workspace
- 🔄 **Conflict Resolution** — Version-based optimistic concurrency control
- 📜 **Audit Trail** — Complete activity history for all task mutations
- 🟢 **Live Presence** — See exactly who's online in each workspace in real-time

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React (Vite) |
| Backend | FastAPI (Python) |
| Database | PostgreSQL |
| Auth | JWT (bcrypt + jose) |

## 🏁 Quick Start Guide

Follow these instructions to get the project running on your local machine.

### Prerequisites
- **Python 3.10+**
- **Node.js 18+**
- **PostgreSQL 15+**

---

### Step 1: Database Setup

First, you need to create the database and user in PostgreSQL. Open your terminal and run `psql -U postgres` (enter your postgres password when prompted), then execute:

```sql
-- 1. Create the database
CREATE DATABASE syncboard_db;

-- 2. Create the user with a password
CREATE USER syncboard WITH ENCRYPTED PASSWORD 'syncboard_secret_2024';

-- 3. Connect to the new database
\c syncboard_db

-- 4. Grant necessary permissions (Crucial for Postgres 15+)
GRANT ALL ON SCHEMA public TO syncboard;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO syncboard;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO syncboard;

-- 5. Exit psql
\q
```

---

### Step 2: Environment Variables

In the root folder of the project, create a `.env` file by copying the example:

```bash
# Windows
copy .env.example .env

# Mac/Linux
cp .env.example .env
```

Ensure your `.env` contains the correct database URL:
```env
# PostgreSQL (local)
POSTGRES_USER=syncboard
POSTGRES_PASSWORD=syncboard_secret_2024
POSTGRES_DB=syncboard_db
DATABASE_URL=postgresql+asyncpg://syncboard:syncboard_secret_2024@localhost:5432/syncboard_db

# JWT
JWT_SECRET_KEY=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30

# App
BACKEND_CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

---

### Step 3: Start the Backend

Open a terminal in the project root:

```bash
cd backend

# Create a virtual environment
python -m venv venv

# Activate the virtual environment
# On Windows:
.\venv\Scripts\activate
# On Mac/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run the FastAPI server pointing to the root .env file
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload --env-file ../.env
```
*(The API will automatically create the database tables on startup!)*

---

### Step 4: Start the Frontend

Open a **new** terminal (leave the backend running) in the project root:

```bash
cd frontend

# Install dependencies
npm install

# Start the Vite dev server
npm run dev
```

---

### 🎉 You're Done!

- **Web App**: [http://localhost:5173](http://localhost:5173)
- **Interactive API Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)

Create an account, create a workspace, and invite team members to see the live real-time sync in action!

## 📁 Project Structure

```text
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI entry point
│   │   ├── config.py            # Environment configuration
│   │   ├── database.py          # Async SQLAlchemy setup
│   │   ├── models/              # SQLAlchemy ORM models
│   │   ├── schemas/             # Pydantic request/response schemas
│   │   ├── routers/             # API REST endpoints
│   │   ├── services/            # Business logic
│   │   ├── websocket/           # WebSocket real-time manager & handlers
│   │   ├── middleware/          # JWT auth dependency
│   │   └── utils/               # Security utilities
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── api/                 # Axios clients and API configurations
│   │   ├── components/          # Reusable React components
│   │   ├── context/             # Global states (AuthContext, etc.)
│   │   ├── hooks/               # Custom hooks for WebSockets
│   │   └── pages/               # Main application views
│   ├── vite.config.js
│   └── package.json
├── .env
└── README.md
```
