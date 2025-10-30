# Session Management Guide

> Detailed guide for managing Claude Agent SDK sessions in the Buyer List Builder

---

## Overview

The Claude Agent SDK provides automatic session management, but understanding how sessions work is critical for production deployments.

## Session Storage

### Default Location

Sessions are stored on the local filesystem:

```
~/.claude/sessions/
├── session-abc123/
│   ├── conversation.json    ← Full conversation history
│   ├── context.json         ← Context and state
│   └── files/               ← Any files created/modified
└── session-xyz789/
    └── ...
```

### Custom Location (Recommended)

Store sessions with client data:

```python
import os
from pathlib import Path

def setup_claude_sessions(listing_id: str):
    """Configure Claude to use per-client session directory"""
    output_dir = Path('data/outputs') / listing_id
    sessions_dir = output_dir / '.claude_sessions'
    sessions_dir.mkdir(parents=True, exist_ok=True)
    
    # Tell Claude CLI where to store sessions
    os.environ['CLAUDE_SESSION_DIR'] = str(sessions_dir)
    
    return sessions_dir
```

## Session Lifecycle

### Creating Sessions

```python
from claude_agent_sdk import query, ClaudeAgentOptions

session_id = None

async for message in query(
    prompt="Find companies in Strategic Buyers category",
    options=ClaudeAgentOptions(
        permission_mode='bypassPermissions',
        allowed_tools=['WebSearch']
    )
):
    if hasattr(message, 'subtype') and message.subtype == 'init':
        session_id = message.data.get('session_id')
        print(f"Session created: {session_id}")
```

### Resuming Sessions

```python
# Later, resume the conversation
async for message in query(
    prompt="Continue where we left off",
    options=ClaudeAgentOptions(
        resume=session_id
    )
):
    print(message)
```

### Tracking Sessions in Database

```python
import aiosqlite
from datetime import datetime, timedelta

async def track_session(db_path: str, session_id: str, listing_id: str, stage: str):
    """Track session with automatic expiration"""
    expires_at = (datetime.now() + timedelta(days=7)).isoformat()
    
    async with aiosqlite.connect(db_path) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS claude_sessions (
                session_id TEXT PRIMARY KEY,
                listing_id TEXT NOT NULL,
                stage TEXT NOT NULL,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                status TEXT DEFAULT 'active'
            )
        """)
        
        await db.execute("""
            INSERT INTO claude_sessions 
            (session_id, listing_id, stage, created_at, expires_at)
            VALUES (?, ?, ?, ?, ?)
        """, (session_id, listing_id, stage, datetime.now().isoformat(), expires_at))
        
        await db.commit()
```

## Session Cleanup

### Time-Based Cleanup

```python
import shutil
from pathlib import Path
from datetime import datetime, timedelta

async def cleanup_expired_sessions(sessions_dir: Path, max_age_days: int = 30):
    """Remove sessions older than max_age_days"""
    cutoff_date = datetime.now() - timedelta(days=max_age_days)
    
    for session_dir in sessions_dir.iterdir():
        if not session_dir.is_dir():
            continue
        
        mtime = datetime.fromtimestamp(session_dir.stat().st_mtime)
        
        if mtime < cutoff_date:
            print(f"🗑️  Removing expired session: {session_dir.name}")
            shutil.rmtree(session_dir)
```

### Database-Driven Cleanup

```python
async def cleanup_expired_sessions_from_db(db_path: str, sessions_dir: Path):
    """Remove expired sessions based on database tracking"""
    async with aiosqlite.connect(db_path) as db:
        cursor = await db.execute("""
            SELECT session_id FROM claude_sessions
            WHERE expires_at < ? AND status = 'active'
        """, (datetime.now().isoformat(),))
        
        expired = await cursor.fetchall()
        
        for (session_id,) in expired:
            session_path = sessions_dir / session_id
            if session_path.exists():
                shutil.rmtree(session_path)
            
            await db.execute("""
                UPDATE claude_sessions 
                SET status = 'expired' 
                WHERE session_id = ?
            """, (session_id,))
        
        await db.commit()
        
        print(f"🗑️  Cleaned up {len(expired)} expired sessions")
```

## Complete Session Manager

```python
# session_manager.py

from pathlib import Path
from datetime import datetime, timedelta
import shutil
import aiosqlite
import logging
import os

logger = logging.getLogger(__name__)

class SessionManager:
    def __init__(self, output_dir: Path, max_age_days: int = 30):
        self.output_dir = output_dir
        self.sessions_dir = output_dir / '.claude_sessions'
        self.db_path = output_dir / 'buyers.db'
        self.max_age_days = max_age_days
        
    def setup(self):
        """Initialize session directory and configure Claude CLI"""
        self.sessions_dir.mkdir(parents=True, exist_ok=True)
        os.environ['CLAUDE_SESSION_DIR'] = str(self.sessions_dir)
        logger.info(f"📁 Claude sessions: {self.sessions_dir}")
        return self.sessions_dir
    
    async def init_table(self):
        """Create sessions tracking table"""
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("""
                CREATE TABLE IF NOT EXISTS claude_sessions (
                    session_id TEXT PRIMARY KEY,
                    listing_id TEXT NOT NULL,
                    stage TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    expires_at TEXT NOT NULL,
                    status TEXT DEFAULT 'active',
                    metadata TEXT
                )
            """)
            await db.commit()
    
    async def track_session(self, session_id: str, stage: str, listing_id: str, metadata: dict = None):
        """Track a new session"""
        expires_at = (datetime.now() + timedelta(days=self.max_age_days)).isoformat()
        
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("""
                INSERT OR REPLACE INTO claude_sessions 
                (session_id, listing_id, stage, created_at, expires_at, metadata)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                session_id, 
                listing_id, 
                stage, 
                datetime.now().isoformat(), 
                expires_at,
                json.dumps(metadata) if metadata else None
            ))
            await db.commit()
        
        logger.info(f"📝 Tracked session: {session_id} (expires in {self.max_age_days} days)")
    
    async def extend_session(self, session_id: str, additional_days: int = 7):
        """Extend session expiration"""
        new_expiry = (datetime.now() + timedelta(days=additional_days)).isoformat()
        
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("""
                UPDATE claude_sessions 
                SET expires_at = ? 
                WHERE session_id = ?
            """, (new_expiry, session_id))
            await db.commit()
        
        logger.info(f"⏰ Extended session {session_id} by {additional_days} days")
    
    async def cleanup_expired(self):
        """Remove expired sessions"""
        async with aiosqlite.connect(self.db_path) as db:
            cursor = await db.execute("""
                SELECT session_id FROM claude_sessions
                WHERE expires_at < ? AND status = 'active'
            """, (datetime.now().isoformat(),))
            
            expired = await cursor.fetchall()
            
            for (session_id,) in expired:
                session_path = self.sessions_dir / session_id
                if session_path.exists():
                    shutil.rmtree(session_path)
                    logger.info(f"🗑️  Removed expired session: {session_id}")
                
                await db.execute("""
                    UPDATE claude_sessions 
                    SET status = 'expired' 
                    WHERE session_id = ?
                """, (session_id,))
            
            await db.commit()
            
            return len(expired)
    
    async def list_active_sessions(self):
        """List all active sessions"""
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute("""
                SELECT * FROM claude_sessions
                WHERE status = 'active'
                ORDER BY created_at DESC
            """)
            
            rows = await cursor.fetchall()
            return [dict(row) for row in rows]
    
    async def get_session_stats(self):
        """Get session statistics"""
        async with aiosqlite.connect(self.db_path) as db:
            cursor = await db.execute("""
                SELECT 
                    status,
                    COUNT(*) as count
                FROM claude_sessions
                GROUP BY status
            """)
            
            stats = {row[0]: row[1] for row in await cursor.fetchall()}
            
            cursor = await db.execute("""
                SELECT COUNT(*) FROM claude_sessions
                WHERE expires_at < ?
            """, (datetime.now().isoformat(),))
            
            stats['expired_pending_cleanup'] = (await cursor.fetchone())[0]
            
            return stats

# Usage example
async def main():
    listing_id = "cranbury_and_dunwell"
    output_dir = Path(f"data/outputs/{listing_id}")
    
    # Initialize session manager
    session_manager = SessionManager(output_dir, max_age_days=7)
    sessions_dir = session_manager.setup()
    await session_manager.init_table()
    
    # Run pipeline and track session
    session_id = None
    async for message in query(prompt="...", options=options):
        if hasattr(message, 'subtype') and message.subtype == 'init':
            session_id = message.data.get('session_id')
            await session_manager.track_session(
                session_id, 
                "stage_3", 
                listing_id,
                metadata={"workers": 8, "timeout": 900}
            )
    
    # Cleanup expired sessions
    cleaned = await session_manager.cleanup_expired()
    print(f"Cleaned up {cleaned} expired sessions")
    
    # Get stats
    stats = await session_manager.get_session_stats()
    print(f"Session stats: {stats}")
```

## Container Deployment

### Docker Volume Mapping

```dockerfile
FROM python:3.11-slim

# Install Claude CLI
RUN curl -o- https://claude.ai/install.sh | bash

WORKDIR /app
COPY . .
RUN pip install -r requirements.txt

# Sessions will be stored in mounted volume
VOLUME /app/data/outputs

CMD ["python", "run_pipeline.py"]
```

```bash
# Run with persistent storage
docker run \
  -v $(pwd)/data/outputs:/app/data/outputs \
  -e LISTING_ID=cranbury_and_dunwell \
  buyer-list-builder:latest
```

### Docker Compose

```yaml
version: '3.8'

services:
  buyer-list-builder:
    build: .
    volumes:
      - ./data/outputs:/app/data/outputs
    environment:
      - LISTING_ID=${LISTING_ID}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
```

## Best Practices

### 1. Always Use Per-Client Session Directories

```python
# ✅ Good - sessions tied to client
sessions_dir = Path(f"data/outputs/{listing_id}/.claude_sessions")

# ❌ Bad - sessions in global location
sessions_dir = Path.home() / ".claude" / "sessions"
```

### 2. Track Sessions in Database

Always track sessions in your database for lifecycle management and debugging.

### 3. Set Appropriate Expiration Times

```python
# Short-lived workflows (1-2 hours)
max_age_days = 1

# Multi-day workflows
max_age_days = 7

# Long-term projects
max_age_days = 30
```

### 4. Cleanup Regularly

```python
# Run cleanup as part of pipeline
await session_manager.cleanup_expired()

# Or as a scheduled job
# crontab: 0 2 * * * python cleanup_sessions.py
```

### 5. Handle Session Failures Gracefully

```python
try:
    async for message in query(
        prompt="...",
        options=ClaudeAgentOptions(resume=session_id)
    ):
        process_message(message)
except Exception as e:
    logger.error(f"Session {session_id} failed: {e}")
    # Mark session as failed in database
    await mark_session_failed(session_id)
```

## Troubleshooting

### Session Not Found

**Problem:** `resume=session_id` fails with "Session not found"

**Solutions:**
1. Check `CLAUDE_SESSION_DIR` environment variable
2. Verify session directory exists
3. Check file permissions
4. Ensure session hasn't been cleaned up

### Sessions Growing Too Large

**Problem:** Session directories consuming too much disk space

**Solutions:**
1. Reduce `max_age_days`
2. Run cleanup more frequently
3. Implement size-based cleanup
4. Consider forking sessions instead of resuming

### Cross-Container Session Access

**Problem:** Session created in one container not accessible in another

**Solutions:**
1. Use shared volumes
2. Use sticky sessions (route to same container)
3. Store sessions in shared filesystem (NFS/EFS)
4. Implement manual session management

## Summary

- **Store sessions with client data** for natural lifecycle management
- **Track sessions in database** for visibility and cleanup
- **Set appropriate expiration times** based on workflow duration
- **Cleanup regularly** to prevent disk space issues
- **Use persistent volumes** in container deployments
- **Handle failures gracefully** and mark failed sessions
