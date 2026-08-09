import base64
import binascii
import hashlib
import json
import os
import re
import struct
import urllib.parse
from datetime import datetime, timezone

import boto3


PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
MAX_IMAGE_BYTES = 2 * 1024 * 1024


def _cors_headers(origin):
    allowed = [item.strip() for item in os.getenv("ALLOWED_ORIGINS", "").split(",") if item.strip()]
    parsed_origin = urllib.parse.urlparse(origin)
    local_origin = parsed_origin.scheme in ("http", "https") and parsed_origin.hostname in ("localhost", "127.0.0.1", "::1")
    allow_origin = origin if origin in allowed or local_origin else (allowed[0] if allowed else "*")
    return {
        "Access-Control-Allow-Origin": allow_origin,
        "Access-Control-Allow-Headers": "Content-Type,X-Generator-Token",
        "Access-Control-Allow-Methods": "POST,OPTIONS",
        "Vary": "Origin",
        "Content-Type": "application/json; charset=utf-8",
    }


def _response(status, payload, origin=""):
    return {"statusCode": status, "headers": _cors_headers(origin), "body": json.dumps(payload, ensure_ascii=False)}


def _request_body(event):
    raw = event.get("body") or "{}"
    if event.get("isBase64Encoded"):
        raw = base64.b64decode(raw).decode("utf-8")
    return json.loads(raw)


def _validate_png(data):
    if not data.startswith(PNG_SIGNATURE) or len(data) < 24:
        raise ValueError("Поддерживается только PNG.")
    if len(data) > MAX_IMAGE_BYTES:
        raise ValueError("PNG больше 2 МБ.")
    width, height = struct.unpack(">II", data[16:24])
    if not (600 <= width <= 1600 and 180 <= height <= 1200):
        raise ValueError("Некорректный размер PNG.")
    return width, height


def _s3_client():
    kwargs = {"service_name": "s3", "endpoint_url": os.getenv("S3_ENDPOINT", "https://storage.yandexcloud.net")}
    access_key = os.getenv("S3_ACCESS_KEY_ID")
    secret_key = os.getenv("S3_SECRET_ACCESS_KEY")
    if access_key and secret_key:
        kwargs.update(aws_access_key_id=access_key, aws_secret_access_key=secret_key)
    return boto3.session.Session().client(**kwargs)


def handler(event, context):
    del context
    headers = {str(key).lower(): value for key, value in (event.get("headers") or {}).items()}
    origin = headers.get("origin", "")
    method = (event.get("httpMethod") or event.get("requestContext", {}).get("http", {}).get("method") or "POST").upper()
    if method == "OPTIONS":
        return _response(204, {}, origin)

    expected_token = os.getenv("UPLOAD_TOKEN", "")
    if expected_token and headers.get("x-generator-token") != expected_token:
        return _response(401, {"error": "Нет доступа к загрузке."}, origin)

    try:
        payload = _request_body(event)
        image_data = base64.b64decode(payload.get("imageBase64", ""), validate=True)
        width, height = _validate_png(image_data)
        block_id = re.sub(r"[^a-zA-Z0-9_-]", "", str(payload.get("blockId", "block")))[:48] or "block"
        digest = hashlib.sha256(image_data).hexdigest()[:24]
        now = datetime.now(timezone.utc)
        object_key = f"email-assets/production/{now:%Y/%m}/{block_id}-{digest}.png"
        bucket = os.environ["S3_BUCKET"]

        _s3_client().put_object(
            Bucket=bucket,
            Key=object_key,
            Body=image_data,
            ContentType="image/png",
            CacheControl="public,max-age=31536000,immutable",
        )

        public_base = os.getenv("PUBLIC_ASSET_BASE_URL", f"https://{bucket}.website.yandexcloud.net").rstrip("/")
        public_url = f"{public_base}/{urllib.parse.quote(object_key, safe='/')}"
        return _response(200, {"url": public_url, "key": object_key, "width": width, "height": height}, origin)
    except (ValueError, TypeError, json.JSONDecodeError, binascii.Error) as error:
        return _response(400, {"error": str(error)}, origin)
    except KeyError as error:
        return _response(500, {"error": f"Не задана переменная окружения: {error.args[0]}"}, origin)
    except Exception:
        return _response(500, {"error": "Не удалось загрузить изображение в Object Storage."}, origin)
