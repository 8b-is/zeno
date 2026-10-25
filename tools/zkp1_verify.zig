//! Independent ZKP1 receipt verifier (third implementation, after the Node
//! worker and the Rust native core). Checks the sealed container bytes
//! against constellation.json: size, SHA-256 seal and savings arithmetic.
//!
//!   zig run tools/zkp1_verify.zig -- <container.zkp1> <constellation.json>

const std = @import("std");

fn readAllAlloc(allocator: std.mem.Allocator, path: []const u8, max: usize) ![]u8 {
    // Short-lived verifier CLI: the fd is reclaimed at process exit.
    const fd = try std.posix.openat(std.posix.AT.FDCWD, path, .{ .ACCMODE = .RDONLY }, 0);
    var out = std.ArrayList(u8).empty;
    errdefer out.deinit(allocator);
    var buf: [8192]u8 = undefined;
    while (true) {
        const n = try std.posix.read(fd, &buf);
        if (n == 0) break;
        try out.appendSlice(allocator, buf[0..n]);
        if (out.items.len > max) return error.FileTooBig;
    }
    return try out.toOwnedSlice(allocator);
}

pub fn main(init: std.process.Init) !void {
    const allocator = init.gpa;

    var it = try std.process.Args.Iterator.initAllocator(init.minimal.args, allocator);
    defer it.deinit();
    _ = it.skip();
    const container_path = it.next();
    const registry_path = it.next();
    if (container_path == null or registry_path == null) {
        std.debug.print("usage: zkp1_verify <container.zkp1> <constellation.json>\n", .{});
        std.process.exit(2);
    }

    const blob = try readAllAlloc(allocator, container_path.?, 64 * 1024 * 1024);
    var digest: [32]u8 = undefined;
    std.crypto.hash.sha2.Sha256.hash(blob, &digest, .{});
    const hex_buf = std.fmt.bytesToHex(digest, .lower);
    const hex: []const u8 = &hex_buf;

    const json_text = try readAllAlloc(allocator, registry_path.?, 8 * 1024 * 1024);
    const parsed = try std.json.parseFromSlice(std.json.Value, allocator, json_text, .{});
    const packs = parsed.value.object.get("packs").?.array;
    const pack = packs.items[0].object;
    const sealed: i64 = pack.get("sealedBytes").?.integer;
    const raw: i64 = pack.get("rawBytes").?.integer;
    const sha = pack.get("sha256Sealed").?.string;
    const savings = pack.get("savingsPercent").?.float;

    var ok = true;
    if (blob.len != sealed) {
        std.debug.print("FAIL size: container {d} B != registry {d} B\n", .{ blob.len, sealed });
        ok = false;
    }
    if (!std.mem.eql(u8, hex, sha)) {
        std.debug.print("FAIL seal: container {s} != registry {s}\n", .{ hex, sha });
        ok = false;
    }
    const computed = (1.0 - @as(f64, @floatFromInt(sealed)) / @as(f64, @floatFromInt(raw))) * 100.0;
    if (@abs(computed - savings) > 0.01) {
        std.debug.print("FAIL savings: computed {d:.2}% != registry {d}%\n", .{ computed, savings });
        ok = false;
    }

    if (ok) {
        std.debug.print(
            "PASS zkp1 {d} B sealed · sha256 {s} · savings {d:.2}%\n",
            .{ blob.len, hex, computed },
        );
    }
    std.process.exit(if (ok) 0 else 1);
}
