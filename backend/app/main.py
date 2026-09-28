import logging

import openai
from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import Settings, get_settings
from .openai_service import normalize_image, solve_image
from .schemas import ErrorResponse, SolveRequest, SolveResponse

logger = logging.getLogger("browser_question_solver")

app = FastAPI(title="Browser Question Solver API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^(chrome-extension|moz-extension)://[a-zA-Z0-9_-]+$|^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)


@app.middleware("http")
async def limit_request_size(request: Request, call_next):
    settings = get_settings()
    length = request.headers.get("content-length")
    if length:
        try:
            if int(length) > settings.max_request_bytes:
                return JSONResponse(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    content={"detail": f"Yêu cầu vượt quá {settings.max_request_mb} MB."},
                )
        except ValueError:
            return JSONResponse(status_code=400, content={"detail": "Content-Length không hợp lệ."})
    return await call_next(request)


@app.get("/api/health")
async def health(settings: Settings = Depends(get_settings)):
    return {
        "status": "ok",
        "provider": settings.provider,
        "model": settings.model,
        "configured": settings.configured,
    }


@app.post(
    "/api/solve",
    response_model=SolveResponse,
    responses={400: {"model": ErrorResponse}, 502: {"model": ErrorResponse}, 504: {"model": ErrorResponse}},
)
async def solve(payload: SolveRequest, settings: Settings = Depends(get_settings)) -> SolveResponse:
    try:
        image_url = normalize_image(payload.image, settings.max_image_bytes)
        result = await solve_image(image_url, payload.language, settings)
        return SolveResponse(**result.model_dump(), provider=settings.provider, model=settings.model)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except openai.APITimeoutError as exc:
        raise HTTPException(status_code=504, detail="OpenAI phản hồi quá thời gian.") from exc
    except openai.AuthenticationError as exc:
        logger.warning("OpenAI authentication failed")
        raise HTTPException(status_code=502, detail="OpenAI từ chối xác thực API key.") from exc
    except openai.RateLimitError as exc:
        raise HTTPException(status_code=429, detail="OpenAI đang giới hạn yêu cầu. Hãy thử lại sau.") from exc
    except openai.APIError as exc:
        logger.exception("OpenAI API error")
        raise HTTPException(status_code=502, detail="OpenAI API gặp lỗi tạm thời.") from exc


@app.get("/")
async def root():
    return {"name": "Browser Question Solver API", "health": "/api/health", "docs": "/docs"}
