//! FeliCa wire codec + Japan-IC history parser, the native brain of the
//! physical transit reader. Kotlin only moves bytes; every decision lives here.

pub const SYSTEM_CODE_JAPAN_IC: u16 = 0x0003;
pub const SERVICE_HISTORY: u16 = 0x090f;
pub const CMD_POLLING: u8 = 0x00;
pub const RESP_POLLING: u8 = 0x01;
pub const CMD_READ_WO_ENCRYPTION: u8 = 0x06;
pub const RESP_READ_WO_ENCRYPTION: u8 = 0x07;
pub const BLOCK_SIZE: usize = 16;
pub const HISTORY_BLOCKS: usize = 20;
pub const MAX_BLOCKS_PER_READ: usize = 15;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Entry {
    pub date: String,
    pub kind: String,
    pub station_hex: String,
    pub delta: Option<i64>,
    pub balance: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct ReadResult {
    pub balance: Option<i64>,
    pub entries: Vec<Entry>,
}

pub fn build_poll_frame() -> Vec<u8> {
    vec![
        0x06,
        CMD_POLLING,
        (SYSTEM_CODE_JAPAN_IC >> 8) as u8,
        (SYSTEM_CODE_JAPAN_IC & 0xFF) as u8,
        0x00,
        0x00,
    ]
}

pub fn build_read_frame(idm: &[u8], block: u8, count: u8) -> Vec<u8> {
    let body_len = 4 + 2 * count as usize;
    let mut cmd = Vec::with_capacity(2 + idm.len() + body_len);
    cmd.push((2 + idm.len() + body_len) as u8);
    cmd.push(CMD_READ_WO_ENCRYPTION);
    cmd.extend_from_slice(idm);
    cmd.push(0x01);
    cmd.push((SERVICE_HISTORY & 0xFF) as u8);
    cmd.push((SERVICE_HISTORY >> 8) as u8);
    cmd.push(count);
    for i in 0..count {
        cmd.push(0x80);
        cmd.push(block + i);
    }
    cmd
}

/// Block payload from a READ_WO_ENCRYPTION response. The frame prefix length
/// varies by stack (Samsung answers with 13 bytes, spec prose says 12), so the
/// offset is derived: `resp.len() - count * 16`, sanity-bounded.
pub fn extract_blocks(resp: &[u8], count: usize) -> Result<Vec<u8>, String> {
    if resp.len() < 12 {
        return Err(format!("short frame len {}", resp.len()));
    }
    if resp[1] != RESP_READ_WO_ENCRYPTION {
        return Err(format!("resp code 0x{:02x} len {}", resp[1], resp.len()));
    }
    if resp[10] != 0 || resp[11] != 0 {
        return Err(format!("sf 0x{:02x}/0x{:02x}", resp[10], resp[11]));
    }
    let offset = resp.len().wrapping_sub(count * BLOCK_SIZE);
    if !(10..=16).contains(&offset) {
        return Err(format!("unexpected frame len {} for {} blocks", resp.len(), count));
    }
    Ok(resp[offset..offset + count * BLOCK_SIZE].to_vec())
}

fn be(block: &[u8], offset: usize, len: usize) -> u32 {
    let mut v = 0u32;
    for i in 0..len {
        v = (v << 8) | block[offset + i] as u32;
    }
    v
}

fn le(block: &[u8], offset: usize, len: usize) -> u32 {
    let mut v = 0u32;
    for i in (0..len).rev() {
        v = (v << 8) | block[offset + i] as u32;
    }
    v
}

fn kind_name(console: u8, process: u8) -> String {
    match (console, process) {
        (_, 0x02) => "チャージ".into(),
        (_, 0x48) => "ボーナスチャージ".into(),
        (0xc7, _) | (0xc8, _) => "物販".into(),
        (0x05, _) => "バス".into(),
        (0x16, _) => "改札".into(),
        (_, 0x01) => "改札(出場)".into(),
        (_, 0x04) => "精算".into(),
        (_, 0x07) => "新規発行".into(),
        (c, p) => format!("その他 0x{:02x}/0x{:02x}", c, p),
    }
}

/// Parse concatenated 16-byte history blocks (block 0 = newest).
/// History ends at the first block whose date word is zero.
pub fn parse_history(raw: &[u8]) -> ReadResult {
    let mut result = ReadResult::default();
    let blocks: Vec<&[u8]> = raw.chunks_exact(BLOCK_SIZE).collect();
    let used: Vec<&[u8]> = blocks
        .into_iter()
        .take_while(|b| be(b, 4, 2) != 0)
        .collect();
    for (index, block) in used.iter().enumerate() {
        let console = block[0];
        let process = block[1];
        let date_raw = be(block, 4, 2);
        let year = 2000 + (date_raw >> 9);
        let month = (date_raw >> 5) & 0x0F;
        let day = date_raw & 0x1F;
        let balance = le(block, 10, 2) as i64;
        let previous = used.get(index + 1).map(|p| le(p, 10, 2) as i64);
        result.entries.push(Entry {
            date: format!("{:04}-{:02}-{:02}", year, month, day),
            kind: kind_name(console, process),
            station_hex: format!("{:02x}-{:02x}", block[6], block[7]),
            delta: previous.map(|p| p - balance),
            balance,
        });
    }
    result.balance = result.entries.first().map(|e| e.balance);
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    fn block(console: u8, process: u8, date_raw: u16, balance: u16) -> Vec<u8> {
        let mut b = vec![0u8; 16];
        b[0] = console;
        b[1] = process;
        b[4] = (date_raw >> 8) as u8;
        b[5] = (date_raw & 0xFF) as u8;
        b[6] = 0x12;
        b[7] = 0x34;
        b[10] = (balance & 0xFF) as u8;
        b[11] = (balance >> 8) as u8;
        b
    }

    /// 2026-10-25 => yy=26, mm=10, dd=25
    const DATE: u16 = (26 << 9) | (10 << 5) | 25;

    #[test]
    fn poll_frame_is_well_formed() {
        assert_eq!(build_poll_frame(), vec![0x06, 0x00, 0x00, 0x03, 0x00, 0x00]);
    }

    #[test]
    fn read_frame_matches_the_verified_wire_layout() {
        let idm = [1, 2, 3, 4, 5, 6, 7, 8];
        let frame = build_read_frame(&idm, 0, 2);
        assert_eq!(frame[0] as usize, frame.len());
        assert_eq!(frame[1], CMD_READ_WO_ENCRYPTION);
        assert_eq!(&frame[2..10], &idm);
        assert_eq!(&frame[10..13], &[0x01, 0x0f, 0x09]);
        assert_eq!(frame[13], 2);
        assert_eq!(&frame[14..18], &[0x80, 0x00, 0x80, 0x01]);
    }

    #[test]
    fn extract_blocks_accepts_both_header_lengths() {
        let payload = [0xAAu8; 32];
        let mut resp12 = vec![0x00; 12];
        resp12[1] = RESP_READ_WO_ENCRYPTION;
        resp12.extend_from_slice(&payload);
        assert_eq!(extract_blocks(&resp12, 2).unwrap(), payload.to_vec());

        let mut resp13 = vec![0x00; 13];
        resp13[1] = RESP_READ_WO_ENCRYPTION;
        resp13.extend_from_slice(&payload);
        assert_eq!(extract_blocks(&resp13, 2).unwrap(), payload.to_vec());
    }

    #[test]
    fn extract_blocks_rejects_status_flags() {
        let mut resp = vec![0x00; 12 + 16];
        resp[1] = RESP_READ_WO_ENCRYPTION;
        resp[10] = 0xFF;
        assert!(extract_blocks(&resp, 1).is_err());
    }

    #[test]
    fn parses_balance_dates_and_fares() {
        let mut raw = block(0x16, 0x01, DATE, 241);
        raw.extend_from_slice(&block(0x16, 0x01, DATE, 461));
        raw.extend_from_slice(&block(0x00, 0x07, DATE, 1500));
        raw.extend_from_slice(&block(0x00, 0x00, 0, 0));

        let parsed = parse_history(&raw);
        assert_eq!(parsed.balance, Some(241));
        assert_eq!(parsed.entries.len(), 3);
        assert_eq!(parsed.entries[0].date, "2026-10-25");
        assert_eq!(parsed.entries[0].kind, "改札");
        assert_eq!(parsed.entries[0].delta, Some(220));
        assert_eq!(parsed.entries[2].kind, "新規発行");
        assert_eq!(parsed.entries[2].station_hex, "12-34");
    }

    #[test]
    fn charge_shows_as_positive_delta() {
        let mut raw = block(0x09, 0x02, DATE, 5000);
        raw.extend_from_slice(&block(0x16, 0x01, DATE, 241));
        let parsed = parse_history(&raw);
        assert_eq!(parsed.entries[0].kind, "チャージ");
        assert_eq!(parsed.entries[0].delta, Some(-4759));
    }
}
