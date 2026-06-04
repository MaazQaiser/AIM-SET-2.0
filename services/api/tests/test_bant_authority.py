from app.domain.bant_authority import authority_status_from_title, infer_authority_from_lead_title


def test_c_suite_executive_is_confirmed():
    assert authority_status_from_title("Chief Operating Officer") == "confirmed"
    assert authority_status_from_title("CEO & Founder") == "confirmed"
    assert authority_status_from_title("C-suite executive") == "confirmed"


def test_vp_is_partial():
    assert authority_status_from_title("VP of Engineering") == "partial"


def test_unknown_title_stays_unknown():
    assert infer_authority_from_lead_title("Account Manager") == "unknown"
