import json
import sqlite3
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional

import numpy as np
import pdfplumber
from sentence_transformers import SentenceTransformer

_MODEL_CACHE: Dict[str, SentenceTransformer] = {}
_INDEX_CACHE: Dict[str, "PdfIndex"] = {}


@dataclass
class PdfChunk:
    source_file: str
    page: int
    text: str


@dataclass
class PdfIndex:
    model_name: str
    embeddings: np.ndarray
    records: List[PdfChunk]

    def search(self, query: str, top_k: int) -> List[PdfChunk]:
        if not self.records:
            return []
        query_vec = embed_texts([query], self.model_name)[0]
        query_vec = _normalize(query_vec)
        sims = np.dot(self.embeddings, query_vec)
        top_k = min(top_k, len(self.records))
        best_idx = np.argpartition(-sims, top_k - 1)[:top_k]
        best_idx = best_idx[np.argsort(-sims[best_idx])]
        return [self.records[idx] for idx in best_idx]


def _normalize(vec: np.ndarray) -> np.ndarray:
    norm = np.linalg.norm(vec)
    if norm == 0:
        return vec
    return vec / norm


def _get_model(model_name: str) -> SentenceTransformer:
    model = _MODEL_CACHE.get(model_name)
    if model is None:
        model = SentenceTransformer(model_name)
        _MODEL_CACHE[model_name] = model
    return model


def embed_texts(texts: List[str], model_name: str) -> np.ndarray:
    model = _get_model(model_name)
    embeddings = model.encode(texts, normalize_embeddings=True)
    return np.asarray(embeddings, dtype=np.float32)


def _iter_pdf_chunks(pdf_path: Path, max_chars: int = 800, min_chars: int = 50) -> List[PdfChunk]:
    chunks: List[PdfChunk] = []
    with pdfplumber.open(pdf_path) as pdf:
        for page_idx, page in enumerate(pdf.pages, start=1):
            text = page.extract_text() or ""
            text = " ".join(text.split())
            if len(text) < min_chars:
                continue
            parts = _chunk_text(text, max_chars)
            for part in parts:
                if len(part) >= min_chars:
                    chunks.append(PdfChunk(pdf_path.name, page_idx, part))
    return chunks


def _chunk_text(text: str, max_chars: int) -> List[str]:
    if len(text) <= max_chars:
        return [text]
    chunks: List[str] = []
    start = 0
    while start < len(text):
        end = min(start + max_chars, len(text))
        chunks.append(text[start:end])
        start = end
    return chunks


def _ensure_schema(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        create table if not exists pdf_chunks (
            id integer primary key,
            source_file text not null,
            page integer not null,
            chunk text not null,
            embedding blob not null
        );
        """
    )
    conn.execute(
        """
        create table if not exists pdf_index_meta (
            key text primary key,
            value text not null
        );
        """
    )


def build_pdf_index(pdf_dir: str, index_path: str, model_name: str) -> int:
    pdf_dir_path = Path(pdf_dir)
    pdf_files = sorted(pdf_dir_path.glob("*.pdf"))
    if not pdf_files:
        raise FileNotFoundError(f"No PDFs found in {pdf_dir_path}")

    chunks: List[PdfChunk] = []
    for pdf_path in pdf_files:
        chunks.extend(_iter_pdf_chunks(pdf_path))

    embeddings = embed_texts([chunk.text for chunk in chunks], model_name)

    index_path_obj = Path(index_path)
    index_path_obj.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(index_path) as conn:
        _ensure_schema(conn)
        conn.execute("delete from pdf_chunks;")
        conn.execute("delete from pdf_index_meta;")
        for chunk, emb in zip(chunks, embeddings, strict=False):
            conn.execute(
                "insert into pdf_chunks (source_file, page, chunk, embedding) values (?, ?, ?, ?);",
                (chunk.source_file, chunk.page, chunk.text, emb.tobytes()),
            )
        conn.execute(
            "insert into pdf_index_meta (key, value) values (?, ?);",
            ("model_name", model_name),
        )
        conn.commit()
    _INDEX_CACHE.pop(index_path, None)
    return len(chunks)


def _load_index(index_path: str) -> PdfIndex:
    cached = _INDEX_CACHE.get(index_path)
    if cached is not None:
        return cached

    with sqlite3.connect(index_path) as conn:
        _ensure_schema(conn)
        meta = dict(conn.execute("select key, value from pdf_index_meta;").fetchall())
        model_name = meta.get("model_name")
        if not model_name:
            raise RuntimeError("Missing model_name in pdf_index_meta; rebuild the index.")
        rows = conn.execute(
            "select source_file, page, chunk, embedding from pdf_chunks;"
        ).fetchall()

    records: List[PdfChunk] = []
    embeddings: List[np.ndarray] = []
    for source_file, page, chunk, embedding in rows:
        records.append(PdfChunk(source_file, page, chunk))
        embeddings.append(np.frombuffer(embedding, dtype=np.float32))

    if embeddings:
        emb_matrix = np.vstack(embeddings)
        emb_matrix = np.asarray(emb_matrix, dtype=np.float32)
    else:
        emb_matrix = np.zeros((0, 1), dtype=np.float32)

    index = PdfIndex(model_name=model_name, embeddings=emb_matrix, records=records)
    _INDEX_CACHE[index_path] = index
    return index


def retrieve_sources(
    query: str,
    index_path: str,
    top_k: int,
    max_chars: int = 600,
) -> Dict[str, Dict[str, str]]:
    index = _load_index(index_path)
    results = index.search(query, top_k)
    sources: Dict[str, Dict[str, str]] = {}
    for idx, item in enumerate(results, start=1):
        key = f"src{idx}"
        sources[key] = {
            "text": item.text[:max_chars],
            "source_file": item.source_file,
            "page": str(item.page),
        }
    return sources


def summarize_index(index_path: str) -> str:
    index = _load_index(index_path)
    summary = {
        "model_name": index.model_name,
        "chunks": len(index.records),
    }
    return json.dumps(summary, indent=2)
