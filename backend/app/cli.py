"""Local administrative actions. Run migrations before this CLI."""

import argparse
import getpass
from .database import SessionLocal
from .models import User, Profile
from .security import hash_password
from .seed import seed_demo


def main():
    parser = argparse.ArgumentParser()
    actions = parser.add_subparsers(dest="action", required=True)
    actions.add_parser("seed-demo")
    admin = actions.add_parser("create-admin")
    admin.add_argument("--email", required=True)
    admin.add_argument("--name", default="Administrateur")
    args = parser.parse_args()
    with SessionLocal() as db:
        if args.action == "seed-demo":
            seed_demo(db)
            print("Données de démonstration initialisées.")
            return
        email = args.email.strip().lower()
        if "@" not in email or db.query(User).filter_by(email=email).first():
            parser.error("Email invalide ou déjà utilisé. Aucun compte modifié.")
        password = getpass.getpass("Mot de passe (8 caractères minimum) : ")
        if not 8 <= len(password) <= 128 or password != getpass.getpass("Confirmer : "):
            parser.error("Mot de passe invalide ou confirmation différente.")
        user = User(
            email=email,
            full_name=args.name,
            role="admin",
            password_hash=hash_password(password),
        )
        db.add(user)
        db.flush()
        db.add(Profile(user_id=user.id))
        db.commit()
        print(f"Administrateur créé : {email}")


if __name__ == "__main__":
    main()
