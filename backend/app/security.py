from datetime import datetime, timedelta, timezone
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from passlib.context import CryptContext
from sqlalchemy.orm import Session
from .database import get_db
from .models import User
from .config import JWT_SECRET

SECRET = JWT_SECRET
ALGORITHM = "HS256"
pwd = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
bearer = HTTPBearer(auto_error=False)


def hash_password(v):
    return pwd.hash(v)


def verify_password(v, h):
    return pwd.verify(v, h)


def token(user):
    return jwt.encode(
        {"sub": str(user.id), "exp": datetime.now(timezone.utc) + timedelta(hours=12)},
        SECRET,
        algorithm=ALGORITHM,
    )


def current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: Session = Depends(get_db),
):
    if credentials is None:
        raise HTTPException(
            401, "Authentification requise", headers={"WWW-Authenticate": "Bearer"}
        )
    try:
        payload = jwt.decode(credentials.credentials, SECRET, algorithms=[ALGORITHM])
        uid = int(payload["sub"])
    except (JWTError, KeyError, ValueError, TypeError):
        raise HTTPException(401, "Session invalide")
    user = db.get(User, uid)
    if user is None:
        raise HTTPException(401, "Compte introuvable")
    return user


def staff(user: User = Depends(current_user)):
    if user.role not in (
        "academic_iit",
        "academic_isb",
        "interviewer",
        "direction",
        "admin",
    ):
        raise HTTPException(403, "Accès réservé au personnel")
    return user
