Ce dossier contient les PDF de connaissances utilisés par l'assistant RAG.

Les fichiers sont indexés selon leur préfixe numérique, qui relie le document à
un département (01 = Général, 02 = Cycle préparatoire, ..., 11 = 2I2S).
Ajoutez ou remplacez les PDF dans ce dossier, puis demandez à un administrateur
de recharger l'index depuis le tableau de bord. Chaque PDF doit contenir des
sections au format [IIT-001] Titre, avec une ligne de métadonnées et une date
de collecte, comme les documents fournis.

Le dossier peut être configuré avec RAG_DATA_DIR. Ollama doit être accessible
via OLLAMA_URL et disposer des modèles définis par RAG_LLM_MODEL et
RAG_EMBED_MODEL.
