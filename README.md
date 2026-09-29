# Browser Question Solver

Tiện ích Chrome/Edge Manifest V3 cho phép khoanh vùng câu hỏi trên trang web, chụp đúng vùng đã chọn và gửi ảnh tới FastAPI chạy cục bộ. Backend mặc định dùng **Groq Vision** và trả về JSON có cấu trúc gồm `answer`, `explanation`, `confidence`; OpenAI vẫn là tùy chọn dự phòng.

## Tính năng

- Kích hoạt bằng **Ctrl+Shift+S** (macOS: **Command+Shift+S**) hoặc nút trong popup.
- Kéo chuột để chọn vùng; ảnh được crop theo đúng tỉ lệ màn hình/zoom.
- Floating panel cách ly bằng Shadow DOM, có đáp án, giải thích, độ tin cậy và nút sao chép.
- Popup kiểm tra trạng thái backend; trang Options chỉ cho phép URL `localhost`/`127.0.0.1`.
- Timeout, lỗi API dễ hiểu, giới hạn request 8 MB và ảnh 6 MB mặc định.
- Mặc định dùng Groq `qwen/qwen3.8-27b`; có thể đổi sang OpenAI bằng biến môi trường.

## Cấu trúc

```text
browser-question-solver/
├── backend/        # FastAPI + OpenAI Responses API + pytest
├── extension/      # TypeScript + esbuild, Manifest V3
└── docker-compose.yml
```

## 1. Chạy backend

Yêu cầu Python 3.11+.

```bash
cd backend
python -m venv .venv
source .venv/bin/activate             # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
```

Mở `backend/.env` và đặt `GROQ_API_KEY`. Không truyền key qua URL, command line hoặc tiện ích.

```bash
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Kiểm tra: <http://127.0.0.1:8000/api/health>. Swagger: <http://127.0.0.1:8000/docs>.

### Chạy bằng Docker

Tạo `backend/.env` như trên, sau đó:

```bash
docker compose up --build
```

Compose chỉ publish cổng lên `127.0.0.1` của máy chủ.

## 2. Build và cài extension

Yêu cầu Node.js 20+.

```bash
cd extension
npm install
npm run build
```

### Chrome

1. Mở `chrome://extensions` và bật **Developer mode**.
2. Chọn **Load unpacked**.
3. Chọn thư mục `extension/dist`.

### Edge

1. Mở `edge://extensions` và bật **Developer mode**.
2. Chọn **Load unpacked** và mở `extension/dist`.

Nếu phím tắt bị trình duyệt/hệ điều hành chiếm, chỉnh tại `chrome://extensions/shortcuts` hoặc `edge://extensions/shortcuts`.

## 3. Sử dụng

1. Khởi động backend.
2. Mở trang chứa câu hỏi.
3. Nhấn **Ctrl+Shift+S** hoặc mở popup và chọn **Khoanh vùng câu hỏi**.
4. Kéo chuột bao quanh toàn bộ câu hỏi và các lựa chọn.
5. Xem đáp án trong panel nổi; mở **Giải thích** khi cần.

Trang hệ thống như `chrome://`, `edge://` và Chrome Web Store không cho phép extension chèn script.

## Cấu hình

Backend đọc các biến môi trường sau:

| Biến | Mặc định | Ý nghĩa |
|---|---:|---|
| `AI_PROVIDER` | `groq` | `groq` hoặc `openai` |
| `GROQ_API_KEY` | bắt buộc khi dùng Groq | API key Groq, chỉ tồn tại ở backend |
| `GROQ_MODEL` | `qwen/qwen3.8-27b` | Model Groq có khả năng vision |
| `OPENAI_API_KEY` | bắt buộc khi dùng OpenAI | API key OpenAI dự phòng |
| `OPENAI_MODEL` | `gpt-5-mini` | Model OpenAI có khả năng vision |
| `AI_TIMEOUT_SECONDS` | `45` | Timeout gọi nhà cung cấp AI |
| `MAX_REQUEST_MB` | `8` | Giới hạn request HTTP |
| `MAX_IMAGE_MB` | `6` | Giới hạn ảnh sau decode base64 |

## Bảo mật

- **Không** nhập hoặc lưu API key trong extension, `chrome.storage`, source code hay Git.
- `.env`, virtualenv, `node_modules`, cache Python và `extension/dist` đều bị Git bỏ qua.
- Extension chỉ có host permission tới HTTP localhost; backend CORS chỉ chấp nhận extension origin và localhost.
- Backend nên bind `127.0.0.1`. Nếu dùng Docker Compose, mapping cổng cũng chỉ ở `127.0.0.1`.
- Ảnh vùng chọn được gửi tới OpenAI để xử lý; tránh chọn dữ liệu nhạy cảm ngoài câu hỏi.

## Kiểm thử

```bash
cd backend
pip install -r requirements-dev.txt
pytest -q

cd ../extension
npm run typecheck
npm run build
```

Test backend mock lời gọi OpenAI, nên không cần API key và không phát sinh chi phí.
