"""Opt-in, idempotent demonstration data; never reset existing passwords."""

import os
from .models import User, Program, Profile
from .security import hash_password

DEMO_PROGRAMS = [
    dict(
        name="[Démo] Génie logiciel et IA",
        institution="IIT",
        category="Ingénierie",
        description="Exemple pédagogique : informatique, développement logiciel, intelligence artificielle et données.",
        prerequisites="Exemple de prérequis à remplacer par les conditions officielles.",
        outcomes="Développement logiciel, intelligence artificielle, data, informatique",
    ),
    dict(
        name="[Démo] Cycle préparatoire scientifique",
        institution="IIT",
        category="Prépa",
        description="Exemple pédagogique : mathématiques, physique et préparation aux études d’ingénieur.",
        prerequisites="Exemple : baccalauréat scientifique, à confirmer par les admissions.",
        outcomes="Poursuite en ingénierie, sciences, mathématiques",
    ),
    dict(
        name="[Démo] Licence en management",
        institution="ISB",
        category="Licence",
        description="Exemple pédagogique : management, gestion, commerce et entrepreneuriat.",
        prerequisites="Conditions officielles à renseigner par les admissions.",
        outcomes="Gestion, commerce, management, entrepreneuriat",
    ),
    dict(
        name="[Démo] Finance et analyse de données",
        institution="ISB",
        category="Licence",
        description="Exemple pédagogique : finance, économie, statistiques et analyse de données.",
        prerequisites="Conditions officielles à renseigner par les admissions.",
        outcomes="Finance, banque, économie, analyse de données",
    ),
]


def seed_demo(db):
    for data in DEMO_PROGRAMS:
        if (
            not db.query(Program)
            .filter_by(name=data["name"], institution=data["institution"])
            .first()
        ):
            db.add(Program(**data, published=True))
    password = os.getenv("DEMO_PASSWORD", "DemoCampus2026!")
    for email, name, role in [
        ("candidat@demo.tn", "Candidat Démo", "candidate"),
        ("admin@demo.tn", "Administration Démo", "admin"),
    ]:
        if not db.query(User).filter_by(email=email).first():
            user = User(
                email=email,
                full_name=name,
                role=role,
                password_hash=hash_password(password),
            )
            db.add(user)
            db.flush()
            db.add(Profile(user_id=user.id))
    db.commit()
