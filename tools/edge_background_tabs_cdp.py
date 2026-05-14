#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Open URLs as background tabs in an already-running Microsoft Edge Beta instance
that exposes Chrome DevTools Protocol (CDP) via --remote-debugging-port.

This helper intentionally does NOT fall back to `msedge.exe --new-tab`, because
that path can activate Edge and steal focus. If CDP is unavailable it exits with
a clear diagnostic instead of opening anything.

Typical use:
  python tools/edge_background_tabs_cdp.py --diagnose
  python tools/edge_background_tabs_cdp.py --launch-hint
  python tools/edge_background_tabs_cdp.py --port 9222 --url https://example.com
  python tools/edge_background_tabs_cdp.py --file .tmp/urls.txt --delay 0.8
"""
from __future__ import annotations

import argparse
import ctypes
import json
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')
from dataclasses import dataclass
from typing import Iterable, Sequence

DEFAULT_PORTS = tuple(range(9222, 9231))
EDGE_BETA_EXE = r"C:\Program Files (x86)\Microsoft\Edge Beta\Application\msedge.exe"
EDGE_BETA_USER_DATA = r"%LOCALAPPDATA%\Microsoft\Edge Beta\User Data"


@dataclass(frozen=True)
class ForegroundWindow:
    hwnd: int
    pid: int
    title: str


class WinFocus:
    """Small Win32 focus probe. No mutation except optional restore()."""

    user32 = ctypes.WinDLL("user32", use_last_error=True)
    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)

    @classmethod
    def current(cls) -> ForegroundWindow:
        hwnd = int(cls.user32.GetForegroundWindow())
        pid = ctypes.c_ulong(0)
        if hwnd:
            cls.user32.GetWindowThreadProcessId(ctypes.c_void_p(hwnd), ctypes.byref(pid))
        length = cls.user32.GetWindowTextLengthW(ctypes.c_void_p(hwnd)) if hwnd else 0
        buf = ctypes.create_unicode_buffer(length + 1)
        if hwnd and length >= 0:
            cls.user32.GetWindowTextW(ctypes.c_void_p(hwnd), buf, length + 1)
        return ForegroundWindow(hwnd=hwnd, pid=int(pid.value), title=buf.value)

    @classmethod
    def restore(cls, hwnd: int) -> bool:
        if not hwnd:
            return False
        return bool(cls.user32.SetForegroundWindow(ctypes.c_void_p(hwnd)))


def get_json(url: str, timeout: float = 1.5):
    req = urllib.request.Request(url, headers={"User-Agent": "codex-edge-cdp-probe/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        charset = resp.headers.get_content_charset() or "utf-8"
        return json.loads(resp.read().decode(charset, errors="replace"))


def port_listening(host: str, port: int, timeout: float = 0.25) -> bool:
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


def probe_port(port: int, timeout: float = 1.5) -> dict | None:
    if not port_listening("127.0.0.1", port):
        return None
    try:
        data = get_json(f"http://127.0.0.1:{port}/json/version", timeout=timeout)
    except (urllib.error.URLError, TimeoutError, OSError, json.JSONDecodeError):
        return None
    browser = str(data.get("Browser", ""))
    ws = str(data.get("webSocketDebuggerUrl", ""))
    if not ws:
        return None
    data["_port"] = port
    data["_browser"] = browser
    return data


def find_cdp(ports: Iterable[int] = DEFAULT_PORTS) -> dict | None:
    for port in ports:
        data = probe_port(port)
        if data:
            return data
    return None


def edge_beta_commandlines() -> list[str]:
    ps = (
        "$ErrorActionPreference='SilentlyContinue';"
        "Get-CimInstance Win32_Process -Filter \"name='msedge.exe'\" | "
        "Where-Object { $_.ExecutablePath -like '*Edge Beta*' -or $_.CommandLine -like '*Edge Beta*' } | "
        "Select-Object -ExpandProperty CommandLine"
    )
    try:
        out = subprocess.check_output(
            ["powershell", "-NoProfile", "-Command", ps],
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=5,
        )
    except Exception:
        return []
    return [line.strip() for line in out.splitlines() if line.strip()]


def read_urls(args: argparse.Namespace) -> list[str]:
    urls: list[str] = []
    urls.extend(args.url or [])
    if args.file:
        with open(args.file, "r", encoding="utf-8-sig") as f:
            for line in f:
                s = line.strip()
                if s and not s.startswith("#"):
                    urls.append(s)
    # Keep order while removing exact duplicates.
    seen = set()
    unique = []
    for u in urls:
        if u not in seen:
            unique.append(u)
            seen.add(u)
    return unique


def diagnose(port: int | None) -> int:
    ports = [port] if port else list(DEFAULT_PORTS)
    fg = WinFocus.current()
    print(json.dumps({"foreground_before": fg.__dict__}, ensure_ascii=False))

    data = find_cdp(ports)
    cmdlines = edge_beta_commandlines()
    has_edge_beta = bool(cmdlines)
    has_debug_flag = any("--remote-debugging-port" in c for c in cmdlines)
    print(json.dumps({
        "edge_beta_running": has_edge_beta,
        "edge_beta_has_remote_debugging_flag": has_debug_flag,
        "probed_ports": ports,
        "cdp_available": bool(data),
        "cdp_port": data.get("_port") if data else None,
        "browser": data.get("Browser") if data else None,
        "diagnosis": (
            "CDP is available; background Target.createTarget can be used."
            if data else
            "CDP is not available on the probed ports; refusing no-focus open. Start Edge Beta with --remote-debugging-port and a non-default --user-data-dir, then retry."
        ),
        "edge_beta_commandline_sample": cmdlines[:3],
    }, ensure_ascii=False, indent=2))
    return 0 if data else 2


def open_background_tabs(port: int, urls: Sequence[str], delay: float, restore_focus: bool) -> int:
    if not urls:
        print("No URLs supplied.", file=sys.stderr)
        return 2
    data = probe_port(port)
    if not data:
        print(
            f"CDP unavailable at http://127.0.0.1:{port}. Refusing to open via focus-stealing CLI fallback.",
            file=sys.stderr,
        )
        print(
            "Required: launch Edge Beta with --remote-debugging-port and connect to that port.",
            file=sys.stderr,
        )
        return 2

    fg_before = WinFocus.current()
    from playwright.sync_api import sync_playwright  # type: ignore

    opened: list[dict] = []
    with sync_playwright() as p:
        browser = p.chromium.connect_over_cdp(f"http://127.0.0.1:{port}")
        session = browser.new_browser_cdp_session()
        try:
            for url in urls:
                result = session.send("Target.createTarget", {"url": url, "background": True})
                opened.append({"url": url, "targetId": result.get("targetId")})
                if restore_focus:
                    WinFocus.restore(fg_before.hwnd)
                if delay > 0:
                    time.sleep(delay)
        finally:
            # Do not call browser.close() here. With connect_over_cdp, closing the
            # Playwright Browser object can dispose targets created in this session
            # on some Chromium/Edge builds. Let process exit drop the transport.
            pass

    time.sleep(0.2)
    if restore_focus:
        WinFocus.restore(fg_before.hwnd)
        time.sleep(0.1)
    fg_after = WinFocus.current()
    print(json.dumps({
        "cdp_port": port,
        "browser": data.get("Browser"),
        "opened_count": len(opened),
        "opened": opened,
        "foreground_before": fg_before.__dict__,
        "foreground_after": fg_after.__dict__,
        "foreground_unchanged_hwnd": fg_before.hwnd == fg_after.hwnd,
    }, ensure_ascii=False, indent=2))
    return 0


def print_launch_hint(port: int) -> None:
    print("Recommended Edge Beta launch pattern (manual/user-reviewed):")
    print(
        f'  "{EDGE_BETA_EXE}" --remote-debugging-port={port} '
        f'--remote-allow-origins=http://127.0.0.1:{port} '
        '--user-data-dir="%LOCALAPPDATA%\\Microsoft\\Edge Beta\\CodexCdpProfile"'
    )
    print("Note: Chrome/Edge 136+ remote debugging should use a non-default user-data-dir for security isolation.")


def main(argv: Sequence[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Open Edge Beta background tabs via CDP only.")
    ap.add_argument("--port", type=int, default=None, help="CDP remote debugging port, e.g. 9222")
    ap.add_argument("--diagnose", action="store_true", help="Only detect Edge/CDP state; open nothing")
    ap.add_argument("--launch-hint", action="store_true", help="Print recommended Edge Beta CDP launch command")
    ap.add_argument("--url", action="append", help="URL to open; repeatable")
    ap.add_argument("--file", help="Text file with one URL per line")
    ap.add_argument("--delay", type=float, default=0.6, help="Delay between opens, seconds")
    ap.add_argument("--no-restore-focus", action="store_true", help="Do not attempt to restore original foreground window after each tab")
    args = ap.parse_args(argv)

    port = args.port or DEFAULT_PORTS[0]
    if args.launch_hint:
        print_launch_hint(port)
        if not args.diagnose and not args.url and not args.file:
            return 0
    if args.diagnose:
        return diagnose(args.port)

    urls = read_urls(args)
    return open_background_tabs(port, urls, args.delay, not args.no_restore_focus)


if __name__ == "__main__":
    raise SystemExit(main())
