# Contributing to OpenRAG

Thank you for helping improve OpenRAG. This document explains how to set up a dev environment, run checks, and open changes that are easy to review.

Please read the **[Code of Conduct](CODE_OF_CONDUCT.md)** before participating.

---

## Ways to help

- **Bug reports** — Repro steps, expected vs actual behavior, versions (Python, OS), and relevant logs.
- **Feature ideas** — Open an issue first for larger changes so we can agree on design.
- **Documentation** — README, deployment guides, docstrings where they clarify non-obvious behavior.
- **Code** — Parsers, retrieval, prompts, API, frontend, tests, CI, packaging.

---

## Development setup

### Backend

```bash
git clone <your-fork-url> openrag
cd openrag
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install --upgrade pip
pip install -r requirements.txt
cp .env.example .env
docker compose up -d
alembic upgrade head
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Use `POSTGRES_PORT=5433` with the provided `docker-compose.yml`. See the [README](README.md) for full configuration.

### Frontend (optional)

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

### Useful commands

| Command | Purpose |
|---------|---------|
| `pytest -q -m "not integration"` | Fast tests (no live DB/OpenAI required for many cases) |
| `pytest -q` | Full suite (needs DB per `.env` and keys for integration paths) |
| `cd frontend && npm run lint` | Typecheck frontend (`tsc --noEmit`) |

---

## Project conventions

- **Match existing style** — Imports, naming, and patterns in nearby files.
- **Focused changes** — One logical change per pull request when possible.
- **Tests** — Add or update tests for behavior changes; fix any failures your change introduces.
- **Configuration** — If you add or rename environment variables, update `.env.example` and the README configuration section.
- **API behavior** — If routes or schemas change, update OpenAPI consumers (frontend types, README examples).

---

## Adding a new document format

1. Implement `DocumentParser` in `app/services/parsing/base.py`.
2. Register with `register_parser(...)` in `app/services/parsing/registry.py` (load your module from `_ensure_builtins` or equivalent).
3. Add tests (see `tests/test_parser_registry.py`).
4. Document the format in the README if it is user-facing.

---

## Pull requests

1. **Branch** — Use a descriptive branch name (e.g. `fix/upload-mime-detection`, `feat/hybrid-search`).
2. **Description** — What problem this solves, how you tested it, and any follow-ups.
3. **Size** — Large features may be split into smaller PRs for easier review.
4. **CI** — If the repo has GitHub Actions, ensure checks pass (or explain why not).

---

## Security issues

Do **not** open a public issue for security vulnerabilities. Contact the maintainers privately (for example via GitHub **Security Advisories** if enabled on the repository, or a maintainer email if one is published in the repo or org profile).

---

## Questions

Open a **Discussion** or **Issue** (depending on what the project uses) with the `question` label, or comment on an existing thread. Clear questions get faster answers.

Thank you again for contributing.
