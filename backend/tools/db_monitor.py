"""
Local-only MongoDB monitoring/editing UI for PangkasKAKA.

Why this exists: the Atlas web dashboard login is currently locked out
(Google account verification issue), but the app's own MONGO_URL connection
still works fine. This tool reuses that same connection string to give a
read/write UI without touching production code or the Atlas account.

Usage:
    cd backend
    python tools/db_monitor.py
    # then open http://127.0.0.1:8877 in your browser

Binds to 127.0.0.1 only — not reachable from other devices/network.
"""
import json
import os
from pathlib import Path

from bson import ObjectId
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, JSONResponse, Response
from pymongo import MongoClient
from pymongo.errors import PyMongoError

BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BACKEND_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]

client = MongoClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="PangkasKAKA DB Monitor (local only)")

FORBIDDEN_FILTER_KEYS = {"$where", "$function", "$accumulator"}


def to_jsonable(doc: dict) -> dict:
    out = {}
    for k, v in doc.items():
        if isinstance(v, ObjectId):
            out[k] = str(v)
        else:
            out[k] = v
    return out


def find_query(coll_name: str, query: dict):
    _check_query_safety(query)
    return db[coll_name].find(query)


def _check_query_safety(query: dict):
    for k in query:
        if k in FORBIDDEN_FILTER_KEYS:
            raise HTTPException(400, f"Operator {k} tidak diizinkan")


def _doc_filter(doc_id: str) -> dict:
    """Documents in this app use a uuid string `id` field, not Mongo _id."""
    return {"id": doc_id}


@app.get("/")
def index():
    return FileResponse(BACKEND_DIR / "tools" / "db_monitor.html")


@app.get("/favicon.ico")
def favicon():
    svg = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>\U0001f343</text></svg>"
    return Response(content=svg, media_type="image/svg+xml")


@app.get("/api/info")
def info():
    return {"db_name": DB_NAME}


@app.get("/api/collections")
def list_collections():
    names = sorted(db.list_collection_names())
    result = []
    for name in names:
        try:
            count = db[name].estimated_document_count()
        except PyMongoError:
            count = 0
        result.append({"name": name, "count": count})
    return result


@app.get("/api/collections/{name}")
def list_documents(name: str, page: int = 1, limit: int = 25, q: str = ""):
    if name not in db.list_collection_names():
        raise HTTPException(404, "Collection tidak ditemukan")

    query = {}
    if q.strip():
        try:
            query = json.loads(q)
            if not isinstance(query, dict):
                raise ValueError
        except ValueError:
            raise HTTPException(400, "Filter query harus berupa JSON object, contoh: {\"status\": \"completed\"}")
    _check_query_safety(query)

    limit = max(1, min(limit, 200))
    skip = max(0, (page - 1) * limit)

    total = db[name].count_documents(query)
    cursor = db[name].find(query).skip(skip).limit(limit)
    docs = [to_jsonable(d) for d in cursor]
    return {"total": total, "page": page, "limit": limit, "documents": docs}


@app.get("/api/document/{name}/{doc_id}")
def get_document(name: str, doc_id: str):
    doc = db[name].find_one(_doc_filter(doc_id)) or db[name].find_one({"_id": _try_object_id(doc_id)})
    if not doc:
        raise HTTPException(404, "Dokumen tidak ditemukan")
    return to_jsonable(doc)


@app.put("/api/document/{name}/{doc_id}")
def update_document(name: str, doc_id: str, body: dict):
    body.pop("_id", None)
    filt = _doc_filter(doc_id)
    if not db[name].find_one(filt):
        filt = {"_id": _try_object_id(doc_id)}
        if not db[name].find_one(filt):
            raise HTTPException(404, "Dokumen tidak ditemukan")
    db[name].update_one(filt, {"$set": body})
    return {"ok": True}


@app.delete("/api/document/{name}/{doc_id}")
def delete_document(name: str, doc_id: str):
    filt = _doc_filter(doc_id)
    result = db[name].delete_one(filt)
    if result.deleted_count == 0:
        result = db[name].delete_one({"_id": _try_object_id(doc_id)})
    if result.deleted_count == 0:
        raise HTTPException(404, "Dokumen tidak ditemukan")
    return {"ok": True}


def _try_object_id(doc_id: str):
    try:
        return ObjectId(doc_id)
    except Exception:
        return None


if __name__ == "__main__":
    import uvicorn

    print(f"Konek ke DB: {DB_NAME}")
    print("Membuka di http://127.0.0.1:8877  (hanya bisa diakses dari komputer ini)")
    uvicorn.run(app, host="127.0.0.1", port=8877)
