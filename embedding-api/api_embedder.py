import uuid
from typing import List, Optional
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
import chromadb

# --- 1. Define Request/Response schemas ---
class EmbedRequest(BaseModel):
    texts: List[str]
    metadata: Optional[List[dict]] = None

class SearchRequest(BaseModel):
    query: str
    n_results: int = 5

app = FastAPI(title="Local Vector API (1536D)")

# --- 2. Global instances (Loaded once on startup) ---
# We use the Qwen2-1.5B-instruct model (1536 Dimensions).
print("Loading 1536D Model (Alibaba-NLP/gte-Qwen2-1.5B-instruct)...")

try:
    # FIX APPLIED: Removed 'trust_remote_code=True'
    # Since you have transformers 5.0+, native support is better and avoids the 'rope_theta' crash.
    model = SentenceTransformer('Alibaba-NLP/gte-Qwen2-1.5B-instruct')
    
    # Set max sequence length (model supports up to 32k, but we limit to 8k for RAM safety)
    model.max_seq_length = 8192
    print("Model loaded successfully.")
except Exception as e:
    print(f"CRITICAL ERROR loading model: {e}")
    # We keep the app running so you can see the error in logs, 
    # but the endpoints will fail if called.
    model = None

# --- 3. Connect to ChromaDB ---
try:
    chroma_client = chromadb.HttpClient(host='127.0.0.1', port=8001)
    # We name the collection explicitly for 1536D to be safe
    collection = chroma_client.get_or_create_collection(name="local_vectors_1536")
    print("Connected to ChromaDB successfully.")
except Exception as e:
    print(f"CRITICAL: Could not connect to ChromaDB: {e}")
    collection = None

@app.get("/")
def read_root():
    if not model:
        return {"status": "error", "detail": "Model failed to load. Check logs."}
    
    count = collection.count() if collection else 0
    return {
        "status": "online", 
        "model": "gte-Qwen2-1.5B-instruct (1536D)", 
        "database_items": count
    }

@app.post("/embed")
async def embed_and_store(request: EmbedRequest):
    if not collection:
        raise HTTPException(status_code=500, detail="Database connection is down.")
    if not model:
        raise HTTPException(status_code=500, detail="Model is not loaded.")

    try:
        # Generate embeddings 
        # Note: We do NOT use prompt_name="query" for storage/documents, only for search.
        embeddings = model.encode(request.texts, normalize_embeddings=True).tolist()
        ids = [str(uuid.uuid4()) for _ in request.texts]

        add_kwargs = {
            "documents": request.texts,
            "embeddings": embeddings,
            "ids": ids
        }

        if request.metadata and all(m for m in request.metadata):
            add_kwargs["metadatas"] = request.metadata

        collection.add(**add_kwargs)

        return {
            "message": f"Successfully stored {len(ids)} items",
            "ids": ids,
            "dims": len(embeddings[0]),  # Should be 1536
            "embeddings": embeddings  # Return embeddings for god-agent compatibility
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/search")
async def search(request: SearchRequest):
    if not collection:
        raise HTTPException(status_code=500, detail="Database connection is down.")
    if not model:
        raise HTTPException(status_code=500, detail="Model is not loaded.")

    try:
        # INSTRUCTION: The gte-Qwen2 model uses specific prompts for retrieval.
        # We use prompt_name="query" to tell the model this is a search question.
        query_vector = model.encode(
            [request.query], 
            prompt_name="query", 
            normalize_embeddings=True
        ).tolist()
        
        results = collection.query(
            query_embeddings=query_vector,
            n_results=request.n_results
        )
        
        return {"results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    # Host on 8000 (Chroma is on 8001)
    uvicorn.run(app, host="127.0.0.1", port=8000)