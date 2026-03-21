import argparse
import asyncio
import signal
import sys
from pathlib import Path
from urllib.parse import urlsplit


ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from globalflow.main import app  # noqa: E402


class SimpleASGIServer:
    def __init__(self, asgi_app, host: str, port: int):
        self.app = asgi_app
        self.host = host
        self.port = port
        self.server = None
        self._stopping = asyncio.Event()

    async def handle_client(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
        try:
            request_data = await reader.readuntil(b"\r\n\r\n")
        except (asyncio.IncompleteReadError, asyncio.LimitOverrunError):
            writer.close()
            await writer.wait_closed()
            return

        header_text = request_data.decode("latin-1")
        request_line, *header_lines = header_text.split("\r\n")
        try:
            method, target, _ = request_line.split(" ", 2)
        except ValueError:
            writer.close()
            await writer.wait_closed()
            return

        headers = []
        content_length = 0
        for line in header_lines:
            if not line:
                continue
            if ":" not in line:
                continue
            name, value = line.split(":", 1)
            name = name.strip().lower()
            value = value.strip()
            headers.append((name.encode("latin-1"), value.encode("latin-1")))
            if name == "content-length":
                try:
                    content_length = int(value)
                except ValueError:
                    content_length = 0

        body = b""
        if content_length > 0:
            body = await reader.readexactly(content_length)

        parsed = urlsplit(target)
        client = writer.get_extra_info("peername") or ("127.0.0.1", 0)
        server = writer.get_extra_info("sockname") or (self.host, self.port)

        scope = {
            "type": "http",
            "asgi": {"version": "3.0", "spec_version": "2.3"},
            "http_version": "1.1",
            "method": method.upper(),
            "scheme": "http",
            "path": parsed.path or "/",
            "raw_path": (parsed.path or "/").encode("latin-1"),
            "query_string": parsed.query.encode("latin-1"),
            "headers": headers,
            "client": (client[0], client[1]),
            "server": (server[0], server[1]),
            "root_path": "",
        }

        sent_body = False
        disconnected = False
        status_code = 500
        response_headers = [(b"content-type", b"text/plain; charset=utf-8")]
        response_chunks = []

        async def receive():
            nonlocal sent_body, disconnected
            if not sent_body:
                sent_body = True
                return {"type": "http.request", "body": body, "more_body": False}
            if not disconnected:
                disconnected = True
                return {"type": "http.disconnect"}
            await asyncio.sleep(0)
            return {"type": "http.disconnect"}

        async def send(message):
            nonlocal status_code, response_headers
            if message["type"] == "http.response.start":
                status_code = message["status"]
                response_headers = message.get("headers", [])
            elif message["type"] == "http.response.body":
                response_chunks.append(message.get("body", b""))

        await self.app(scope, receive, send)

        reason_map = {
            200: "OK",
            201: "Created",
            204: "No Content",
            302: "Found",
            400: "Bad Request",
            404: "Not Found",
            500: "Internal Server Error",
            502: "Bad Gateway",
        }
        reason = reason_map.get(status_code, "OK")
        payload = b"".join(response_chunks)
        has_length = any(name.lower() == b"content-length" for name, _ in response_headers)
        has_connection = any(name.lower() == b"connection" for name, _ in response_headers)
        final_headers = list(response_headers)
        if not has_length:
            final_headers.append((b"content-length", str(len(payload)).encode("ascii")))
        if not has_connection:
            final_headers.append((b"connection", b"close"))

        writer.write(f"HTTP/1.1 {status_code} {reason}\r\n".encode("latin-1"))
        for name, value in final_headers:
            writer.write(name + b": " + value + b"\r\n")
        writer.write(b"\r\n")
        writer.write(payload)
        await writer.drain()
        writer.close()
        await writer.wait_closed()

    async def serve(self) -> None:
        await app.router.startup()
        self.server = await asyncio.start_server(self.handle_client, self.host, self.port)
        async with self.server:
            await self._stopping.wait()
        await app.router.shutdown()

    def stop(self) -> None:
        if self.server is not None:
            self.server.close()
        self._stopping.set()


async def main() -> None:
    parser = argparse.ArgumentParser(description="Run GlobalFlow without uvicorn.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()

    server = SimpleASGIServer(app, args.host, args.port)
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, server.stop)
        except NotImplementedError:
            pass

    print(f"GlobalFlow running at http://{args.host}:{args.port}")
    await server.serve()


if __name__ == "__main__":
    asyncio.run(main())
