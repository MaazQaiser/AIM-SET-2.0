from app.domain.speaker_roles import infer_speaker_role


def test_infer_speaker_role_prefers_internal_attendee_match():
    brief = {
        "internalAttendees": [
            {"id": "ae-sarah", "name": "Sarah Mendes", "role": "ae"},
        ],
        "clientAttendees": [
            {"id": "lena-ortiz", "name": "Dr. Lena Ortiz"},
        ],
    }

    assert (
        infer_speaker_role(
            speaker_id="speaker-1",
            speaker_name="Sarah",
            text="I will send a proposal with estimates in three days.",
            brief=brief,
        )
        == "ae"
    )


def test_infer_speaker_role_detects_client_attendee_match():
    brief = {
        "internalAttendees": [
            {"id": "ae-sarah", "name": "Sarah Mendes", "role": "ae"},
        ],
        "clientAttendees": [
            {"id": "lena-ortiz", "name": "Dr. Lena Ortiz"},
        ],
    }

    assert (
        infer_speaker_role(
            speaker_id="speaker-2",
            speaker_name="Dr. Lena",
            text="I own operations approval and our CIO needs to approve security.",
            brief=brief,
        )
        == "customer"
    )


def test_infer_speaker_role_detects_ae_commitment_language_without_attendees():
    assert (
        infer_speaker_role(
            speaker_id="speaker-1",
            speaker_name="Speaker",
            text="I will share estimates in three days.",
        )
        == "ae"
    )
