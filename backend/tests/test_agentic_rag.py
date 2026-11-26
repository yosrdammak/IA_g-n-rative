from app.agentic_rag import _parse_json, _parse_pdf


class FakeDocument:
    def __init__(self, page_content, metadata):
        self.page_content = page_content
        self.metadata = metadata


class FakePage:
    page_content = (
        "[IIT-001] Frais d'inscription\n"
        "Établissement : IIT | Catégorie : Admission | Niveau : Général | "
        "Source : https://iit.tn | Date de collecte : 2026-11-24\n"
        "Les frais d'inscription sont indiqués dans le règlement."
    )


class FakeLoader:
    def __init__(self, _path):
        pass

    def load(self):
        return [FakePage()]


def test_parse_pdf_extracts_sections_and_department_metadata():
    chunks, warnings = _parse_pdf(
        path=None,
        department="general",
        file_name="01_IIT_General_Admission_Reglement.pdf",
        loader=FakeLoader,
        document_type=FakeDocument,
    )

    assert warnings == []
    assert len(chunks) == 1
    assert chunks[0].metadata["id"] == "IIT-001"
    assert chunks[0].metadata["dept"] == "general"
    assert chunks[0].metadata["source"] == "https://iit.tn"
    assert "frais d'inscription" in chunks[0].page_content


def test_parse_json_accepts_embedded_json_and_uses_fallback_for_invalid_output():
    assert _parse_json('résultat: {"dept": "tic"}', {}) == {"dept": "tic"}
    assert _parse_json("not json", {"intent": "kb"}) == {"intent": "kb"}
