import base64
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from app.config import Settings, get_settings
from app.main import app
from app.schemas import SolveResult

PNG_1X1 = base64.b64encode(
    b"\x89PNG\r\n\x1a\n" + b"test-image-bytes"
).decode()


def override_settings() -> Settings:
    return Settings(openai_api_key="test-key", openai_model="gpt-5-mini")


app.dependency_overrides[get_settings] = override_settings
client = TestClient(app)


def test_health():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "model": "gpt-5-mini", "configured": True}


@patch("app.main.solve_image", new_callable=AsyncMock)
def test_solve_returns_structured_result(mock_solve):
    mock_solve.return_value = SolveResult(
        answer="B. 4", explanation="2 + 2 = 4.", confidence=0.99
    )
    response = client.post(
        "/api/solve",
        json={"image": f"data:image/png;base64,{PNG_1X1}", "language": "vi"},
    )
    assert response.status_code == 200
    assert response.json() == {
        "answer": "B. 4",
        "explanation": "2 + 2 = 4.",
        "confidence": 0.99,
        "model": "gpt-5-mini",
    }
    mock_solve.assert_awaited_once()


def test_rejects_invalid_base64():
    response = client.post("/api/solve", json={"image": "not-base64!!!"})
    assert response.status_code == 400
    assert "base64" in response.json()["detail"]


def test_requires_image():
    response = client.post("/api/solve", json={})
    assert response.status_code == 422
