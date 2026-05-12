"""Loraloop agents — each agent's public callable lives here.

Adding a new agent:
1. Create app/agents/{name}.py with run() returning dict[str, Any]
2. Register in api/routers/agents.py
"""

from app.agents.sophie import run as run_sophie

__all__ = ["run_sophie"]
