"""
SmartCampus RAG Service
========================
Pipeline : PDF → chunks [IIT-nnn] → embeddings (bge-m3 via Ollama) → ChromaDB
           → question → top-K chunks → réponse via llama3.2:3b (Ollama)

Variables d'environnement utilisées (toutes optionnelles, valeurs par défaut ci-dessous) :
  RAG_PDF_PATH    - chemin du PDF source (relatif au dossier backend)
  RAG_CHROMA_PATH - dossier de la base vectorielle ChromaDB
  RAG_LLM_MODEL   - modèle de génération  (défaut : llama3.2:3b)
  RAG_EMBED_MODEL  - modèle d'embeddings  (défaut : bge-m3)
  RAG_TOP_K        - nombre de chunks récupérés par requête (défaut : 5)
  OLLAMA_URL       - URL du serveur Ollama (défaut : http://localhost:11434)
"""

from __future__ import annotations

import logging
import os
import re
from pathlib import Path
from threading import Lock
from typing import Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration via variables d'environnement
# ---------------------------------------------------------------------------
_BASE_DIR = Path(__file__).resolve().parents[1]

RAG_PDF_PATH: str = os.getenv(
    "RAG_PDF_PATH",
    str(_BASE_DIR / "data" / "IIT_Sfax_Base_de_connaissances_RAG.pdf"),
)
RAG_CHROMA_PATH: str = os.getenv(
    "RAG_CHROMA_PATH",
    str(_BASE_DIR / "chroma_smartcampus"),
)
RAG_LLM_MODEL: str = os.getenv("RAG_LLM_MODEL", "llama3.2:3b")
RAG_EMBED_MODEL: str = os.getenv("RAG_EMBED_MODEL", "bge-m3")
RAG_TOP_K: int = int(os.getenv("RAG_TOP_K", "5"))

# ---------------------------------------------------------------------------
# Lazy-loaded singletons (chargés au premier appel de rag_answer)
# ---------------------------------------------------------------------------
_lock = Lock()
_vectorstore = None   # instance Chroma
_llm = None           # instance OllamaLLM
_embeddings = None    # instance OllamaEmbeddings
_initialized = False
_init_error: Optional[str] = None


def _load_pdf_text(pdf_path: str) -> str:
    """Lit le PDF et retourne le texte nettoyé."""
    try:
        from langchain_community.document_loaders import PyPDFLoader  # type: ignore
    except ImportError as e:
        raise RuntimeError(
            "Paquet 'langchain-community' manquant. "
            "Lancez : pip install langchain-community pypdf"
        ) from e

    pages = PyPDFLoader(pdf_path).load()
    logger.info("RAG: %d pages chargées depuis %s", len(pages), pdf_path)

    texte = "\n".join(page.page_content for page in pages)
    # Nettoyage 1 : pied de page répété
    texte = re.sub(
        r"^IIT Sfax — base de connaissances RAG.*page \d+ / \d+\s*$",
        "",
        texte,
        flags=re.M,
    )
    # Nettoyage 2 : titres de groupes (ex. "1. Présentation de l'institut")
    texte = re.sub(r"^\d{1,2}\. [A-ZÉ][^\n]{0,90}$", "", texte, flags=re.M)
    return texte


def _split_by_section(texte: str):
    """Découpe le texte brut en Documents LangChain (1 doc = 1 section [IIT-nnn])."""
    try:
        from langchain_core.documents import Document  # type: ignore
    except ImportError as e:
        raise RuntimeError("Paquet 'langchain-core' manquant.") from e

    morceaux = re.split(r"(?=^\[IIT-\d{3}\] )", texte, flags=re.M)[1:]
    chunks: list[Document] = []
    for morceau in morceaux:
        m = re.match(
            r"\[(IIT-\d{3})\] (.+?)\n(.*?Date\s+de\s+collecte\s*:\s*\d{4}-\d{2}-\d{2})\n(.*)",
            morceau,
            flags=re.S,
        )
        if not m:
            continue
        section_id, titre, ligne_meta, corps = m.groups()
        ligne_meta = re.sub(r"\s+", " ", ligne_meta)
        try:
            champs = dict(x.split(" : ", 1) for x in ligne_meta.split(" | "))
        except ValueError:
            champs = {}
        corps_propre = re.sub(r"\s+", " ", corps).strip()
        contenu = f"{titre}\n{corps_propre}"
        chunks.append(
            Document(
                page_content=contenu,
                metadata={
                    "id": section_id,
                    "titre": titre,
                    "categorie": champs.get("Catégorie", ""),
                    "niveau": champs.get("Niveau", ""),
                    "source": champs.get("Source", ""),
                },
            )
        )
    logger.info("RAG: %d chunks créés", len(chunks))
    return chunks


def _build_or_load_vectorstore(chroma_path: str, embed_model: str, pdf_path: str):
    """Charge ou construit la base vectorielle ChromaDB."""
    try:
        from langchain_chroma import Chroma  # type: ignore
        from langchain_ollama import OllamaEmbeddings  # type: ignore
    except ImportError as e:
        raise RuntimeError(
            "Paquets manquants. Lancez :\n"
            "pip install langchain-chroma langchain-ollama chromadb"
        ) from e

    embeddings = OllamaEmbeddings(
        model=embed_model,
        base_url=os.getenv("OLLAMA_URL", "http://localhost:11434"),
    )

    chroma_dir = Path(chroma_path)

    # Si la base existe déjà et que le PDF source est disponible, on la charge
    if chroma_dir.exists() and any(chroma_dir.iterdir()):
        logger.info("RAG: Chargement de la base vectorielle existante : %s", chroma_path)
        vectorstore = Chroma(
            persist_directory=chroma_path,
            embedding_function=embeddings,
        )
        return vectorstore, embeddings

    # Sinon on (re)crée la base depuis le PDF
    if not Path(pdf_path).exists():
        raise FileNotFoundError(
            f"PDF introuvable : {pdf_path}\n"
            "Copiez le fichier IIT_Sfax_Base_de_connaissances_RAG.pdf dans "
            f"{Path(pdf_path).parent}/"
        )

    logger.info("RAG: Construction de la base vectorielle...")
    texte = _load_pdf_text(pdf_path)
    chunks = _split_by_section(texte)
    if not chunks:
        raise ValueError("Aucun chunk extrait du PDF. Vérifiez le format du document.")

    vectorstore = Chroma.from_documents(
        documents=chunks,
        embedding=embeddings,
        persist_directory=chroma_path,
        ids=[c.metadata["id"] for c in chunks],
    )
    logger.info("RAG: Base vectorielle créée dans %s", chroma_path)
    return vectorstore, embeddings


def _get_llm(llm_model: str):
    """Retourne une instance OllamaLLM."""
    try:
        from langchain_ollama import OllamaLLM  # type: ignore
    except ImportError as e:
        raise RuntimeError("Paquet 'langchain-ollama' manquant.") from e

    return OllamaLLM(
        model=llm_model,
        base_url=os.getenv("OLLAMA_URL", "http://localhost:11434"),
        temperature=0.2,
        num_predict=512,
    )


def _initialize() -> None:
    """Initialise (une seule fois) le vectorstore et le LLM."""
    global _vectorstore, _llm, _embeddings, _initialized, _init_error
    with _lock:
        if _initialized:
            return
        try:
            _vectorstore, _embeddings = _build_or_load_vectorstore(
                RAG_CHROMA_PATH, RAG_EMBED_MODEL, RAG_PDF_PATH
            )
            _llm = _get_llm(RAG_LLM_MODEL)
            _initialized = True
            logger.info("RAG: Initialisation réussie.")
        except Exception as exc:
            _init_error = str(exc)
            _initialized = True  # évite de réessayer indéfiniment
            logger.error("RAG: Échec de l'initialisation : %s", exc)


# ---------------------------------------------------------------------------
# Point d'entrée public
# ---------------------------------------------------------------------------

def rag_answer(question: str, language: str = "fr") -> dict:
    """
    Répond à une question via le pipeline RAG (ChromaDB + Ollama).

    Returns
    -------
    dict avec les clés :
      - reply   : str  — réponse en langue naturelle
      - sources : list[dict]  — chunks utilisés (id, titre, source, extrait)
      - mode    : str  — "rag" | "rag_error"
    """
    _initialize()

    if _init_error and _vectorstore is None:
        return {
            "reply": (
                f"Le service RAG n'est pas disponible : {_init_error}\n\n"
                "Vérifiez qu'Ollama tourne (`ollama serve`) et que le PDF source est présent."
            ),
            "sources": [],
            "mode": "rag_error",
        }

    # 1. Recherche sémantique
    try:
        docs = _vectorstore.similarity_search(question, k=RAG_TOP_K)
    except Exception as exc:
        logger.error("RAG: Erreur lors de la recherche vectorielle : %s", exc)
        return {
            "reply": "Erreur lors de la recherche dans la base de connaissances.",
            "sources": [],
            "mode": "rag_error",
        }

    if not docs:
        return {
            "reply": "Je n'ai trouvé aucune information pertinente dans la base de connaissances de l'IIT Sfax pour cette question.",
            "sources": [],
            "mode": "rag",
        }

    # 2. Construction du contexte
    context_parts = []
    for doc in docs:
        meta = doc.metadata
        context_parts.append(
            f"[{meta.get('id', '')}] {meta.get('titre', '')}\n{doc.page_content}"
        )
    context = "\n\n---\n\n".join(context_parts)

    # 3. Prompt
    lang_instruction = (
        "Réponds en français."
        if language == "fr"
        else "Answer in English."
        if language == "en"
        else "Réponds dans la langue de la question."
    )
    prompt = f"""Tu es SmartCampus, l'assistant IA officiel de l'IIT Sfax (Institut International de Technologie).
Tu dois répondre uniquement à partir des extraits de la base de connaissances fournis ci-dessous.
Si la réponse n'est pas dans les extraits, dis-le clairement et propose de contacter les admissions (info@iit.tn).
Ne fabrique pas d'informations. {lang_instruction}

EXTRAITS DE LA BASE DE CONNAISSANCES :
{context}

QUESTION : {question}

RÉPONSE :"""

    # 4. Génération
    try:
        reply = _llm.invoke(prompt)
        if not reply or not reply.strip():
            raise ValueError("Réponse vide du LLM")
    except Exception as exc:
        logger.error("RAG: Erreur LLM : %s", exc)
        return {
            "reply": (
                "Le modèle de langage n'a pas pu générer une réponse. "
                "Vérifiez qu'Ollama tourne et que le modèle est téléchargé.\n"
                f"Erreur : {exc}"
            ),
            "sources": [],
            "mode": "rag_error",
        }

    # 5. Construction des sources citées
    sources = [
        {
            "id": doc.metadata.get("id", ""),
            "titre": doc.metadata.get("titre", ""),
            "categorie": doc.metadata.get("categorie", ""),
            "source_url": doc.metadata.get("source", ""),
            "extrait": doc.page_content[:200] + ("…" if len(doc.page_content) > 200 else ""),
        }
        for doc in docs
    ]

    return {
        "reply": reply.strip(),
        "sources": sources,
        "mode": "rag",
    }


def is_rag_available() -> bool:
    """Renvoie True si le vectorstore est chargé et le LLM accessible."""
    _initialize()
    return _initialized and _vectorstore is not None and _init_error is None


def rebuild_index() -> dict:
    """Force la reconstruction de la base vectorielle depuis le PDF source."""
    global _vectorstore, _embeddings, _initialized, _init_error
    import shutil

    with _lock:
        chroma_dir = Path(RAG_CHROMA_PATH)
        if chroma_dir.exists():
            shutil.rmtree(chroma_dir)
            logger.info("RAG: Index supprimé, reconstruction en cours...")
        _vectorstore = None
        _embeddings = None
        _initialized = False
        _init_error = None

    _initialize()
    if _init_error:
        return {"success": False, "error": _init_error}
    return {"success": True, "chroma_path": RAG_CHROMA_PATH}
