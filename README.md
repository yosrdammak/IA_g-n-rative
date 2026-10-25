# SmartCampus AI — frontend React et backend FastAPI

Application d’orientation universitaire : inscription, connexion, profil candidat, catalogue de formations, recommandations, préinscriptions, assistant et tableau de bord du personnel.

## 1. Lancer avec Docker (recommandé)

Prérequis : Docker Desktop démarré (Windows/macOS) ou Docker Engine avec Docker Compose v2.24+. Exécuter les commandes dans le dossier contenant ce README et `docker-compose.yml`.

Créer la configuration :

```bash
# Linux / macOS
cp .env.example .env
```

```powershell
# Windows PowerShell
Copy-Item .env.example .env
```

Puis, sur tous les systèmes :

```bash
docker compose up --build -d
```

Le lancement attend PostgreSQL, applique les migrations Alembic, charge les données de démonstration si `SEED_DEMO=true`, puis démarre le backend et le frontend.

| Service | Adresse |
| --- | --- |
| Frontend | http://localhost:5174 |
| API FastAPI | http://localhost:8001 |
| Documentation interactive Swagger | http://localhost:8001/docs |
| Vérification API/base | http://localhost:8001/health |
| PostgreSQL, depuis la machine hôte | localhost:5433 |

Le navigateur appelle `/api` sur le frontend ; Vite transmet ces requêtes au backend. Il n’est donc pas nécessaire de coder une adresse IP dans le frontend.

### Comptes de démonstration

Disponibles si `SEED_DEMO=true` (valeur par défaut du Compose) :

| Rôle | Email | Mot de passe par défaut |
| --- | --- | --- |
| Candidat | candidat@demo.tn | DemoCampus2026! |
| Administrateur | admin@demo.tn | DemoCampus2026! |

`DEMO_PASSWORD` permet de définir le mot de passe lors de la **création** de ces comptes. Le chargement est idempotent : un redémarrage ne réinitialise pas les comptes existants. Un mot de passe arbitraire n’est pas accepté.

Les quatre formations portant `[Démo]` sont des exemples pédagogiques, pas un catalogue officiel IIT/ISB. Créer un compte personnel reste possible depuis « Commencer ».

### Commandes utiles

```bash
docker compose ps
docker compose logs -f backend
docker compose logs -f frontend
docker compose down
```

`down` conserve les données PostgreSQL. Après modification du code ou des dépendances, relancer `docker compose up --build -d`. Si les dépendances frontend changent, lancer aussi `docker compose exec frontend npm ci` pour actualiser le volume `node_modules`.

Le fichier `frontend/docker-compose.yml` redirige vers la même configuration. Utiliser de préférence le fichier à la racine.

## 2. Activer les réponses génératives avec Ollama (optionnel)

Par défaut, `CHAT_PROVIDER=catalogue` fournit des réponses déterministes à partir des formations publiées et des indications de candidature. Aucune clé API ni téléchargement de modèle n’est requis.

Pour utiliser un LLM local :

1. Dans le `.env` à la racine, mettre `CHAT_PROVIDER=ollama`.
2. Démarrer les services, puis télécharger le modèle :

```bash
docker compose --profile ai up --build -d
docker compose exec ollama ollama pull llama3.2:3b
```

`OLLAMA_MODEL` permet de sélectionner un autre modèle ; télécharger alors exactement le même nom avec `ollama pull`. Prévoir l’espace disque et la mémoire nécessaires au modèle choisi. Le téléchargement nécessite Internet et le premier chargement peut être lent ; ajuster `OLLAMA_TIMEOUT` si besoin.

Le backend transmet au modèle les formations sélectionnées par mots-clés et les dix derniers messages de la conversation. Il utilise `POST /api/chat` d’Ollama avec `stream=false` : [documentation Ollama](https://github.com/ollama/ollama/blob/main/docs/api.md#generate-a-chat-completion). Si Ollama est indisponible ou renvoie une réponse invalide, le backend fournit une réponse du catalogue, explicitement signalée comme telle.

Pour revenir au mode sans LLM, remettre `CHAT_PROVIDER=catalogue` puis relancer `docker compose up -d backend`. Le service Ollama peut être arrêté avec `docker compose --profile ai stop ollama`.

## 3. Lancer sans Docker

Prérequis : Python 3.11 ou 3.12 et Node.js 22.12+ (ou 24). SQLite est utilisé par défaut ; PostgreSQL reste utilisé dans Docker.

### Terminal 1 — backend

```bash
cd backend
python -m venv .venv
```

Activer l’environnement :

```bash
# Linux / macOS
source .venv/bin/activate
cp .env.example .env
```

```powershell
# Windows PowerShell
.\.venv\Scripts\Activate.ps1
Copy-Item .env.example .env
```

Puis :

```bash
python -m pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

Le fichier `backend/.env` est chargé automatiquement. SQLite crée `backend/smartcampus.db`. Le fichier de base de données livré avec l’ancien prototype est exclu de cette version afin de démarrer avec les migrations et des données identifiables.

Pour employer le PostgreSQL du Compose, démarrer `docker compose up -d postgres` depuis la racine et renseigner dans `backend/.env` :

```dotenv
DATABASE_URL=postgresql://smartuser:smartpassword@localhost:5433/smartcampus_DB
```

Adapter le mot de passe à la configuration choisie et réexécuter `alembic upgrade head` avant de lancer l’API.

### Terminal 2 — frontend

```bash
cd frontend
npm ci
npm run dev
```

Ouvrir http://localhost:5173. Le proxy cible `http://localhost:8001` par défaut. Pour le modifier, copier `frontend/.env.example` vers `frontend/.env`, changer `API_PROXY_TARGET` puis redémarrer Vite. `VITE_API_URL` reste vide avec le proxy ; il peut contenir l’URL publique du backend pour un hébergement séparé (configurer alors CORS).

## 4. Données et administration

Le schéma est versionné dans `backend/alembic/versions`. Le backend ne crée plus implicitement les tables au démarrage.

- Les migrations peuvent reprendre les tables du prototype d’origine sans supprimer les données. Si plusieurs candidatures existent pour un même couple candidat/formation, la migration s’arrête avec un message : sauvegarder la base et résoudre ces doublons avant de relancer.
- `SEED_DEMO=false` empêche de créer les exemples ; cela ne supprime pas les données déjà créées.
- Pour créer un administrateur personnel sans comptes de démonstration :

```bash
docker compose exec backend python -m app.cli create-admin --email admin@example.tn --name "Administrateur"
```

Sans Docker, exécuter `python -m app.cli create-admin --email admin@example.tn --name "Administrateur"` dans `backend`, environnement Python activé. Le mot de passe est demandé sans être affiché.

Pour gérer le catalogue via Swagger : appeler `/api/auth/login`, copier `access_token`, cliquer sur **Authorize** et saisir le jeton. Utiliser ensuite `GET/POST /api/admin/programs` et `PUT /api/admin/programs/{id}`. `published=false` masque une formation aux candidats. Le rôle candidat ne peut pas gérer le catalogue ; les responsables `academic_iit` et `academic_isb` sont limités à leur établissement.

Le tableau de bord administrateur existant reste accessible en se connectant avec un compte personnel. L’inscription publique crée uniquement des candidats ; elle ne permet pas de choisir un rôle de personnel.

## 5. Contrat API utilisé par le frontend

Toutes les routes privées utilisent `Authorization: Bearer <access_token>`.

| Méthode | Route | Utilisation |
| --- | --- | --- |
| POST | `/api/auth/register` | Créer un compte et recevoir une session |
| POST | `/api/auth/login` | Recevoir `{access_token, token_type, user}` |
| GET | `/api/auth/me` | Lire l’identité connectée |
| GET | `/api/programs` | Formations publiées, route publique |
| GET / PUT | `/api/profile` | Niveau, intérêts, objectifs et langue |
| GET | `/api/recommendations` | `{recommendations: [{program, matching_keywords, score}]}` |
| GET / POST | `/api/applications` | Lister ou créer ses candidatures |
| GET | `/api/conversations` | Historique personnel |
| POST | `/api/chat` | `{message, conversation_id?}` → `{reply, conversation_id, mode}` |
| GET | `/api/dashboard` | Candidatures et statistiques, réservé au personnel |
| GET / POST | `/api/admin/programs` | Catalogue administratif |
| PUT | `/api/admin/programs/{id}` | Modifier ou dépublier une formation |
| POST | `/api/applications/{id}/quiz` | Créer/lire un QCM de démonstration |
| POST | `/api/quizzes/{id}/submit` | Envoyer `{answers: [0, 1, 0]}` |
| POST | `/api/applications/{id}/appointment` | Demander un rendez-vous avec `{scheduled_at: "2027-02-01T10:00:00+01:00"}` |

Les QCM et demandes de rendez-vous sont disponibles via l’API ; le frontend actuel ne comporte pas leurs formulaires. Le dépôt de documents et le bouton d’export CSV affichés ou évoqués dans la maquette ne sont pas implémentés. Aucune réservation officielle n’est effectuée.

Les recommandations utilisent un classement lexical avec normalisation des accents. `score` est le nombre de mots-clés communs, affiché comme tel dans l’interface ; ce n’est pas un pourcentage de probabilité d’admission. Il n’y a pas d’embeddings ni de recherche vectorielle à ce stade ; l’image PostgreSQL avec pgvector est conservée pour compatibilité avec le projet d’origine. Les réponses génératives restent à vérifier, notamment avec un catalogue incomplet.

## 6. Vérifier le projet

Dans `backend`, environnement Python activé :

```bash
python -m pip install -r requirements-dev.txt
python -m pytest -q
alembic check
```

Les tests API utilisent une base SQLite temporaire isolée : authentification, validation, profils, recommandations, isolation des données, candidatures, rôles, publication du catalogue, chat et historique, protocole Ollama simulé et repli, QCM, rendez-vous, CORS et initialisation idempotente. Ils ne téléchargent pas de modèle.

Dans `frontend` :

```bash
npm run build
npm run lint
```

## 7. Dépannage et limites de lancement

- **Port occupé** : modifier les ports hôte dans `docker-compose.yml`. Si le port du frontend change, ajuster aussi `CORS_ORIGINS` pour les appels directs.
- **API inaccessible** : consulter `docker compose ps` puis `docker compose logs backend`. Vérifier les migrations et l’état de PostgreSQL.
- **Identifiants démo refusés** : vérifier `SEED_DEMO` et le mot de passe utilisé à la création. Changer `DEMO_PASSWORD` après coup ne réinitialise pas le compte.
- **Base PostgreSQL existante** : modifier `POSTGRES_PASSWORD` ne change pas le mot de passe d’une base déjà initialisée. Conserver les identifiants existants ou effectuer une rotation dans PostgreSQL.
- **Changement de configuration** : relancer `docker compose up -d`. Le Compose lit le `.env` racine, le lancement Python lit `backend/.env`.
- **Build frontend** : le projet nécessite une version récente de Node ; le Dockerfile utilise Node 22.

Cette configuration sert au développement local (serveur Vite, comptes de démonstration, secrets d’exemple). Pour un déploiement public, fournir des secrets uniques, désactiver et retirer les comptes de démonstration existants, servir le build frontend avec un serveur adapté, configurer HTTPS, sauvegardes et protection contre les requêtes abusives.

Validation réalisée pour cette version : 14 tests API réussis sous SQLite, compilation et lint frontend réussis, reprise de l’ancienne base vérifiée sans perte de lignes, et appels réels via le proxy Vite vérifiés. Le SQL des migrations PostgreSQL est généré correctement ; le lancement des conteneurs et l’inférence d’un modèle Ollama réel n’ont pas pu être exécutés dans l’environnement de préparation.
