"""Lazy lifecycle for the integrated local agentic RAG service."""

import logging
from threading import Lock

from .agentic_rag import (
    AgenticRAG,
    CHROMA_PATH,
    DATA_DIR,
    DEPARTMENTS,
    EMBED_MODEL,
    LLM_MODEL,
    OLLAMA_URL,
    list_documents,
)

logger = logging.getLogger(__name__)
_lock = Lock()
_agent = None
_initialized = False
_init_error = None
_index_report = {}


def _initialize() -> None:
    global _agent, _initialized, _init_error, _index_report
    with _lock:
        if _initialized:
            return
        try:
            agent = AgenticRAG()
            report = agent.reload()
            _agent = agent
            _index_report = report
            _init_error = None
        except Exception as exc:
            _init_error = str(exc)
            logger.exception("RAG: échec de l'initialisation")
        finally:
            _initialized = True


def rag_answer(question: str, language: str = "fr") -> dict:
    _initialize()
    if _agent is None:
        return {
            "reply": (
                "Le service RAG n'est pas disponible : "
                f"{_init_error or 'initialisation impossible'}"
            ),
            "sources": [],
            "mode": "rag_error",
        }
    try:
        return _agent.ask(question, language=language)
    except Exception as exc:
        logger.exception("RAG: erreur pendant la réponse")
        return {
            "reply": f"Le service RAG n'a pas pu répondre : {exc}",
            "sources": [],
            "mode": "rag_error",
        }


def is_rag_available() -> bool:
    _initialize()
    return _agent is not None and _init_error is None


def rag_status() -> dict:
    available = is_rag_available()
    report = _index_report if available else {}
    return {
        "available": available,
        "error": None if available else _init_error,
        "embed_model": EMBED_MODEL,
        "llm_model": LLM_MODEL,
        "ollama_url": OLLAMA_URL,
        "data_dir": str(DATA_DIR),
        "chroma_path": CHROMA_PATH,
        "departments": report.get("departments", len(DEPARTMENTS)),
        "documents": report.get("documents", len(list_documents())),
        "chunks": report.get("chunks", 0),
    }


def rebuild_index() -> dict:
    global _agent, _initialized, _init_error, _index_report
    _initialize()
    if _agent is None:
        with _lock:
            _initialized = False
            _init_error = None
        _initialize()
    if _agent is None:
        return {"success": False, "error": _init_error or "Agent RAG non initialisé."}
    try:
        report = _agent.reload()
    except Exception as exc:
        logger.exception("RAG: échec du rechargement de l'index")
        return {"success": False, "error": str(exc)}
    with _lock:
        _index_report = report
        _init_error = None
        _initialized = True
    return {"success": True, **report}


def list_rag_documents() -> list[dict]:
    departments_by_key = {department["key"]: department["name"] for department in DEPARTMENTS}
    return [
        {
            "id": document["id"],
            "file_name": document["file_name"],
            "dept_key": document["dept_key"],
            "department": departments_by_key[document["dept_key"]],
            "updated_at": document["updated_at"],
            "download_url": f"/api/rag/documents/{document['id']}/file",
        }
        for document in list_documents()
    ]


def rag_document_path(document_id: int):
    return next(
        (
            document["path"]
            for document in list_documents()
            if document["id"] == document_id
        ),
        None,
    )
