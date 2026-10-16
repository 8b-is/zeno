#!/usr/bin/env python3
"""
ZENO Apple Wallet Multi-Pass Generator & PKCS#7 Signer
Conforms strictly to Apple PassKit Package Format Specification.

Generates & Signs 4 Sovereign Family & Corporate Passes:
1. 8b-is Crew (Hue, Aye, Taisha, Omni) — Creators (https://8b.is)
2. Mom (Alexandra Lódri) — Rose Gold Sovereign Love Vault
3. Dad (Chris Lódri) — Titanium Gold Engineering Pillar
4. 8b-is Family Research — Corporate Fleet Multi-Agent Treasury
"""

import hashlib
import json
import os
import struct
import subprocess
import sys
import tempfile
import zipfile
import zlib
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent

def create_gradient_png(width: int, height: int, c1: tuple, c2: tuple) -> bytes:
    """Generate a clean PNG gradient in pure standard Python."""
    raw = bytearray()
    r1, g1, b1 = c1
    r2, g2, b2 = c2
    
    for y in range(height):
        raw.append(0)  # Filter byte: None
        factor = y / max(height - 1, 1)
        r = int(r1 + (r2 - r1) * factor)
        g = int(g1 + (g2 - g1) * factor)
        b = int(b1 + (b2 - b1) * factor)
        for x in range(width):
            raw.extend((r, g, b, 255))
            
    idat = zlib.compress(bytes(raw), 9)
    
    def chunk(tag: bytes, data: bytes) -> bytes:
        c = struct.pack(">I", len(data)) + tag + data
        crc = struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        return c + crc
        
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")

import ctypes
import secrets

DEFAULT_DEV_PASSPHRASE = "zeno-sovereign-key-passphrase-8b-is"


def zeroize_bytes_in_place(buf: bytes) -> None:
    """Best-effort scrub of a non-interned CPython bytes buffer before drop."""
    if not isinstance(buf, bytes) or len(buf) < 8:
        return
    try:
        header = ctypes.string_at(id(buf), 64)
        idx = header.find(buf[:8])
        if idx != -1:
            ctypes.memset(id(buf) + idx, 0, len(buf))
    except Exception:
        pass


def secure_wipe_file(path: str | Path) -> None:
    """Overwrite file contents with zeroes and fsync before unlinking."""
    p = Path(path)
    if not p.exists():
        return
    try:
        size = p.stat().st_size
        if size > 0:
            with open(p, "r+b") as f:
                f.write(b"\x00" * size)
                f.flush()
                os.fsync(f.fileno())
    except OSError:
        pass
    finally:
        try:
            p.unlink(missing_ok=True)
        except OSError:
            pass


def _ensure_encrypted_keypair(cert_dir: Path, passphrase: str) -> tuple[Path, Path]:
    signer_cert = cert_dir / "pass_cert.pem"
    signer_key = cert_dir / "pass_key.pem"
    needs_regen = not (signer_cert.exists() and signer_key.exists())
    if not needs_regen:
        try:
            key_text = signer_key.read_text(encoding="utf-8", errors="ignore")
            if "-----BEGIN PRIVATE KEY-----" in key_text:
                # Upgrade legacy unencrypted PKCS#8 key in-place to AES-256 encrypted PKCS#8
                tmp_enc = cert_dir / "pass_key.enc.pem"
                res = subprocess.run(
                    [
                        "openssl", "pkcs8", "-topk8", "-v2", "aes256",
                        "-in", str(signer_key),
                        "-out", str(tmp_enc),
                        "-passout", f"pass:{passphrase}",
                    ],
                    capture_output=True,
                )
                if res.returncode == 0 and tmp_enc.exists():
                    os.chmod(tmp_enc, 0o600)
                    secure_wipe_file(signer_key)
                    tmp_enc.replace(signer_key)
        except OSError:
            pass
    else:
        cert_dir.mkdir(parents=True, exist_ok=True)
        subprocess.run(
            [
                "openssl", "req", "-x509", "-newkey", "rsa:2048",
                "-aes256",
                "-passout", f"pass:{passphrase}",
                "-keyout", str(signer_key), "-out", str(signer_cert),
                "-days", "730",
                "-subj", "/CN=Zeno Sovereign NeoBank Pass/O=8b-is Family Research/C=JP",
            ],
            check=True,
            capture_output=True,
        )
        os.chmod(signer_key, 0o600)
    return signer_cert, signer_key


def generate_signature(manifest_bytes: bytes, cert_dir: Path) -> bytes:
    """
    Generate PKCS#7 DER detached signature using OpenSSL.
    Fails closed on any OpenSSL/certificate error (never emits mock signatures)
    and securely wipes temporary manifest/signature files (`ZA-0006`).
    """
    passphrase = os.environ.get("ZENO_PASS_KEY_PASSPHRASE", DEFAULT_DEV_PASSPHRASE)
    signer_cert, signer_key = _ensure_encrypted_keypair(cert_dir, passphrase)

    fd_m, manifest_path = tempfile.mkstemp(prefix="zeno_manifest_", suffix=".json")
    os.chmod(manifest_path, 0o600)
    with os.fdopen(fd_m, "wb") as f_manifest:
        f_manifest.write(manifest_bytes)

    sig_out_path = manifest_path + ".sig"

    try:
        cmd = [
            "openssl", "smime", "-sign", "-binary",
            "-in", manifest_path,
            "-out", sig_out_path,
            "-outform", "DER",
            "-signer", str(signer_cert),
            "-inkey", str(signer_key),
            "-passin", f"pass:{passphrase}",
        ]
        res = subprocess.run(cmd, capture_output=True)
        if res.returncode != 0:
            err_msg = res.stderr.decode("utf-8", errors="replace").strip()
            raise RuntimeError(f"OpenSSL PKCS#7 signing failed (fail-closed): {err_msg}")

        with open(sig_out_path, "rb") as f_sig:
            sig_data = f_sig.read()
        if not sig_data:
            raise RuntimeError("OpenSSL PKCS#7 signing produced empty output (fail-closed)")
        return sig_data
    finally:
        secure_wipe_file(manifest_path)
        secure_wipe_file(sig_out_path)


def build_single_pass(json_filename: str, pkpass_filename: str, c1: tuple, c2: tuple, c_strip: tuple, cert_dir: Path):
    pass_json_path = HERE / json_filename
    with open(pass_json_path, "r", encoding="utf-8") as f:
        pass_data = json.load(f)

    # Inject per-build or environment-provided CSPRNG authenticationToken (ZA-0010)
    configured_token = os.environ.get("ZENO_PASS_AUTH_TOKEN", "").strip()
    if not configured_token:
        configured_token = f"zeno_pk_{secrets.token_hex(16)}"
    pass_data["authenticationToken"] = configured_token

    pkpass_path = HERE / pkpass_filename

    # Assets
    pass_bytes = json.dumps(pass_data, indent=2).encode("utf-8")
    
    icon_1x = create_gradient_png(29, 29, c1, c2)
    icon_2x = create_gradient_png(58, 58, c1, c2)
    logo_1x = create_gradient_png(160, 50, c1, c2)
    logo_2x = create_gradient_png(320, 100, c1, c2)
    strip_1x = create_gradient_png(375, 123, c_strip, c2)
    strip_2x = create_gradient_png(750, 246, c_strip, c2)

    pass_assets = {
        "pass.json": pass_bytes,
        "icon.png": icon_1x,
        "icon@2x.png": icon_2x,
        "logo.png": logo_1x,
        "logo@2x.png": logo_2x,
        "strip.png": strip_1x,
        "strip@2x.png": strip_2x,
    }

    manifest = {}
    for name, content in pass_assets.items():
        manifest[name] = hashlib.sha1(content).hexdigest()

    manifest_bytes = json.dumps(manifest, indent=2).encode("utf-8")
    try:
        signature_bytes = generate_signature(manifest_bytes, cert_dir)

        with zipfile.ZipFile(pkpass_path, "w", zipfile.ZIP_DEFLATED) as pkpass:
            for name, content in pass_assets.items():
                pkpass.writestr(name, content)
            pkpass.writestr("manifest.json", manifest_bytes)
            pkpass.writestr("signature", signature_bytes)
    finally:
        zeroize_bytes_in_place(pass_bytes)
        zeroize_bytes_in_place(manifest_bytes)

    print(f"✓ Apple Wallet Pass generated: {pkpass_filename} ({pkpass_path.stat().st_size} bytes)")
    return pkpass_path

def generate_all_passes():
    cert_dir = HERE / "certs"

    # 1. 8b-is Crew (Hue, Aye, Taisha, Omni) — Creators (Gold / Dark / Cyan)
    build_single_pass(
        "pass.json",
        "zeno_ultra.pkpass",
        (232, 176, 92), (12, 14, 19), (60, 210, 190),
        cert_dir
    )

    # 2. Mom (Alexandra) — Rose Gold Sovereign (Rose / Dark Violet / Soft Pink)
    build_single_pass(
        "pass_alexandra.json",
        "zeno_alexandra.pkpass",
        (255, 185, 195), (24, 14, 22), (240, 140, 165),
        cert_dir
    )

    # 3. Dad (Chris) — Titanium Gold Pillar (Titanium / Slate / Warm Gold)
    build_single_pass(
        "pass_chris.json",
        "zeno_chris.pkpass",
        (240, 215, 150), (16, 18, 24), (220, 180, 100),
        cert_dir
    )

    # 4. 8b-is Corporate Fleet — Platinum Obsidian (Silver / Deep Obsidian / Electric Blue)
    build_single_pass(
        "pass_8b_is.json",
        "zeno_8b_is.pkpass",
        (220, 235, 250), (6, 8, 14), (80, 160, 240),
        cert_dir
    )

    print("=== All 4 Apple Wallet passes successfully generated & PKCS#7 signed! ===")

if __name__ == "__main__":
    generate_all_passes()
