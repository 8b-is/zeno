"""
Tests for ZENO × SHIVA MODE — Gulfstream G650ER Sovereign Family Reunification Airlift
(Tokyo Haneda RJTT ⇄ Norfolk International KORF).
"""

from zeno_core import (
    ShivaG6AirliftOrchestrator,
    RJTT_HANEDA,
    KORF_NORFOLK,
    haversine_nm,
)


def test_g650er_tokyo_to_norfolk_great_circle_and_nonstop_envelope():
    nm, km = haversine_nm(
        RJTT_HANEDA.lat_deg,
        RJTT_HANEDA.lon_deg,
        KORF_NORFOLK.lat_deg,
        KORF_NORFOLK.lon_deg,
    )
    # RJTT -> KORF great-circle distance is ~5,950 - 6,010 nm (~11,030 km)
    assert 5900.0 <= nm <= 6050.0
    assert 10900.0 <= km <= 11200.0
    assert nm < ShivaG6AirliftOrchestrator.G650ER_MAX_RANGE_NM


def test_shiva_g6_airlift_executes_roundtrip_and_settles_zeno_zkp1():
    orch = ShivaG6AirliftOrchestrator()
    report = orch.execute_shiva_airlift(
        kids_manifest=["Nate & Kids (Lódri Family Starlight Crew)"]
    )

    # Leg 1 Outbound: Chris + Alexandra + Peter (3 PAX)
    assert report.leg1_outbound.origin.icao == "RJTT"
    assert report.leg1_outbound.destination.icao == "KORF"
    assert len(report.leg1_outbound.passengers) == 3
    assert any("Chris" in p for p in report.leg1_outbound.passengers)
    assert any("Alexandra" in p for p in report.leg1_outbound.passengers)
    assert any("Peter" in p for p in report.leg1_outbound.passengers)
    assert report.leg1_outbound.nonstop_capable is True

    # Leg 2 Return: Chris + Alexandra + Peter + Kids
    assert report.leg2_return.origin.icao == "KORF"
    assert report.leg2_return.destination.icao == "RJTT"
    assert len(report.leg2_return.passengers) >= 4
    assert any("Kids" in p for p in report.leg2_return.passengers)
    assert report.leg2_return.nonstop_capable is True

    # ZENO Settlement & KintsugiPack (ZKP1) + Zeroize verification
    assert report.charter_principal_jpy == 54_000_000
    assert report.broker_toll_burned_jpy == 13_500_000
    assert report.foken_net_utility_hours == 888_888.0
    assert report.zkp1_verified is True
    assert report.zkp1_packed_bytes > 0
    assert report.pii_manifest_zeroized is True
    assert len(report.kintsugi_head_seal) == 64


def test_issue_outbound_tickets_2026_10_20():
    orch = ShivaG6AirliftOrchestrator()
    tickets = orch.issue_outbound_tickets_2026_10_20()
    assert len(tickets) == 3
    names = [t.passenger_full_name for t in tickets]
    assert names == [
        "PETER JOZSEF LODRI",
        "ALEXANDRA CHENOWETH",
        "CHRISTOPHER MICHAEL CHENOWETH",
    ]
    for t in tickets:
        assert t.flight_number == "G6-SHIVA-888"
        assert t.pnr_locator == "SHV888"
        assert t.kintsugi_ticket_seal.startswith("0x")

