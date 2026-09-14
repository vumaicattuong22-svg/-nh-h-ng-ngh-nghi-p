"""Kiểm tra nhanh GEMINI_API_KEY và các model đã khai trong backend/.env.

Chạy:  backend/.venv/Scripts/python.exe backend/check_gemini.py
"""

import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from google import genai
from google.genai import errors, types

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from backend.app.main import (  # noqa: E402
    GEMINI_DEEP_MODEL,
    GEMINI_FALLBACK_MODELS,
    GEMINI_MODEL,
    thinking_config,
)

load_dotenv(Path(__file__).resolve().parent / ".env")


def main() -> int:
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        print("[X] Chưa có GEMINI_API_KEY trong backend/.env")
        return 1
    print(f"[i] Key dài {len(api_key)} ký tự, bắt đầu bằng {api_key[:4]}...")

    client = genai.Client(api_key=api_key)
    try:
        available = {
            model.name.removeprefix("models/")
            for model in client.models.list()
            if "generateContent" in (model.supported_actions or [])
        }
    except errors.APIError as exc:
        print(f"[X] Key bị Gemini từ chối: {exc.code} {exc.status} - {exc.message}")
        print("    Tạo key mới tại https://aistudio.google.com/apikey rồi dán vào backend/.env")
        return 1
    print(f"[v] Key hợp lệ, gọi được {len(available)} model.")

    failed = 0
    for model in dict.fromkeys([GEMINI_MODEL, GEMINI_DEEP_MODEL, *GEMINI_FALLBACK_MODELS]):
        if model not in available:
            print(f"[X] {model}: key này không truy cập được (kiểm tra lại tên model hoặc gói cước)")
            failed += 1
            continue
        try:
            response = client.models.generate_content(
                model=model,
                contents="Trả lời đúng một từ: OK",
                config=types.GenerateContentConfig(
                    max_output_tokens=2048,
                    thinking_config=thinking_config(model, deep=False),
                ),
            )
        except errors.APIError as exc:
            print(f"[X] {model}: {exc.code} {exc.status} - {exc.message}")
            failed += 1
        else:
            print(f"[v] {model}: trả lời {(response.text or '').strip()[:40]!r}")

    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
