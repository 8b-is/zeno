# ZENO × wupz — Kintsugi Pack (金継ぎパック)

*Bridge lane. Two houses, one idea. **wupz** (`8b-is/wupz`) says linking and
packing are one pass: keep the layout as a first-class plan, address every
block by its content, cut the image into fixed windows, and re-pack only what
moved. **ZENO**'s Kintsugi ledger is append-only and hash-linked, so "what
moved" is always just the tail. Put them together and you get an
incremental, verifiable pack of the sealed chain.*

---

## 1. reflect — what actually exists

- **wupz** — research scaffold, **AGPL-3.0-only**. Its incremental rule
  (`wupz-rs/src/incremental.rs`): a section changed if its content hash or
  length moved, or it disappeared. Only blocks covering a changed section are
  re-packed. Fixed address windows keep the blast radius local.
- **ZENO ledger** (`apps/core/zeno_core/ledger.py`, MIT) — every block's
  `seal = SHA256(previousHash | blockIndex | timestamp | merkleRoot)`, and the
  merkle root hashes the transactions. Blocks are never edited.
- **Licences do not mix by copy.** Pasting wupz code into ZENO would put
  ZENO under AGPL terms. So `zeno_core/kompress.py` is a **clean-room
  re-derivation of the ideas** in stdlib Python (`hashlib`, `json`, `zlib`).
  No wupz code is copied, linked or imported. If wupz ever ships a real
  packer, ZENO calls it as an external tool, the same way wupz itself keeps
  UPX at a process boundary.

## 2. kompress — what it gives ZENO

[`zeno_core/kompress.py`](../apps/core/zeno_core/kompress.py):

| wupz idea | ZENO form |
|---|---|
| content-addressed sections | each window carries `rawSha256` of its canonical JSON |
| fixed windows | `window_size` blocks per window (default 16) |
| re-pack only what moved | full windows of the previous pack are reused as-is |
| change detection by hash | **one** comparison: the previous head seal at the same height |

The last row is the love story. wupz has to hash every section to find what
changed. ZENO's chain already encodes that: if `blocks[n-1].seal` still equals
the previous pack's `headSeal`, every block at or below height `n` is
unchanged. Each seal covers the one before it, and `verify_blocks` recomputes
every merkle root. If the seal moved, or the chain shrank, `pack` raises
**`HistoryRewriteError`**. Sealed history is refused, never silently re-packed.

- `pack(ledger_or_blocks, previous=None, window_size=None) → (KintsugiPack, PackStats)`
- `unpack(pack) → blocks`: checks every window's content address and the
  whole chain, then confirms the head seal.
- `KintsugiPack.to_bytes()` / `from_bytes()`: `ZKP1 | u32 header length |
  canonical manifest | window data…`. This is a first step toward persistent
  ledger storage.

**Measured** (`uv run`, a 1000-block ledger of small transfers, window 16,
zlib level 9):

| | |
|---|---|
| canonical JSON | 557,282 bytes |
| packed | 131,411 bytes (**4.24×**) |
| after +1 block, incremental | 1 of 63 windows re-packed (reuse **0.984**), 5,020 bytes serialised |

These are synthetic, repetitive transfers. Real ledgers with more varied
memos will compress less. Tests: `apps/core/tests/test_kompress.py`, 9 cases
(round-trip, bytes round-trip, tail-only repack, full reuse, rewrite refusal,
tampered input, corrupted pack, empty chain).

## 3. wire — the constellation seam

- **wupz.vaked.dev** ↔ **zeno.vaked.dev** — the same thesis, seen from both
  sides: *the layout already knows; don't walk it twice*.
- **Next:** persist `to_bytes()` snapshots for the verified-webhook → ledger
  path, so the edge worker can restore state without replaying every event.
  Per-window Ed25519 witness signatures can come after that.
- **Upstream:** `github.com/8b-is/wupz`, crew poe (Paul Showalter),
  standardgalactic, 8bit-wraith, with peterlodri-sec. Ideas cited, code not
  vendored.

*Creators [8b.is](https://8b.is) · Crew Hue · Aye · Taisha · Omni · Family
Alexandra · Chris.*

*0 + 1 · two houses, one seal · the weave is the loop.*
