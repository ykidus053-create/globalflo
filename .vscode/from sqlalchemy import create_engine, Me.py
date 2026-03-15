from sqlalchemy import create_engine, MetaData

DATABASE_URL = "sqlite:///./urgent_fix.db"  # For production: switch to PostgreSQL
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
metadata = MetaData()from sqlalchemy import Table, Column, Integer, String, Text, DateTime
from datetime import datetime
from database import metadata, engine

problems = Table(
    "problems",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("title", String(200)),
    Column("category", String(100)),
    Column("description", Text),
    Column("solution", Text),
    Column("created_at", DateTime, default=datetime.utcnow)
)

metadata.create_all(engine)from fastapi import FastAPI
from pydantic import BaseModel
from sqlalchemy import insert, select
from models import problems
from database import engine
import random

app = FastAPI(title="Urgent Problem Solver API")

# Pydantic model for request
class ProblemRequest(BaseModel):
    title: str
    category: str
    description: str

# Pydantic model for response
class ProblemResponse(BaseModel):
    title: str
    category: str
    description: str
    solution: str

# Fake AI solution generator
def generate_solution(category: str, description: str) -> str:
    suggestions = {
        "tech": ["Restart device", "Check internet", "Clear cache"],
        "personal": ["Take deep breath", "Write thoughts down", "Talk to a friend"],
        "business": ["Prioritize tasks", "Delegate responsibilities", "Call manager"],
        "health": ["Drink water", "Rest", "Apply ice or heat"]
    }
    return random.choice(suggestions.get(category.lower(), ["Research online", "Seek expert help"]))

# Submit urgent problem
@app.post("/submit", response_model=ProblemResponse)
def submit_problem(problem: ProblemRequest):
    solution = generate_solution(problem.category, problem.description)

    # Save to database
    conn = engine.connect()
    stmt = insert(problems).values(
        title=problem.title,
        category=problem.category,
        description=problem.description,
        solution=solution
    )
    conn.execute(stmt)
    conn.close()

    return ProblemResponse(
        title=problem.title,
        category=problem.category,
        description=problem.description,
        solution=solution
    )

# View all problems
@app.get("/problems")
def get_all_problems():
    conn = engine.connect()
    stmt = select(problems)
    result = conn.execute(stmt).fetchall()
    conn.close()
    return [
        {
            "id": r.id,
            "title": r.title,
            "category": r.category,
            "description": r.description,
            "solution": r.solution,
            "created_at": r.created_at
        } for r in result
    ]22
