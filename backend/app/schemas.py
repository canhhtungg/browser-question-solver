from pydantic import BaseModel, Field, field_validator, model_validator


class SolveRequest(BaseModel):
    image: str = Field(description="JPEG/PNG data URL or bare base64")
    language: str = Field(default="vi", max_length=10)

    @field_validator("image")
    @classmethod
    def image_must_not_be_empty(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("image must not be empty")
        return value.strip()


class SolveResult(BaseModel):
    answer: str = Field(min_length=1, max_length=4000)
    explanation: str = Field(min_length=1, max_length=12000)
    confidence: float = Field(ge=0, le=1)


class SolveResponse(SolveResult):
    provider: str
    model: str


class ErrorResponse(BaseModel):
    detail: str
