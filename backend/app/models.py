from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    Boolean,
    DateTime,
    ForeignKey,
    JSON,
    UniqueConstraint,
)
from .database import Base


def now():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(150), nullable=False)
    role = Column(String(35), default="candidate", nullable=False)
    created_at = Column(DateTime(timezone=True), default=now)


class Program(Base):
    __tablename__ = "programs"
    id = Column(Integer, primary_key=True)
    name = Column(String(200), nullable=False)
    institution = Column(String(10), nullable=False)
    category = Column(String(80), nullable=False)
    description = Column(Text, default="")
    prerequisites = Column(Text, default="")
    outcomes = Column(Text, default="")
    published = Column(Boolean, default=False)


class Profile(Base):
    __tablename__ = "profiles"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    academic_level = Column(String(120), default="")
    interests = Column(Text, default="")
    goals = Column(Text, default="")
    preferred_language = Column(String(30), default="fr")


class Conversation(Base):
    __tablename__ = "conversations"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=now)


class Message(Base):
    __tablename__ = "messages"
    id = Column(Integer, primary_key=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False)
    sender = Column(String(15), nullable=False)
    text = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=now)


class Application(Base):
    __tablename__ = "applications"
    __table_args__ = (
        UniqueConstraint("user_id", "program_id", name="uq_application_user_program"),
    )
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    program_id = Column(Integer, ForeignKey("programs.id"), nullable=False)
    phone = Column(String(30), nullable=False)
    consent = Column(Boolean, nullable=False)
    status = Column(String(45), default="submitted")
    created_at = Column(DateTime(timezone=True), default=now)


class Quiz(Base):
    __tablename__ = "quizzes"
    id = Column(Integer, primary_key=True)
    application_id = Column(
        Integer, ForeignKey("applications.id"), unique=True, nullable=False
    )
    questions = Column(JSON, nullable=False)
    answers = Column(JSON, nullable=True)
    score = Column(Integer, nullable=True)


class Appointment(Base):
    __tablename__ = "appointments"
    id = Column(Integer, primary_key=True)
    application_id = Column(
        Integer, ForeignKey("applications.id"), unique=True, nullable=False
    )
    scheduled_at = Column(DateTime(timezone=True), nullable=False)
    status = Column(String(35), default="requested")
