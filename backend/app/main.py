from fastapi import FastAPI

app = FastAPI(title="SmartCampus AI API")

@app.get("/")
def read_root():
    return {"status": "SmartCampus Backend is running!"}