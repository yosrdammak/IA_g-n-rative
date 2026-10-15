import os
from datetime import datetime, timezone
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel, Field
from typing import Optional
from .database import Base, engine, get_db
from .models import User, Program, Profile, Conversation, Message, Application, Quiz, Appointment
from .security import hash_password, verify_password, token, current_user, staff

@asynccontextmanager
async def lifespan(app:FastAPI):
    # Prototype setup only; use Alembic migrations for production deployments.
    Base.metadata.create_all(bind=engine)
    yield
app=FastAPI(title='SmartCampus AI API',version='0.1.0',lifespan=lifespan)
origins=os.getenv('CORS_ORIGINS','http://localhost:5174,http://127.0.0.1:5174').split(',')
app.add_middleware(CORSMiddleware,allow_origins=origins,allow_credentials=True,allow_methods=['GET','POST','PUT'],allow_headers=['Authorization','Content-Type'])
class Register(BaseModel):
    email:str=Field(min_length=5,max_length=255)
    full_name:str=Field(min_length=2,max_length=150)
    password:str=Field(min_length=8,max_length=128)
class Login(BaseModel):
    email:str
    password:str
class ProfileIn(BaseModel):
    academic_level:str=Field(default='',max_length=120)
    interests:str=Field(default='',max_length=500)
    goals:str=Field(default='',max_length=500)
    preferred_language:str='fr'
class ChatIn(BaseModel):
    message:str=Field(min_length=1,max_length=3000)
    conversation_id:Optional[int]=None
class ApplicationIn(BaseModel):
    program_id:int
    phone:str=Field(min_length=6,max_length=30)
    consent:bool
class AnswersIn(BaseModel):
    answers:list[int]
class AppointmentIn(BaseModel):
    scheduled_at:datetime

def user_out(u): return {'id':u.id,'email':u.email,'full_name':u.full_name,'role':u.role}
def program_out(x): return {k:getattr(x,k) for k in ('id','name','institution','category','description','prerequisites','outcomes','published')}
def application_out(a): return {'id':a.id,'program_id':a.program_id,'user_id':a.user_id,'status':a.status,'phone':a.phone,'created_at':a.created_at.isoformat() if a.created_at else None}
def owned(db,model,id,user,key='user_id'):
    obj=db.get(model,id)
    if not obj or getattr(obj,key)!=user.id: raise HTTPException(404,'Ressource introuvable')
    return obj

@app.get('/health')
def health(): return {'status':'ok'}
@app.get('/')
def root(): return {'status':'SmartCampus Backend is running!','docs':'/docs'}
@app.post('/api/auth/register',status_code=201)
def register(v:Register,db:Session=Depends(get_db)):
    email=v.email.strip().lower()
    if '@' not in email: raise HTTPException(422,'Adresse email invalide')
    if db.query(User).filter(User.email==email).first(): raise HTTPException(409,'Email déjà utilisé')
    u=User(email=email,full_name=v.full_name.strip(),password_hash=hash_password(v.password),role='candidate')
    db.add(u);db.commit();db.refresh(u)
    db.add(Profile(user_id=u.id));db.commit()
    return {'access_token':token(u),'token_type':'bearer','user':user_out(u)}
@app.post('/api/auth/login')
def login(v:Login,db:Session=Depends(get_db)):
    u=db.query(User).filter(User.email==v.email.strip().lower()).first()
    if not u or not verify_password(v.password,u.password_hash):raise HTTPException(401,'Identifiants incorrects')
    return {'access_token':token(u),'token_type':'bearer','user':user_out(u)}
@app.get('/api/auth/me')
def me(u:User=Depends(current_user)):return user_out(u)
@app.get('/api/programs')
def programs(db:Session=Depends(get_db)):
    return [program_out(x) for x in db.query(Program).filter(Program.published.is_(True)).order_by(Program.name).all()]
@app.get('/api/profile')
def get_profile(u:User=Depends(current_user),db:Session=Depends(get_db)):
    p=db.query(Profile).filter_by(user_id=u.id).first()
    return {'academic_level':p.academic_level,'interests':p.interests,'goals':p.goals,'preferred_language':p.preferred_language}
@app.put('/api/profile')
def update_profile(v:ProfileIn,u:User=Depends(current_user),db:Session=Depends(get_db)):
    p=db.query(Profile).filter_by(user_id=u.id).first()
    if v.preferred_language not in ('fr','tn','arabizi'):raise HTTPException(422,'Langue non prise en charge')
    for field,value in v.model_dump().items(): setattr(p,field,value)
    db.commit();return {'message':'Profil mis à jour'}
@app.get('/api/recommendations')
def recommendations(u:User=Depends(current_user),db:Session=Depends(get_db)):
    p=db.query(Profile).filter_by(user_id=u.id).first()
    words=set((p.interests+' '+p.goals).lower().split())
    data=[]
    for pr in db.query(Program).filter_by(published=True).all():
        text=(pr.name+' '+pr.description+' '+pr.category+' '+pr.outcomes).lower()
        hits=[w for w in words if len(w)>3 and w in text]
        data.append({'program':program_out(pr),'matching_keywords':hits,'score':len(hits)})
    return {'method':'keyword_demo','disclaimer':'Classement exploratoire par mots-clés, sans vérification des prérequis ni décision officielle.','recommendations':sorted(data,key=lambda x:x['score'],reverse=True)[:3]}
@app.get('/api/conversations')
def conversations(u:User=Depends(current_user),db:Session=Depends(get_db)):
    result=[]
    for c in db.query(Conversation).filter_by(user_id=u.id).order_by(Conversation.id.desc()).all():
        msgs=db.query(Message).filter_by(conversation_id=c.id).order_by(Message.id).all()
        result.append({'id':c.id,'messages':[{'sender':m.sender,'text':m.text} for m in msgs]})
    return result
@app.post('/api/chat')
def chat(v:ChatIn,u:User=Depends(current_user),db:Session=Depends(get_db)):
    c=owned(db,Conversation,v.conversation_id,u) if v.conversation_id else Conversation(user_id=u.id)
    if c.id is None:db.add(c);db.flush()
    db.add(Message(conversation_id=c.id,sender='user',text=v.message.strip()))
    low=v.message.lower()
    if any(x in low for x in ('formation','licence','prépa','prepa','ingénier','ingenier','isb','iit')):
        reply='Consulte la rubrique Formations pour les programmes publiés. Les informations officielles doivent être ajoutées par un responsable autorisé.'
    elif any(x in low for x in ('inscri','n9ayed','na9yed')):
        reply='Tu peux démarrer ta préinscription depuis la rubrique Candidature, après avoir choisi une formation.'
    elif any(x in low for x in ('orientation','conseil','n7eb','aime','intérêt')):
        reply='Renseigne tes intérêts et ton objectif dans Mon profil, puis consulte les suggestions de parcours.'
    else:
        reply="Bienvenue sur SmartCampus AI ! Je suis actuellement un assistant de démonstration à règles, pas encore un LLM. Je peux te guider vers les formations, le profil et la préinscription."
    db.add(Message(conversation_id=c.id,sender='assistant',text=reply));db.commit()
    return {'conversation_id':c.id,'reply':reply,'mode':'rules_demo'}
@app.post('/api/applications',status_code=201)
def apply(v:ApplicationIn,u:User=Depends(current_user),db:Session=Depends(get_db)):
    if not v.consent:raise HTTPException(422,'Consentement requis')
    pr=db.get(Program,v.program_id)
    if not pr or not pr.published:raise HTTPException(404,'Formation indisponible')
    a=Application(user_id=u.id,program_id=pr.id,phone=v.phone,consent=True)
    db.add(a);db.commit();db.refresh(a)
    return application_out(a)
@app.get('/api/applications')
def my_applications(u:User=Depends(current_user),db:Session=Depends(get_db)):
    return [application_out(a) for a in db.query(Application).filter_by(user_id=u.id).order_by(Application.id.desc()).all()]
# Illustrative quiz only: never present it as an official IIT/ISB assessment.
QUESTIONS=[{'question':'Une bonne orientation doit-elle vérifier les prérequis ?','options':['Oui','Non'],'answer':0},{'question':'Quel acteur valide une décision académique officielle ?','options':['Le chatbot seul','Le responsable habilité'],'answer':1},{'question':'Peut-on modifier les informations de son profil ?','options':['Oui','Non'],'answer':0}]
@app.post('/api/applications/{application_id}/quiz')
def create_quiz(application_id:int,u:User=Depends(current_user),db:Session=Depends(get_db)):
    owned(db,Application,application_id,u)
    q=db.query(Quiz).filter_by(application_id=application_id).first()
    if not q:
        q=Quiz(application_id=application_id,questions=QUESTIONS)
        db.add(q);db.commit();db.refresh(q)
    return {'id':q.id,'questions':[{'question':x['question'],'options':x['options']} for x in q.questions],'score':q.score}
@app.post('/api/quizzes/{quiz_id}/submit')
def submit_quiz(quiz_id:int,v:AnswersIn,u:User=Depends(current_user),db:Session=Depends(get_db)):
    q=db.get(Quiz,quiz_id)
    if not q:raise HTTPException(404,'QCM introuvable')
    owned(db,Application,q.application_id,u)
    if q.score is not None:raise HTTPException(409,'QCM déjà soumis')
    if len(v.answers)!=len(q.questions) or any(not isinstance(a,int) or a<0 or a>=len(q.questions[i]['options']) for i,a in enumerate(v.answers)):
        raise HTTPException(422,'Réponses invalides')
    q.answers=v.answers;q.score=sum(a==q.questions[i]['answer'] for i,a in enumerate(v.answers));db.commit()
    return {'score':q.score,'total':len(q.questions),'note':'QCM de démonstration uniquement'}
@app.post('/api/applications/{application_id}/appointment')
def request_appointment(application_id:int,v:AppointmentIn,u:User=Depends(current_user),db:Session=Depends(get_db)):
    owned(db,Application,application_id,u)
    when=v.scheduled_at
    if when.tzinfo is None:raise HTTPException(422,'Fuseau horaire obligatoire')
    if when<=datetime.now(timezone.utc):raise HTTPException(422,'Date future requise')
    if db.query(Appointment).filter_by(application_id=application_id).first():raise HTTPException(409,'Rendez-vous déjà demandé')
    ap=Appointment(application_id=application_id,scheduled_at=when,status='requested')
    db.add(ap);db.commit();db.refresh(ap)
    return {'id':ap.id,'status':ap.status,'scheduled_at':ap.scheduled_at.isoformat(),'note':'Demande uniquement; aucun créneau officiel réservé.'}
@app.get('/api/dashboard')
def dashboard(u:User=Depends(staff),db:Session=Depends(get_db)):
    query=db.query(Application)
    if u.role in ('academic_iit','academic_isb'):
        institution='IIT' if u.role=='academic_iit' else 'ISB'
        query=query.join(Program,Application.program_id==Program.id).filter(Program.institution==institution)
    apps=query.order_by(Application.id.desc()).all()
    return {'applications':[application_out(a) for a in apps],'total_applications':len(apps),'status_counts':{s:sum(a.status==s for a in apps) for s in set(a.status for a in apps)}}
