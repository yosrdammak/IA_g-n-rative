import os
import re
from datetime import datetime, timezone
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from .config import CORS_ORIGINS
from .seed import seed_demo
from .services import (
    chat_reply,
    rank_by_compatibility,
    BAC_SECTIONS,
    SUBJECTS,
    SECTION_SUBJECTS,
)
from pydantic import BaseModel, Field, ConfigDict
from typing import Annotated, Literal, Optional
from .database import get_db, SessionLocal
from .models import (
    User,
    Program,
    Profile,
    Conversation,
    Message,
    Application,
    Quiz,
    Appointment,
)
from .security import hash_password, verify_password, token, current_user, staff


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Schema is managed by Alembic (see README and Docker CMD).
    if os.getenv("SEED_DEMO", "false").lower() == "true":
        with SessionLocal() as db:
            seed_demo(db)
    yield


app = FastAPI(title="SmartCampus AI API", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.exception_handler(RequestValidationError)
async def validation_error(request, exc):
    # The frontend displays detail as a string; never echo passwords from input.
    details = "; ".join(
        ".".join(str(p) for p in error["loc"][1:]) + ": " + error["msg"]
        for error in exc.errors()
    )
    return JSONResponse(
        status_code=422, content={"detail": "Données invalides : " + details}
    )


class InputModel(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")


class Register(InputModel):
    email: str = Field(min_length=5, max_length=255)
    full_name: str = Field(min_length=2, max_length=150)
    password: str = Field(min_length=8, max_length=128)
    model_config = ConfigDict(str_strip_whitespace=False, extra="forbid")


class Login(InputModel):
    email: str
    password: str
    model_config = ConfigDict(str_strip_whitespace=False, extra="forbid")


BacSection = Literal[tuple(BAC_SECTIONS)]
Subject = Literal[tuple(SUBJECTS)]
Grade = Annotated[float, Field(ge=0, le=20)]


LEARNING_STYLES = {
    "pratique": "Plutôt pratique (projets, stages, technologie appliquée)",
    "theorique": "Plutôt théorique (fondamentaux, sciences, recherche)",
    "mixte": "Équilibré (théorie et pratique)",
}
CAMPUSES = [
    {"value": "Campus El Ons", "label": "Campus El Ons (IIT)"},
    {"value": "Campus Mharza", "label": "Campus Mharza (IIT)"},
    {"value": "Campus El OnsISB", "label": "Campus El Ons (ISB)"},
]
CITIES = ["Campus El Ons", "Campus Mharza", "Campus El OnsISB", "Sfax", "Tunis"]
POPULAR_INTERESTS = [
    {"id": "ai_data", "label": "Intelligence Artificielle & Data", "icon": "🤖"},
    {"id": "software_web", "label": "Génie Logiciel & Web", "icon": "💻"},
    {"id": "cybersecurity", "label": "Cybersécurité & Réseaux", "icon": "🔒"},
    {"id": "cloud_devops", "label": "Cloud & DevOps", "icon": "☁️"},
    {"id": "embedded_iot", "label": "Systèmes Embarqués & IoT", "icon": "⚙️"},
    {"id": "management", "label": "Management & Entrepreneuriat", "icon": "📈"},
    {"id": "finance", "label": "Finance & Banque", "icon": "📊"},
    {"id": "marketing", "label": "Marketing Digital & Business", "icon": "🎯"},
    {"id": "math_physics", "label": "Mathématiques & Sciences", "icon": "📐"},
    {"id": "commerce", "label": "Commerce International", "icon": "🌐"},
]


class ProfileIn(InputModel):
    academic_level: str = Field(default="", max_length=120)
    interests: str = Field(default="", max_length=1000)
    goals: str = Field(default="", max_length=1000)
    preferred_language: str = "fr"
    bac_section: Optional[BacSection] = None
    bac_year: Optional[int] = Field(default=None, ge=1980)
    bac_average: Optional[Grade] = None
    subject_grades: dict[Subject, Grade] = Field(default_factory=dict)
    max_budget: Optional[float] = Field(default=None, ge=0)
    study_duration: Optional[int] = Field(default=None, ge=1, le=10)
    city: Optional[str] = Field(default=None, max_length=80)
    learning_style: Optional[str] = Field(default=None, max_length=40)
    optional_subject_name: Optional[str] = Field(default=None, max_length=80)


class ChatIn(InputModel):
    message: str = Field(min_length=1, max_length=3000)
    conversation_id: Optional[int] = None


class ApplicationIn(InputModel):
    program_id: int
    phone: str = Field(min_length=6, max_length=30)
    consent: bool


class AnswersIn(InputModel):
    answers: list[int]


class AppointmentIn(InputModel):
    scheduled_at: datetime


def user_out(u):
    return {"id": u.id, "email": u.email, "full_name": u.full_name, "role": u.role}


PROFILE_FIELDS = (
    "academic_level",
    "interests",
    "goals",
    "preferred_language",
    "bac_section",
    "bac_year",
    "bac_average",
    "subject_grades",
    "max_budget",
    "study_duration",
    "city",
    "learning_style",
    "optional_subject_name",
)


def program_out(x):
    data = {
        k: getattr(x, k)
        for k in (
            "id",
            "name",
            "institution",
            "category",
            "description",
            "prerequisites",
            "outcomes",
            "published",
            "min_average",
            "annual_tuition",
            "duration_years",
            "city",
            "learning_style",
        )
    }
    data["accepted_bac_sections"] = x.accepted_bac_sections or []
    data["key_subjects"] = x.key_subjects or []
    return data


def application_out(a):
    return {
        "id": a.id,
        "program_id": a.program_id,
        "user_id": a.user_id,
        "status": a.status,
        "phone": a.phone,
        "created_at": a.created_at.isoformat() if a.created_at else None,
    }


def owned(db, model, id, user, key="user_id"):
    obj = db.get(model, id)
    if not obj or getattr(obj, key) != user.id:
        raise HTTPException(404, "Ressource introuvable")
    return obj


def ensure_profile(db, user):
    profile = db.query(Profile).filter_by(user_id=user.id).first()
    if profile is None:
        profile = Profile(
            user_id=user.id,
            academic_level="",
            interests="",
            goals="",
            preferred_language="fr",
        )
        db.add(profile)
        db.commit()
    return profile


@app.get("/health")
def health(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"status": "ok", "chat_provider": os.getenv("CHAT_PROVIDER", "catalogue")}


@app.get("/")
def root():
    return {"status": "SmartCampus Backend is running!", "docs": "/docs"}


@app.post("/api/auth/register", status_code=201)
def register(v: Register, db: Session = Depends(get_db)):
    email = v.email.strip().lower()
    if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email):
        raise HTTPException(422, "Adresse email invalide")
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(409, "Email déjà utilisé")
    if len(v.full_name.strip()) < 2:
        raise HTTPException(422, "Nom complet invalide")
    u = User(
        email=email,
        full_name=v.full_name.strip(),
        password_hash=hash_password(v.password),
        role="candidate",
    )
    db.add(u)
    try:
        db.flush()
        db.add(Profile(user_id=u.id))
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Email déjà utilisé")
    db.refresh(u)
    return {"access_token": token(u), "token_type": "bearer", "user": user_out(u)}


@app.post("/api/auth/login")
def login(v: Login, db: Session = Depends(get_db)):
    u = db.query(User).filter(User.email == v.email.strip().lower()).first()
    if not u or not verify_password(v.password, u.password_hash):
        raise HTTPException(401, "Identifiants incorrects")
    return {"access_token": token(u), "token_type": "bearer", "user": user_out(u)}


@app.get("/api/auth/me")
def me(u: User = Depends(current_user)):
    return user_out(u)


@app.get("/api/programs")
def programs(db: Session = Depends(get_db)):
    return [
        program_out(x)
        for x in db.query(Program)
        .filter(Program.published.is_(True))
        .order_by(Program.name)
        .all()
    ]


@app.get("/api/profile")
def get_profile(u: User = Depends(current_user), db: Session = Depends(get_db)):
    p = ensure_profile(db, u)
    data = {k: getattr(p, k) for k in PROFILE_FIELDS}
    data["subject_grades"] = p.subject_grades or {}
    return data


@app.get("/api/profile/options")
def profile_options():
    return {
        "bac_sections": [{"value": k, "label": v} for k, v in BAC_SECTIONS.items()],
        "subjects": [{"value": k, "label": v} for k, v in SUBJECTS.items()],
        "section_subjects": SECTION_SUBJECTS,
        "learning_styles": [{"value": k, "label": v} for k, v in LEARNING_STYLES.items()],
        "campuses": CAMPUSES,
        "cities": CITIES,
        "popular_interests": POPULAR_INTERESTS,
    }


@app.put("/api/profile")
def update_profile(
    v: ProfileIn, u: User = Depends(current_user), db: Session = Depends(get_db)
):
    p = ensure_profile(db, u)
    if v.preferred_language not in ("fr", "en"):
        raise HTTPException(422, "Langue non prise en charge")
    if v.bac_year is not None and v.bac_year > datetime.now(timezone.utc).year + 1:
        raise HTTPException(422, "Année du bac invalide")
    data = v.model_dump()
    if data["bac_average"] is not None:
        data["bac_average"] = round(data["bac_average"], 2)
    data["subject_grades"] = {k: round(g, 2) for k, g in v.subject_grades.items()}
    for field, value in data.items():
        setattr(p, field, value)
    db.commit()
    return {"message": "Profil mis à jour"}


@app.get("/api/recommendations")
def recommendations(u: User = Depends(current_user), db: Session = Depends(get_db)):
    p = ensure_profile(db, u)
    ranked = rank_by_compatibility(
        db.query(Program).filter_by(published=True).all(), p
    )
    missing = [
        label
        for label, value in (
            ("section du bac", p.bac_section),
            ("moyenne du bac", p.bac_average),
            ("notes par matière", p.subject_grades),
        )
        if not value
    ]
    return {
        "method": "compatibility",
        "disclaimer": "Compatibilité indicative (intérêts, section, moyenne et notes). Les seuils sont indicatifs ; seule l’administration décide de l’admission.",
        "missing_profile_fields": missing,
        "recommendations": [
            {"program": program_out(pr), **c} for pr, c in ranked if c["eligible"]
        ][:3],
        "excluded": [
            {"program": program_out(pr), "reasons": c["ineligibility_reasons"]}
            for pr, c in ranked
            if not c["eligible"]
        ],
    }


@app.get("/api/conversations")
def conversations(u: User = Depends(current_user), db: Session = Depends(get_db)):
    result = []
    for c in (
        db.query(Conversation)
        .filter_by(user_id=u.id)
        .order_by(Conversation.id.desc())
        .all()
    ):
        msgs = (
            db.query(Message).filter_by(conversation_id=c.id).order_by(Message.id).all()
        )
        result.append(
            {
                "id": c.id,
                "messages": [{"sender": m.sender, "text": m.text} for m in msgs],
            }
        )
    return result


@app.post("/api/chat")
def chat(v: ChatIn, u: User = Depends(current_user), db: Session = Depends(get_db)):
    c = (
        owned(db, Conversation, v.conversation_id, u)
        if v.conversation_id
        else Conversation(user_id=u.id)
    )
    if c.id is None:
        db.add(c)
        db.flush()
    history = (
        db.query(Message)
        .filter_by(conversation_id=c.id)
        .order_by(Message.id.desc())
        .limit(10)
        .all()[::-1]
    )
    programs = db.query(Program).filter_by(published=True).order_by(Program.id).all()
    reply, mode = chat_reply(v.message, history, programs, ensure_profile(db, u))
    db.add(Message(conversation_id=c.id, sender="user", text=v.message))
    db.add(Message(conversation_id=c.id, sender="assistant", text=reply))
    db.commit()
    return {"conversation_id": c.id, "reply": reply, "mode": mode}


@app.post("/api/applications", status_code=201)
def apply(
    v: ApplicationIn, u: User = Depends(current_user), db: Session = Depends(get_db)
):
    if not v.consent:
        raise HTTPException(422, "Consentement requis")
    pr = db.get(Program, v.program_id)
    if not pr or not pr.published:
        raise HTTPException(404, "Formation indisponible")
    if db.query(Application).filter_by(user_id=u.id, program_id=pr.id).first():
        raise HTTPException(409, "Vous avez déjà candidaté à cette formation")
    a = Application(user_id=u.id, program_id=pr.id, phone=v.phone, consent=True)
    db.add(a)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Vous avez déjà candidaté à cette formation")
    db.refresh(a)
    return application_out(a)


@app.get("/api/applications")
def my_applications(u: User = Depends(current_user), db: Session = Depends(get_db)):
    return [
        application_out(a)
        for a in db.query(Application)
        .filter_by(user_id=u.id)
        .order_by(Application.id.desc())
        .all()
    ]


# Illustrative quiz only: never present it as an official IIT/ISB assessment.
QUESTIONS = [
    {
        "question": "Une bonne orientation doit-elle vérifier les prérequis ?",
        "options": ["Oui", "Non"],
        "answer": 0,
    },
    {
        "question": "Quel acteur valide une décision académique officielle ?",
        "options": ["Le chatbot seul", "Le responsable habilité"],
        "answer": 1,
    },
    {
        "question": "Peut-on modifier les informations de son profil ?",
        "options": ["Oui", "Non"],
        "answer": 0,
    },
]


@app.post("/api/applications/{application_id}/quiz")
def create_quiz(
    application_id: int, u: User = Depends(current_user), db: Session = Depends(get_db)
):
    owned(db, Application, application_id, u)
    q = db.query(Quiz).filter_by(application_id=application_id).first()
    if not q:
        q = Quiz(application_id=application_id, questions=QUESTIONS)
        db.add(q)
        db.commit()
        db.refresh(q)
    return {
        "id": q.id,
        "questions": [
            {"question": x["question"], "options": x["options"]} for x in q.questions
        ],
        "score": q.score,
    }


@app.post("/api/quizzes/{quiz_id}/submit")
def submit_quiz(
    quiz_id: int,
    v: AnswersIn,
    u: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    q = db.get(Quiz, quiz_id)
    if not q:
        raise HTTPException(404, "QCM introuvable")
    owned(db, Application, q.application_id, u)
    if q.score is not None:
        raise HTTPException(409, "QCM déjà soumis")
    if len(v.answers) != len(q.questions) or any(
        not isinstance(a, int) or a < 0 or a >= len(q.questions[i]["options"])
        for i, a in enumerate(v.answers)
    ):
        raise HTTPException(422, "Réponses invalides")
    q.answers = v.answers
    q.score = sum(a == q.questions[i]["answer"] for i, a in enumerate(v.answers))
    db.commit()
    return {
        "score": q.score,
        "total": len(q.questions),
        "note": "QCM de démonstration uniquement",
    }


@app.post("/api/applications/{application_id}/appointment")
def request_appointment(
    application_id: int,
    v: AppointmentIn,
    u: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    owned(db, Application, application_id, u)
    when = v.scheduled_at
    if when.tzinfo is None:
        raise HTTPException(422, "Fuseau horaire obligatoire")
    if when <= datetime.now(timezone.utc):
        raise HTTPException(422, "Date future requise")
    if db.query(Appointment).filter_by(application_id=application_id).first():
        raise HTTPException(409, "Rendez-vous déjà demandé")
    ap = Appointment(
        application_id=application_id, scheduled_at=when, status="requested"
    )
    db.add(ap)
    db.commit()
    db.refresh(ap)
    return {
        "id": ap.id,
        "status": ap.status,
        "scheduled_at": ap.scheduled_at.isoformat(),
        "note": "Demande uniquement; aucun créneau officiel réservé.",
    }


@app.get("/api/dashboard")
def dashboard(u: User = Depends(staff), db: Session = Depends(get_db)):
    query = db.query(Application)
    if u.role in ("academic_iit", "academic_isb"):
        institution = "IIT" if u.role == "academic_iit" else "ISB"
        query = query.join(Program, Application.program_id == Program.id).filter(
            Program.institution == institution
        )
    apps = query.order_by(Application.id.desc()).all()
    return {
        "applications": [application_out(a) for a in apps],
        "total_applications": len(apps),
        "status_counts": {
            s: sum(a.status == s for a in apps) for s in set(a.status for a in apps)
        },
    }


class ProgramIn(InputModel):
    name: str = Field(min_length=2, max_length=200)
    institution: str = Field(pattern="^(IIT|ISB)$")
    category: str = Field(min_length=2, max_length=80)
    description: str = Field(default="", max_length=10000)
    prerequisites: str = Field(default="", max_length=10000)
    outcomes: str = Field(default="", max_length=10000)
    published: bool = False
    accepted_bac_sections: list[BacSection] = Field(default_factory=list)
    min_average: Optional[Grade] = None
    key_subjects: list[Subject] = Field(default_factory=list)
    annual_tuition: Optional[float] = Field(default=None, ge=0)
    duration_years: Optional[int] = Field(default=None, ge=1, le=10)
    city: Optional[str] = Field(default="Sfax", max_length=80)
    learning_style: Optional[str] = Field(default="mixte", max_length=40)


def can_manage_program(u, institution):
    if u.role not in ("admin", "direction", "academic_iit", "academic_isb"):
        raise HTTPException(403, "Gestion des formations non autorisée")
    if u.role.startswith("academic_") and u.role != "academic_" + institution.lower():
        raise HTTPException(403, "Établissement non autorisé")


@app.get("/api/admin/programs")
def admin_programs(u: User = Depends(staff), db: Session = Depends(get_db)):
    query = db.query(Program)
    if u.role in ("academic_iit", "academic_isb"):
        query = query.filter_by(institution=u.role.split("_")[1].upper())
    return [program_out(p) for p in query.order_by(Program.id).all()]


@app.post("/api/admin/programs", status_code=201)
def create_program(
    v: ProgramIn, u: User = Depends(staff), db: Session = Depends(get_db)
):
    can_manage_program(u, v.institution)
    program = Program(**v.model_dump())
    db.add(program)
    db.commit()
    db.refresh(program)
    return program_out(program)


@app.put("/api/admin/programs/{program_id}")
def update_program(
    program_id: int,
    v: ProgramIn,
    u: User = Depends(staff),
    db: Session = Depends(get_db),
):
    program = db.get(Program, program_id)
    if not program:
        raise HTTPException(404, "Formation introuvable")
    can_manage_program(u, program.institution)
    can_manage_program(u, v.institution)
    for field, value in v.model_dump().items():
        setattr(program, field, value)
    db.commit()
    return program_out(program)
