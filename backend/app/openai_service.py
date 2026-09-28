import base64
import binascii
import re

from openai import AsyncOpenAI

from .config import Settings
from .schemas import SolveResult

DATA_URL_RE = re.compile(r"^data:(image/(?:png|jpeg|webp));base64,(.+)$", re.DOTALL)


def normalize_image(image: str, max_bytes: int) -> str:
    match = DATA_URL_RE.match(image)
    if match:
        mime, encoded = match.groups()
    else:
        mime, encoded = "image/jpeg", image

    encoded = re.sub(r"\s+", "", encoded)
    try:
        raw = base64.b64decode(encoded, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValueError("Ảnh không phải dữ liệu base64 hợp lệ.") from exc

    if not raw:
        raise ValueError("Ảnh trống.")
    if len(raw) > max_bytes:
        raise ValueError(f"Ảnh vượt quá giới hạn {max_bytes // (1024 * 1024)} MB.")
    if mime == "image/png" and not raw.startswith(b"\x89PNG\r\n\x1a\n"):
        raise ValueError("Dữ liệu không khớp định dạng PNG.")
    if mime == "image/jpeg" and not raw.startswith(b"\xff\xd8\xff"):
        raise ValueError("Dữ liệu không khớp định dạng JPEG.")
    if mime == "image/webp" and not (raw.startswith(b"RIFF") and raw[8:12] == b"WEBP"):
        raise ValueError("Dữ liệu không khớp định dạng WebP.")
    return f"data:{mime};base64,{encoded}"


async def solve_image(image_url: str, language: str, settings: Settings) -> SolveResult:
    if not settings.openai_api_key:
        raise RuntimeError("OPENAI_API_KEY chưa được cấu hình trên backend.")

    client = AsyncOpenAI(
        api_key=settings.openai_api_key,
        timeout=settings.openai_timeout_seconds,
        max_retries=1,
    )
    response = await client.responses.parse(
        model=settings.openai_model,
        input=[
            {
                "role": "system",
                "content": (
                    "Bạn giải câu hỏi từ ảnh chính xác và ngắn gọn. Xác định câu hỏi, kể cả công thức "
                    "và lựa chọn. Trả lời đúng ngôn ngữ được yêu cầu. Nếu ảnh thiếu dữ kiện, nói rõ "
                    "trong answer/explanation và giảm confidence. Không bịa nội dung ngoài ảnh."
                ),
            },
            {
                "role": "user",
                "content": [
                    {"type": "input_text", "text": f"Giải câu hỏi trong ảnh. Ngôn ngữ trả lời: {language}."},
                    {"type": "input_image", "image_url": image_url, "detail": "high"},
                ],
            },
        ],
        text_format=SolveResult,
    )
    if response.output_parsed is None:
        raise RuntimeError("OpenAI không trả về kết quả có cấu trúc.")
    return response.output_parsed
