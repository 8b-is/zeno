"""
Kintsugi Pack — incremental, content-addressed kompression of the sealed chain.

The zeno × wupz bridge (see ``spec/WUPZ_BRIDGE.md``). Three ideas come from
8b-is/wupz — fixed windows keep a change's blast radius local, every window is
content-addressed, and only what moved is re-packed. They are re-derived here
in stdlib Python under zeno's MIT licence. wupz is AGPL-3.0-only; none of its
code is copied, linked, or imported.

What zeno adds is the reason the incremental rule is *cheap*: the Kintsugi
ledger is append-only and hash-linked. If the previous pack's head seal still
sits at the same height in the new chain, every block below it is unchanged
(each seal covers the previous seal, and each verified merkle root covers its
transactions). So every *full* window of the previous pack is reused verbatim,
without being re-serialised or re-compressed; only the tail window and new
blocks are packed. If the head seal moved, history was rewritten — that is
refused, not re-packed.
"""

import hashlib
import json
import struct
import zlib
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Sequence, Tuple, Union

from .ledger import ZenoLedger

FORMAT = "zeno-kintsugi-pack/1"
MAGIC = b"ZKP1"
DEFAULT_WINDOW = 16
GENESIS_HASH = ZenoLedger.GENESIS_HASH
GATE_0X62 = 0x62
WUPZ_FRAME_ABI_V1 = 0x01


def xor_fold(data: bytes) -> int:
    """wupz-compatible 64-bit little-endian XOR fold (8-byte LE words + trailing bytes)."""
    acc = 0
    full_len = len(data) & ~7
    for i in range(0, full_len, 8):
        acc ^= int.from_bytes(data[i : i + 8], "little")
    for b in data[full_len:]:
        acc ^= b
    return acc & 0xFFFFFFFFFFFFFFFF


def seal_frame_32b(raw: bytes, packed: bytes, gate: int = GATE_0X62) -> bytes:
    """Build a 32-byte wupz frame seal hardened at the 0x62 gate against amplitude spikes.

    Wire layout (32 bytes, little-endian):
      [0..8]   u64 LE  xor_fold(raw)
      [8..16]  u64 LE  xor_fold(packed)
      [16..20] u32 LE  raw_len & 0xFFFFFFFF
      [20..24] u32 LE  packed_len & 0xFFFFFFFF
      [24]     u8      gate byte (default 0x62)
      [25]     u8      ABI v1 + ternary verified signal clamp (0x01)
      [26..32] 6B LE   48-bit prefix seal = xor_fold(frame[0..26]).to_le_bytes()[0..6]
    """
    frame = bytearray(32)
    frame[0:8] = xor_fold(raw).to_bytes(8, "little")
    frame[8:16] = xor_fold(packed).to_bytes(8, "little")
    frame[16:20] = (len(raw) & 0xFFFFFFFF).to_bytes(4, "little")
    frame[20:24] = (len(packed) & 0xFFFFFFFF).to_bytes(4, "little")
    frame[24] = gate & 0xFF
    frame[25] = WUPZ_FRAME_ABI_V1
    prefix_fold = xor_fold(bytes(frame[0:26])).to_bytes(8, "little")
    frame[26:32] = prefix_fold[0:6]
    return bytes(frame)


def verify_frame_32b(frame: bytes, raw: bytes, packed: bytes, gate: int = GATE_0X62) -> bool:
    """Constant-shape verification of a 32-byte 0x62-gated wupz frame seal."""
    if len(frame) != 32 or frame[24] != (gate & 0xFF) or frame[25] != WUPZ_FRAME_ABI_V1:
        return False
    expected = seal_frame_32b(raw, packed, gate=gate)
    diff = 0
    for a, b in zip(frame, expected):
        diff |= a ^ b
    return diff == 0


def kompress_super_ultra(raw: bytes, gate: int = GATE_0X62) -> Dict[str, Any]:
    """Compress and seal a high-density payload through the 0x62-gated 32B wupz pipeline."""
    packed = zlib.compress(raw, 9)
    frame = seal_frame_32b(raw, packed, gate=gate)
    verified = verify_frame_32b(frame, raw, packed, gate=gate)
    return {
        "gate": f"0x{gate & 0xFF:02x}",
        "rawLen": len(raw),
        "packedLen": len(packed),
        "ratio": f"{len(raw)}/{len(packed)}",
        "rawFold": f"0x{xor_fold(raw):016x}",
        "packedFold": f"0x{xor_fold(packed):016x}",
        "frameSeal32b": frame.hex(),
        "verified": verified,
        "signalState": 1 if verified else -1,
    }


class PackError(ValueError):
    """A pack could not be built or read."""


class HistoryRewriteError(PackError):
    """A block below the previous pack's head changed. Sealed history is
    append-only; a rewrite is refused rather than re-packed."""


class PackIntegrityError(PackError):
    """A pack's bytes, hashes, or chain do not verify."""


def _canonical(obj: Any) -> bytes:
    return json.dumps(obj, sort_keys=True, separators=(",", ":")).encode("utf-8")


def _merkle_root(transactions: List[Dict[str, Any]]) -> str:
    # Mirrors ZenoLedger.compute_merkle_root over the block's dict form.
    if not transactions:
        return GENESIS_HASH
    hashes = [
        hashlib.sha256(json.dumps(tx, sort_keys=True).encode("utf-8")).hexdigest()
        for tx in transactions
    ]
    return hashlib.sha256("".join(hashes).encode("utf-8")).hexdigest()


def verify_blocks(blocks: Sequence[Dict[str, Any]]) -> None:
    """Check linkage, indices, seals, and merkle roots of a chain in dict form.

    Stricter than ``ZenoLedger.verify_chain``: it also recomputes each merkle
    root from the transactions, so the head seal transitively covers content.
    """
    prev = GENESIS_HASH
    for i, b in enumerate(blocks):
        try:
            idx, ts, prev_hash = b["blockIndex"], b["timestamp"], b["previousHash"]
            m_root, txs, seal = b["merkleRoot"], b["transactions"], b["seal"]
        except (KeyError, TypeError) as exc:
            raise PackIntegrityError(f"block {i}: malformed ({exc!r})") from None
        if idx != i + 1:
            raise PackIntegrityError(f"block {i}: index {idx}, expected {i + 1}")
        if prev_hash != prev:
            raise PackIntegrityError(f"block {idx}: broken link to previous seal")
        if _merkle_root(txs) != m_root:
            raise PackIntegrityError(f"block {idx}: merkle root does not match transactions")
        expected = hashlib.sha256(f"{prev_hash}|{idx}|{ts}|{m_root}".encode("utf-8")).hexdigest()
        if seal != expected:
            raise PackIntegrityError(f"block {idx}: seal does not verify")
        prev = seal


@dataclass(frozen=True)
class PackedWindow:
    index: int
    first_block: int  # blockIndex of the window's first block (1-based)
    count: int
    raw_sha256: str  # content address of the canonical, uncompressed bytes
    raw_len: int
    data: bytes  # zlib-compressed canonical JSON array of the window's blocks
    frame_seal_32b: str = ""  # 32B 0x62-gated wupz frame seal (hex)

    def manifest(self) -> Dict[str, Any]:
        m: Dict[str, Any] = {
            "index": self.index,
            "firstBlock": self.first_block,
            "count": self.count,
            "rawSha256": self.raw_sha256,
            "rawLen": self.raw_len,
            "packedLen": len(self.data),
        }
        if self.frame_seal_32b:
            m["frameSeal32b"] = self.frame_seal_32b
        return m


@dataclass(frozen=True)
class PackStats:
    windows_total: int
    windows_repacked: int
    raw_bytes_packed: int  # canonical bytes serialised in *this* pass
    packed_bytes_total: int

    @property
    def windows_reused(self) -> int:
        return self.windows_total - self.windows_repacked

    @property
    def reuse_ratio(self) -> float:
        """Fraction of windows reused verbatim — ``1.0`` means nothing moved."""
        if self.windows_total == 0:
            return 1.0
        return self.windows_reused / self.windows_total


@dataclass(frozen=True)
class KintsugiPack:
    window_size: int
    block_count: int
    head_seal: str
    windows: Tuple[PackedWindow, ...]

    def manifest(self) -> Dict[str, Any]:
        return {
            "format": FORMAT,
            "windowSize": self.window_size,
            "blockCount": self.block_count,
            "headSeal": self.head_seal,
            "windows": [w.manifest() for w in self.windows],
        }

    def to_bytes(self) -> bytes:
        """``MAGIC | u32 BE header length | canonical manifest | window data…``"""
        header = _canonical(self.manifest())
        return MAGIC + struct.pack(">I", len(header)) + header + b"".join(w.data for w in self.windows)

    @classmethod
    def from_bytes(cls, blob: bytes) -> "KintsugiPack":
        """Parse a serialised pack. Structure only — call :func:`unpack` to
        verify content and chain."""
        if blob[:4] != MAGIC or len(blob) < 8:
            raise PackIntegrityError("not a Kintsugi pack")
        (hlen,) = struct.unpack(">I", blob[4:8])
        try:
            m = json.loads(blob[8 : 8 + hlen].decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            raise PackIntegrityError("unreadable manifest") from None
        if not isinstance(m, dict) or m.get("format") != FORMAT:
            raise PackIntegrityError("unsupported pack format")
        try:
            pos = 8 + hlen
            windows = []
            for w in m["windows"]:
                end = pos + w["packedLen"]
                if end > len(blob):
                    raise PackIntegrityError("truncated pack")
                windows.append(
                    PackedWindow(
                        index=w["index"],
                        first_block=w["firstBlock"],
                        count=w["count"],
                        raw_sha256=w["rawSha256"],
                        raw_len=w["rawLen"],
                        data=blob[pos:end],
                        frame_seal_32b=w.get("frameSeal32b", ""),
                    )
                )
                pos = end
            if pos != len(blob):
                raise PackIntegrityError("trailing bytes after last window")
            return cls(
                window_size=m["windowSize"],
                block_count=m["blockCount"],
                head_seal=m["headSeal"],
                windows=tuple(windows),
            )
        except (KeyError, TypeError):
            raise PackIntegrityError("malformed manifest") from None


import ctypes


def _zeroize_bytes_buffer(buf: bytes) -> None:
    """Scrub a non-interned CPython bytes buffer in place before dropping reference (`ZA-0009`)."""
    if not isinstance(buf, bytes) or len(buf) < 8:
        return
    try:
        header = ctypes.string_at(id(buf), 64)
        idx = header.find(buf[:8])
        if idx != -1:
            ctypes.memset(id(buf) + idx, 0, len(buf))
    except Exception:
        pass


def _pack_window(index: int, blocks: Sequence[Dict[str, Any]]) -> PackedWindow:
    raw = _canonical(list(blocks))
    try:
        raw_sha256 = hashlib.sha256(raw).hexdigest()
        raw_len = len(raw)
        compressed = zlib.compress(raw, 9)
        seal_32b = seal_frame_32b(raw, compressed, gate=GATE_0X62).hex()
        return PackedWindow(
            index=index,
            first_block=blocks[0]["blockIndex"],
            count=len(blocks),
            raw_sha256=raw_sha256,
            raw_len=raw_len,
            data=compressed,
            frame_seal_32b=seal_32b,
        )
    finally:
        _zeroize_bytes_buffer(raw)
        raw = b""


def pack(
    source: Union[ZenoLedger, Sequence[Dict[str, Any]]],
    previous: Optional[KintsugiPack] = None,
    window_size: Optional[int] = None,
) -> Tuple[KintsugiPack, PackStats]:
    """Pack a sealed chain into fixed windows of ``window_size`` blocks.

    With ``previous``, full windows are reused verbatim and only the tail is
    re-packed — after checking that the previous head seal is still in place.
    """
    blocks = [b.to_dict() for b in source.chain] if isinstance(source, ZenoLedger) else list(source)
    verify_blocks(blocks)

    if window_size is None:
        window_size = previous.window_size if previous else DEFAULT_WINDOW
    if window_size < 1:
        raise PackError("window_size must be >= 1")

    reused: List[PackedWindow] = []
    if previous is not None:
        if previous.window_size != window_size:
            raise PackError("window_size must match the previous pack")
        n = previous.block_count
        if n > len(blocks):
            raise HistoryRewriteError(f"chain shrank from {n} to {len(blocks)} blocks")
        if n and blocks[n - 1]["seal"] != previous.head_seal:
            raise HistoryRewriteError(f"head seal at block {n} moved since the previous pack")
        reused = [w for w in previous.windows if w.count == window_size]

    start = len(reused) * window_size
    fresh = [
        _pack_window(len(reused) + k, blocks[i : i + window_size])
        for k, i in enumerate(range(start, len(blocks), window_size))
    ]
    windows = tuple(reused + fresh)
    result = KintsugiPack(
        window_size=window_size,
        block_count=len(blocks),
        head_seal=blocks[-1]["seal"] if blocks else GENESIS_HASH,
        windows=windows,
    )
    stats = PackStats(
        windows_total=len(windows),
        windows_repacked=len(fresh),
        raw_bytes_packed=sum(w.raw_len for w in fresh),
        packed_bytes_total=sum(len(w.data) for w in windows),
    )
    return result, stats


def unpack(p: KintsugiPack) -> List[Dict[str, Any]]:
    """Decompress every window, check its content address, then verify the
    whole chain and the head seal. Returns the blocks in dict form.
    Scrubs `raw` bytes on both normal and `PackIntegrityError` paths (`ZA-0009`)."""
    blocks: List[Dict[str, Any]] = []
    raw: bytes = b""
    try:
        for i, w in enumerate(p.windows):
            if w.index != i or w.first_block != len(blocks) + 1:
                raise PackIntegrityError(f"window {i}: out of order")
            try:
                raw = zlib.decompress(w.data)
            except zlib.error:
                raise PackIntegrityError(f"window {i}: corrupt data") from None
            if len(raw) != w.raw_len or hashlib.sha256(raw).hexdigest() != w.raw_sha256:
                _zeroize_bytes_buffer(raw)
                raw = b""
                raise PackIntegrityError(f"window {i}: content address mismatch")
            if w.frame_seal_32b:
                try:
                    seal_bytes = bytes.fromhex(w.frame_seal_32b)
                except ValueError:
                    _zeroize_bytes_buffer(raw)
                    raw = b""
                    raise PackIntegrityError(f"window {i}: malformed 0x62 32B frame seal") from None
                if not verify_frame_32b(seal_bytes, raw, w.data, gate=GATE_0X62):
                    _zeroize_bytes_buffer(raw)
                    raw = b""
                    raise PackIntegrityError(f"window {i}: 0x62 gate 32B frame seal trip")
            chunk = json.loads(raw.decode("utf-8"))
            _zeroize_bytes_buffer(raw)
            raw = b""
            if len(chunk) != w.count or (i < len(p.windows) - 1 and w.count != p.window_size):
                chunk.clear()
                raise PackIntegrityError(f"window {i}: wrong block count")
            blocks.extend(chunk)
        if len(blocks) != p.block_count:
            raise PackIntegrityError("block count does not match manifest")
        verify_blocks(blocks)
        head = blocks[-1]["seal"] if blocks else GENESIS_HASH
        if head != p.head_seal:
            raise PackIntegrityError("head seal does not match manifest")
        return blocks
    except PackIntegrityError:
        _zeroize_bytes_buffer(raw)
        raw = b""
        blocks.clear()
        raise
