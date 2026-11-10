from pincode_lookup import resolve_from_post_offices, PINCODE_OVERRIDES


SAMPLE_502103 = [
    {
        "Name": "Ambedkarnagar",
        "BranchType": "Branch Office directly a/w Head Office",
        "District": "Medak",
        "Division": "Medak",
        "Block": "Siddipet",
        "State": "Telangana",
        "Pincode": "502103",
    },
    {
        "Name": "Siddipet",
        "BranchType": "Head Post Office",
        "District": "Medak",
        "Division": "Medak",
        "Block": "Siddipet",
        "State": "Telangana",
        "Pincode": "502103",
    },
]


def test_502103_resolves_to_siddipet_not_medak():
    resolved = resolve_from_post_offices(SAMPLE_502103, "502103")
    assert resolved is not None
    assert resolved["city"] == "Siddipet"
    assert resolved["state"] == "Telangana"
    assert resolved["city"].lower() != "medak"


def test_override_table_has_502103():
    assert PINCODE_OVERRIDES["502103"]["city"] == "Siddipet"


def test_prefers_block_when_district_lags():
    offices = [
        {
            "Name": "Some Colony",
            "BranchType": "Sub Post Office",
            "District": "Medak",
            "Block": "Siddipet",
            "State": "Telangana",
            "Pincode": "502103",
        }
    ]
    resolved = resolve_from_post_offices(offices, "502103")
    assert resolved["city"] == "Siddipet"
