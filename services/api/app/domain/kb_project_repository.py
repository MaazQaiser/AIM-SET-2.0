from __future__ import annotations

import csv
import hashlib
import html
import io
import re
import time
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

from dc_core.tenancy import TenantContext

from app.domain.kb_repository import get_kb_repository
from app.domain.kb_tenancy import resolve_kb_tenant

PROJECT_TITLE_KEYS = (
    "project name",
    "project",
    "customer project",
    "client project",
    "opportunity name",
    "name",
    "title",
)

PROJECT_EXCLUDED_FIELD_KEYS = {"case study"}

COMPANY_KEYS = (
    "company name",
    "account name",
    "company",
    "client name",
    "client",
    "customer",
)

IMPORTANT_FIELDS = {
    "problemStatement": ("problem statement", "problem", "challenge"),
    "businessOutcome": ("business outcome completed by ae", "business outcome", "outcome"),
    "functionalSolution": ("functional solution", "solution overview"),
    "technicalSolution": ("technical solution", "technical approach"),
    "industry": ("linkedin industry", "industry"),
    "sector": ("linkedin category / sector", "category", "sector"),
    "domain": ("domain",),
    "subDomain": ("sub domain", "subdomain"),
    "companyStage": ("company stage", "company stage test", "stage"),
    "startDate": ("project actual start date", "actual start date", "start date"),
    "endDate": ("project agreed end date", "agreed end date", "end date"),
    "definitionsUrl": ("definitions & examples", "definitions and examples", "examples"),
}

PROJECT_ASSET_HINTS = ("project", "sale enablement")
PROJECT_CACHE_TTL_SECONDS = 60
PROJECT_SUMMARY_PLACEHOLDER = "No project summary indexed yet."
_PROJECT_CACHE: Dict[str, Tuple[float, Tuple[str, ...], List[Dict[str, Any]]]] = {}


def _norm_key(value: str) -> str:
    return " ".join(value.replace("_", " ").replace("-", " ").strip().lower().split())


def _clean_text(value: Any) -> str:
    text = str(value or "").replace("\ufeff", "").replace("\u00a0", " ").strip()
    if not text or text.upper() in {"N/A", "NA", "NONE", "NULL", "-"}:
        return ""
    text = html.unescape(text)
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"</p\s*>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    text = text.replace("\\n", "\n")
    text = re.sub(r"[ \t\r\f\v]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _field_lookup(fields: Dict[str, Any], keys: Iterable[str]) -> str:
    normalized = {_norm_key(k): _clean_text(v) for k, v in fields.items()}
    for key in keys:
        value = normalized.get(_norm_key(key))
        if value:
            return value
    return ""


def _decode_csv(file_bytes: bytes) -> str:
    errors: List[str] = []
    for encoding in ("utf-8-sig", "cp1252", "latin-1"):
        try:
            return file_bytes.decode(encoding)
        except UnicodeDecodeError as exc:
            errors.append(f"{encoding}: {exc}")
    raise UnicodeDecodeError("utf-8", file_bytes, 0, 1, "; ".join(errors))


def _parse_csv_rows(file_bytes: bytes) -> List[Dict[str, str]]:
    text = _decode_csv(file_bytes)
    if not text.strip():
        return []

    sample = text[:4096]
    try:
        dialect = csv.Sniffer().sniff(sample)
    except csv.Error:
        dialect = csv.excel

    reader = csv.DictReader(io.StringIO(text), dialect=dialect)
    rows: List[Dict[str, str]] = []
    for row in reader:
        cleaned = {
            _clean_text(key): _clean_text(value)
            for key, value in (row or {}).items()
            if _clean_text(key) and _clean_text(value)
        }
        if cleaned:
            rows.append(cleaned)
    return rows


def _parse_field_line(line: str) -> Dict[str, str]:
    fields: Dict[str, str] = {}
    for part in line.split(";"):
        if ":" not in part:
            continue
        key, value = part.split(":", 1)
        key = _clean_text(key)
        value = _clean_text(value)
        if key and value:
            fields[key] = value
    return fields


def _parse_chunk_rows(chunks: List[Dict[str, Any]]) -> List[Dict[str, str]]:
    rows: List[Dict[str, str]] = []
    for chunk in sorted(chunks, key=lambda c: int(c.get("chunk_index") or 0)):
        text = str(chunk.get("chunk_text") or "")
        for line in text.splitlines():
            fields = _parse_field_line(line)
            if fields:
                rows.append(fields)
        if not rows:
            fields = _parse_field_line(text)
            if fields:
                rows.append(fields)
    return rows


def _asset_is_projectish(asset: Dict[str, Any]) -> bool:
    haystack = " ".join(
        [
            str(asset.get("title") or ""),
            str(asset.get("fileName") or ""),
            str(asset.get("file_name") or ""),
            str(asset.get("type") or ""),
            " ".join(str(tag) for tag in asset.get("tags") or []),
        ]
    ).lower()
    return any(hint in haystack for hint in PROJECT_ASSET_HINTS)


def _is_csv_asset(asset: Dict[str, Any]) -> bool:
    file_name = str(asset.get("fileName") or asset.get("file_name") or "")
    mime = str(asset.get("mimeType") or asset.get("mime_type") or "").lower()
    return Path(file_name).suffix.lower() == ".csv" or "csv" in mime


def _slug(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug[:72] or "project"


def _project_id(company: str, title: str) -> str:
    raw = f"{company.lower()}::{title.lower()}".encode("utf-8")
    return f"kbproj-{_slug(title)}-{hashlib.sha1(raw).hexdigest()[:10]}"


def _compact(value: str, limit: int = 260) -> str:
    text = re.sub(r"\s+", " ", value).strip()
    if len(text) <= limit:
        return text
    return f"{text[: limit - 3].rstrip()}..."


def _project_lookup_key(value: Any) -> str:
    return _norm_key(str(value or ""))


def _looks_like_url(value: str) -> bool:
    return value.lower().startswith(("http://", "https://"))


def _is_noise_project_segment(segment: str) -> bool:
    normalized = _norm_key(segment)
    if not normalized:
        return True
    if normalized in {
        "xp",
        "cb",
        "ui/ux",
        "ui ux",
        "uiux",
        "dedicated team",
        "fixed price",
        "design",
        "branding",
        "engineering",
        "discovery",
        "discovery workshop",
        "pre assessment",
        "pre assesment",
        "additional project",
    }:
        return True
    if re.fullmatch(r"(?:sow|po)(?:\s*#?\s*[\w-]+)?", normalized, flags=re.IGNORECASE):
        return True
    if re.fullmatch(r"\d+(?:\s*-\s*\d+)*", normalized):
        return True
    if re.fullmatch(r"[a-z]{0,4}\s*\d{3,}(?:\s*-\s*\d+)*", normalized, flags=re.IGNORECASE):
        return True
    return False


def _fallback_title_from_metadata(
    important: Dict[str, str],
    company: str,
    raw_title: str,
) -> str:
    for key in ("domain", "subDomain", "functionalSolution", "technicalSolution", "industry", "sector"):
        value = _clean_text(important.get(key))
        if value and not _looks_like_url(value):
            suffix = "" if "project" in value.lower() else " Project"
            return _compact(f"{value}{suffix}", 96)
    if company:
        return company
    return raw_title


def _clean_project_display_title(
    value: Any,
    *,
    company: str = "",
    important: Optional[Dict[str, str]] = None,
) -> str:
    raw_title = _clean_text(value)
    if not raw_title:
        return ""

    important = important or {}
    title = re.sub(r"https?://\S+", " ", raw_title).strip()
    if not title:
        return _fallback_title_from_metadata(important, company, raw_title)

    title = re.sub(
        r"\(\s*(?:\d[\d\s-]*|design|ui\s*/?\s*ux|fixed price|branding|discovery)\s*\)",
        " ",
        title,
        flags=re.IGNORECASE,
    )
    title = re.sub(
        r"\bSOW\s*[-#]?\s*\d*(?:-\d+)*(?:\s*\([^)]*\))?",
        " ",
        title,
        flags=re.IGNORECASE,
    )
    title = re.sub(r"\bPO\s*#?\s*\d*\b", " ", title, flags=re.IGNORECASE)
    title = re.sub(r"^([A-Z]{2,5})\s*-\s*", r"\1 - ", title)
    title = re.sub(r"(?<=[A-Za-z])-\s+(?=[A-Z][A-Za-z])", " - ", title)

    segments = [
        segment.strip(" -,:#")
        for segment in re.split(r"\s+-\s+", title)
        if segment.strip(" -,:#")
    ]
    useful_segments = [segment for segment in segments if not _is_noise_project_segment(segment)]

    if useful_segments:
        if len(useful_segments) == 2 and not useful_segments[0].isupper():
            title = " ".join(useful_segments)
        else:
            title = " - ".join(useful_segments)

    title = re.sub(r"\b(?:SOW|PO)\b\s*#?\s*", " ", title, flags=re.IGNORECASE)
    title = re.sub(r"\b\d{3,}(?:-\d+)*\b", " ", title)
    title = re.sub(r"\s+\d+\s*$", "", title)
    title = re.sub(r"\s+", " ", title).strip(" -,:#")
    return title or _fallback_title_from_metadata(important, company, raw_title)


INDUSTRY_NORMALIZATIONS = {
    "information technology & services": "Software & IT Services",
    "information technology and services": "Software & IT Services",
    "software & i": "Software & IT Services",
    "software and it services": "Software & IT Services",
}

PROJECT_VERTICAL_OVERRIDES = {
    _project_lookup_key(title): metadata
    for title, metadata in (
        ("XTM - UI/UX", {"industry": "Financial Services", "domain": "Workforce Payments"}),
        ("XP-ZYVLY-SOW#8 (47204-1)", {"industry": "Software & IT Services", "domain": "Custom Application Development"}),
        ("XP-Care- AI Like Me -SOW-43395-1", {"industry": "Healthcare", "domain": "AI Care Companion"}),
        ("XP - Smile APP - 19915 - 3", {"industry": "Software & IT Services", "domain": "Mobile App Development"}),
        ("Volantio - Dedicated Team - SOW#1", {"industry": "Aviation & Travel", "domain": "Airline Operations"}),
        ("Vocable", {"industry": "Marketing & Advertising", "domain": "Content Marketing"}),
        ("VisionInvest- SOW#1 PO#00095", {"industry": "Financial Services", "domain": "Enterprise AI & Data Intelligence"}),
        ("VisionInvest- SOW#1 PO#", {"industry": "Financial Services", "domain": "Enterprise AI & Data Intelligence"}),
        ("Tkxel - Payit", {"industry": "Financial Services", "domain": "Digital Payments"}),
        ("The REACH Institute", {"industry": "Healthcare", "domain": "Behavioral Health Training"}),
        ("Terravirtua", {"industry": "Media & Entertainment", "domain": "Digital Collectibles"}),
        ("Swaay Media", {"industry": "Media & Publishing", "domain": "Digital Media Platform"}),
        ("Super Soccer Stars", {"industry": "Sports & Recreation", "domain": "Class Scheduling & Enrollment"}),
        ("SpoonFed - UIUX", {"industry": "Food & Beverage", "domain": "Catering Management"}),
        ("Slavens & Associates Real Estate Inc.", {"industry": "Real Estate", "domain": "Property Transaction Marketplace"}),
        ("Skyvantage", {"industry": "Aviation & Travel", "domain": "Airline Booking Platform"}),
        ("SimpSocial", {"industry": "Automotive", "domain": "Dealership CRM"}),
        ("Signature Pharmacy", {"industry": "Healthcare", "domain": "Online Pharmacy"}),
        ("Signal", {"industry": "Security", "domain": "Security Operations ERP"}),
        ("SchoolTracks - UI/UX", {"industry": "Education", "domain": "Classroom Management"}),
        ("Savearound", {"industry": "Retail & Consumer Services", "domain": "Mobile App Modernization"}),
        ("SalesProphet - Pre Assesment - SOW#1", {"industry": "Software & IT Services", "domain": "Sales Automation"}),
        ("Safe Haven Defence - ERP Platform", {"industry": "Defense & Security", "domain": "ERP Platform"}),
        ("RumbleUp", {"industry": "Civic & Political Organizations", "domain": "Campaign Messaging"}),
        ("RTS", {"industry": "Staffing & Recruiting", "domain": "Employee Onboarding"}),
        ("Riverside - UI/UX", {"industry": "Financial Services", "domain": "Trading Workflow UX"}),
        ("Replenium", {"industry": "E-Commerce", "domain": "Recurring Orders"}),
        ("REI BLACKBOOK", {"industry": "Real Estate", "domain": "Real Estate CRM"}),
        ("REI - Document Generation Platform - Additional Project", {"industry": "Real Estate", "domain": "Document Generation"}),
        ("PSAV", {"industry": "Events & Hospitality", "domain": "Field Service Mobile App"}),
        ("ProPM", {"industry": "Software & IT Services", "domain": "Project Management"}),
        ("ProfitOptics", {"industry": "Wholesale Distribution", "domain": "Pricing Portal"}),
        ("PeopleGuru", {"industry": "Human Resources", "domain": "HRMS Mobile App"}),
        ("Pendulum - Branding", {"industry": "Media Intelligence", "domain": "Narrative Intelligence"}),
        ("Pendulum", {"industry": "Media Intelligence", "domain": "Narrative Intelligence"}),
        ("PBD West (Design)", {"industry": "Convenience Retail", "domain": "CRM UX Modernization"}),
        ("PBD", {"industry": "Convenience Retail", "domain": "Retail Buying Network"}),
        ("OutcomesX", {"industry": "Social Impact & Nonprofit", "domain": "Impact Marketplace"}),
        ("One Click Contractor", {"industry": "Construction", "domain": "Contractor Sales & Estimation"}),
        ("Omniscient - Dedicated Team - SOW#1", {"industry": "Risk & Compliance", "domain": "Event Monitoring"}),
        ("OMNI AI LLC - Discovery Workshop", {"industry": "Software & IT Services", "domain": "AI Discovery Workshop"}),
        ("Omne LLC", {"industry": "Manufacturing", "domain": "Manufacturing ERP"}),
        ("Omar Hospital - Discovery", {"industry": "Healthcare", "domain": "Patient Services Mobile App"}),
        ("Ollivate - FIXED PRICE - SOW#1", {"industry": "Education", "domain": "Gamified Learning"}),
        ("ODSY- GenAI", {"industry": "Corporate Services", "domain": "GenAI Analytics"}),
        ("Kettle Space - UI/UX", {"industry": "Real Estate", "domain": "Coworking Space Management"}),
        ("Kenmore Air Harbor", {"industry": "Aviation & Travel", "domain": "Flight Reservations"}),
        ("Joshua Olson", {"industry": "Education", "domain": "Gamified Learning"}),
        ("Inspire eLearning", {"industry": "Education", "domain": "Learning Management"}),
        ("Insphere AI Platform", {"industry": "Software & IT Services", "domain": "Sales Enablement AI"}),
        ("Incours", {"industry": "Education", "domain": "Learning Marketplace"}),
        ("Impact Genome", {"industry": "Social Impact & Nonprofit", "domain": "Impact Measurement"}),
        ("iCareManager - Engineering - SOW#1", {"industry": "Healthcare", "domain": "Care Management"}),
        ("Haystack", {"industry": "Legal Services", "domain": "eDiscovery & Legal Staffing"}),
        ("GlobalDrum", {"industry": "Media & Entertainment", "domain": "Social Audience Platform"}),
        ("GlobalCare", {"industry": "Healthcare", "domain": "Telehealth Mobile Support"}),
        ("Gift Local", {"industry": "Retail & Consumer Services", "domain": "Gift Card Marketplace"}),
        ("Galpin Motors", {"industry": "Automotive", "domain": "Customer Loyalty Mobile App"}),
        ("Funding Metrics", {"industry": "Financial Services", "domain": "Merchant Financing"}),
        ("FINAFY", {"industry": "Financial Services", "domain": "Financial Product Marketplace"}),
        ("Fetch AI - UIUX", {"industry": "Software & IT Services", "domain": "Cloud & AI Website UX"}),
        ("Fasset", {"industry": "Financial Services", "domain": "Crypto Asset Platform"}),
        ("Epilogue Systems", {"industry": "Education", "domain": "Digital Adoption & Training"}),
        ("EDS", {"industry": "Education", "domain": "School Operations CMMS"}),
        ("eDOC", {"industry": "Financial Services", "domain": "Digital Transaction Management"}),
        ("Ediseed Analytics", {"industry": "Professional Services", "domain": "EDI Analytics"}),
        ("ED - LMS Platform", {"industry": "Education", "domain": "Driver Education LMS"}),
        ("Digno", {"industry": "Human Resources", "domain": "Performance & Rewards"}),
        ("Digimax - UIUX", {"industry": "Marketing & Advertising", "domain": "Website Modernization"}),
        ("Crowdbotics - Wordle", {"industry": "Gaming", "domain": "Word Puzzle Game"}),
        ("Crowdbotics - Wagl", {"industry": "Hospitality", "domain": "Recommendation Platform"}),
        ("Crowdbotics - Furgis Corey", {"industry": "Pet Services", "domain": "Service Scheduling"}),
        ("Comet Electronics, LLC", {"industry": "Transportation & Logistics", "domain": "Rail IoT Monitoring"}),
        ("Cloud 5", {"industry": "Hospitality", "domain": "Guest Communications Platform"}),
        ("Cireson", {"industry": "Software & IT Services", "domain": "IT Service Management"}),
        ("CanvsAI - ASA Pro", {"industry": "Market Research", "domain": "AI Research Assistant"}),
        ("Canvs AI", {"industry": "Market Research", "domain": "Text Analytics"}),
        ("CB - ZYVLY - SOW# 8 (47204-1)", {"industry": "Software & IT Services", "domain": "Custom Application Development"}),
        ("CB - Smile APP - 19915 - 2", {"industry": "Software & IT Services", "domain": "Mobile App Development"}),
        ("CafeZupas", {"industry": "Food & Beverage", "domain": "Restaurant Operations"}),
        ("Bright Line Eating", {"industry": "Healthcare", "domain": "Weight Loss Subscription"}),
        ("BBJ La Tavola formerly BBJ Linen", {"industry": "Events & Hospitality", "domain": "Event Rental ERP"}),
        ("BBJ AI POC", {"industry": "Events & Hospitality", "domain": "AI Customer Support"}),
        ("AZAQ - ReliaDOT", {"industry": "Consumer Goods & Distribution", "domain": "Trade Spend & Onboarding"}),
        ("AZAQ - AI & Digital Strategy", {"industry": "Financial Services", "domain": "Enterprise AI & GRC"}),
        ("Axora LLC - Dedicated Team - SOW#1", {"industry": "Energy & Industrial", "domain": "Dedicated Engineering Team"}),
        ("ASAP", {"industry": "Semiconductors & Electronics", "domain": "Parts Distribution"}),
        ("Accufin - Jira Admin Services", {"industry": "Accounting & Finance", "domain": "Atlassian Workflow Automation"}),
        ("AbsenceSoft LLC", {"industry": "Human Resources", "domain": "Leave & Accommodation Management"}),
    )
}

INDUSTRY_KEYWORD_RULES: Tuple[Tuple[str, Tuple[str, ...]], ...] = (
    ("Education", ("school", "classroom", "student", "lms", "learning", "course", "training", "exam")),
    ("Healthcare", ("health", "hospital", "patient", "doctor", "pharmacy", "medical", "prescription")),
    ("Financial Services", ("bank", "loan", "credit card", "investment", "trading", "payment", "finance")),
    ("Aviation & Travel", ("airline", "flight", "aviation", "travel", "reservation")),
    ("Real Estate", ("real estate", "property", "realtor", "tenant")),
    ("Automotive", ("automotive", "dealership", "car dealership", "vehicle")),
    ("Security", ("security", "guard", "incident", "patrol")),
    ("Food & Beverage", ("restaurant", "catering", "food", "kitchen")),
    ("E-Commerce", ("ecommerce", "e-commerce", "online store", "order management")),
    ("Human Resources", ("hrms", "human resource", "payroll", "employee", "onboarding")),
    ("Manufacturing", ("manufacturing", "factory", "production")),
    ("Legal Services", ("legal", "attorney", "law firm", "ediscovery")),
    ("Software & IT Services", ("software", "it service", "technology company", "cloud", "saas")),
)

DOMAIN_INDUSTRY_HINTS: Tuple[Tuple[str, str], ...] = (
    ("information technology", "Software & IT Services"),
    ("data management", "Data & Analytics"),
    ("e-commerce", "E-Commerce"),
    ("human resource management", "Human Resources"),
)

DOMAIN_KEYWORD_RULES: Tuple[Tuple[str, Tuple[str, ...]], ...] = (
    ("Learning Management", ("lms", "learning", "course", "training", "exam")),
    ("CRM", ("crm", "lead management", "contact management")),
    ("ERP Platform", ("erp", "resource allocation", "inventory management")),
    ("AI & Data Intelligence", ("ai", "genai", "machine learning", "data analytics", "analytics")),
    ("E-Commerce Platform", ("ecommerce", "e-commerce", "online store", "order management")),
    ("Mobile App", ("mobile app", "react native", "ios", "android")),
    ("UI/UX Design", ("ui/ux", "figma", "design revamp", "user interface")),
    ("Business Intelligence & Reporting", ("power bi", "reporting", "dashboard")),
    ("Workflow Automation", ("workflow", "automation", "jira")),
)


def _normalized_industry(value: Any) -> str:
    cleaned = _clean_text(value)
    if not cleaned:
        return ""
    return INDUSTRY_NORMALIZATIONS.get(cleaned.lower(), cleaned)


def _project_haystack(project: Dict[str, Any]) -> str:
    fields = project.get("fields") or {}
    parts = [
        project.get("title"),
        project.get("projectName"),
        project.get("rawProjectName"),
        project.get("companyName"),
        project.get("summary"),
        project.get("problemStatement"),
        project.get("functionalSolution"),
        project.get("technicalSolution"),
        project.get("businessOutcome"),
        project.get("industry"),
        project.get("domain"),
        project.get("subDomain"),
        *fields.values(),
    ]
    return " ".join(str(part or "") for part in parts).lower()


def _has_placeholder_summary(project: Dict[str, Any]) -> bool:
    return _clean_text(project.get("summary")) in {"", PROJECT_SUMMARY_PLACEHOLDER}


def _friendly_project_focus(project: Dict[str, Any]) -> str:
    title = _clean_project_display_title(
        project.get("projectName") or project.get("title"),
        company=_clean_text(project.get("companyName")),
    )
    company = _clean_text(project.get("companyName"))
    if not title or _looks_like_url(title):
        return ""
    if company and _norm_key(title) in _norm_key(company):
        return ""

    focus = title
    if company:
        focus = re.sub(re.escape(company), " ", focus, flags=re.IGNORECASE)
    focus = re.sub(r"https?://\S+", " ", focus)
    focus = re.sub(r"\([^)]*\d[^)]*\)", " ", focus)
    focus = re.sub(r"\b(?:SOW|PO)\s*#?\s*[\w-]*\b", " ", focus, flags=re.IGNORECASE)
    focus = re.sub(r"\b(?:XP|CB)\b", " ", focus, flags=re.IGNORECASE)
    focus = re.sub(r"\b(?:UI\s*/?\s*UX|FIXED PRICE|Dedicated Team|Additional Project)\b", " ", focus, flags=re.IGNORECASE)
    focus = re.sub(r"\b\d{3,}(?:-\d+)*\b", " ", focus)
    focus = re.sub(r"[-_#]+", " ", focus)
    focus = re.sub(r"\s+", " ", focus).strip(" -,:")
    focus = re.sub(r"\s+\d+\s*$", "", focus).strip(" -,:")
    return focus


def _synthetic_project_summary(project: Dict[str, Any]) -> str:
    company = _clean_text(project.get("companyName"))
    industry = _clean_text(project.get("industry") or project.get("sector"))
    domain = _clean_text(project.get("domain") or project.get("subDomain"))
    stage = _clean_text(project.get("companyStage"))
    focus = _friendly_project_focus(project)

    if domain and company:
        summary = f"{domain} project for {company}"
    elif domain:
        summary = f"Knowledge-base project reference focused on {domain}"
    elif company:
        summary = f"Project engagement for {company}"
    else:
        summary = "Knowledge-base project reference"

    if industry and industry.lower() not in summary.lower():
        summary += f" in the {industry} vertical"
    if focus and focus.lower() not in summary.lower():
        summary += f", centered on {focus}"
    if stage:
        summary += f". Company stage: {stage}."
    else:
        summary += "."
    return _compact(summary, 300)


def _infer_from_keywords(haystack: str, rules: Tuple[Tuple[str, Tuple[str, ...]], ...]) -> str:
    for label, keywords in rules:
        if any(keyword in haystack for keyword in keywords):
            return label
    return ""


def _infer_industry_from_domain(project: Dict[str, Any]) -> str:
    haystack = " ".join(
        str(project.get(key) or "").lower()
        for key in ("domain", "subDomain", "sector")
    )
    for needle, industry in DOMAIN_INDUSTRY_HINTS:
        if needle in haystack:
            return industry
    return ""


def _enrich_project_metadata(project: Dict[str, Any]) -> Dict[str, Any]:
    enriched = dict(project)
    override = next(
        (
            PROJECT_VERTICAL_OVERRIDES.get(_project_lookup_key(enriched.get(key)))
            for key in ("rawProjectName", "projectName", "title")
            if PROJECT_VERTICAL_OVERRIDES.get(_project_lookup_key(enriched.get(key)))
        ),
        None,
    )
    haystack = _project_haystack(enriched)

    industry = _normalized_industry(enriched.get("industry"))
    if override and override.get("industry"):
        industry = override["industry"]
    elif not industry:
        industry = _infer_industry_from_domain(enriched) or _infer_from_keywords(haystack, INDUSTRY_KEYWORD_RULES)
    if industry:
        enriched["industry"] = industry

    domain = _clean_text(enriched.get("domain"))
    if not domain and override and override.get("domain"):
        domain = override["domain"]
    elif not domain:
        domain = _infer_from_keywords(haystack, DOMAIN_KEYWORD_RULES)
    if domain:
        enriched["domain"] = domain

    if _has_placeholder_summary(enriched):
        enriched["summary"] = _synthetic_project_summary(enriched)

    return enriched


def _row_to_project(
    fields: Dict[str, str],
    *,
    asset: Dict[str, Any],
) -> Optional[Dict[str, Any]]:
    company = _field_lookup(fields, COMPANY_KEYS)
    raw_project_name = _field_lookup(fields, PROJECT_TITLE_KEYS)
    raw_title = raw_project_name or company
    if not raw_title:
        return None

    normalized_fields = {
        key: _clean_text(value)
        for key, value in fields.items()
        if _clean_text(value) and _norm_key(key) not in PROJECT_EXCLUDED_FIELD_KEYS
    }
    if len(normalized_fields) <= 1:
        return None

    important = {
        api_key: _field_lookup(normalized_fields, source_keys)
        for api_key, source_keys in IMPORTANT_FIELDS.items()
    }
    important = {key: value for key, value in important.items() if value}

    summary_source = (
        important.get("problemStatement")
        or important.get("functionalSolution")
        or important.get("technicalSolution")
        or important.get("businessOutcome")
        or ""
    )
    summary = _compact(summary_source, 300) if summary_source else PROJECT_SUMMARY_PLACEHOLDER
    display_title = _clean_project_display_title(
        raw_title,
        company=company,
        important=important,
    )
    title = display_title or raw_title

    project = {
        "id": _project_id(company or raw_title, raw_title),
        "title": title,
        "projectName": title,
        "rawProjectName": raw_project_name or raw_title,
        "companyName": company or None,
        "summary": summary,
        "fields": normalized_fields,
        "sourceAssetId": asset["id"],
        "sourceAssetIds": [asset["id"]],
        "sourceAssetTitle": asset.get("title") or asset.get("fileName") or "Knowledge base",
        "sourceFileName": asset.get("fileName"),
        "sourceUploadedAt": asset.get("uploadedAt"),
        "sourceAssetType": asset.get("type"),
        "sourceCount": 1,
        "tags": asset.get("tags") or [],
        **important,
    }
    return project


def _project_quality(project: Dict[str, Any]) -> int:
    fields = project.get("fields") or {}
    quality = len(fields)
    for key in ("problemStatement", "functionalSolution", "technicalSolution", "businessOutcome"):
        if project.get(key):
            quality += 5
    return quality


def _merge_project(existing: Dict[str, Any], incoming: Dict[str, Any]) -> Dict[str, Any]:
    if _project_quality(incoming) > _project_quality(existing):
        base, extra = incoming, existing
    else:
        base, extra = existing, incoming

    fields = {**(extra.get("fields") or {}), **(base.get("fields") or {})}
    source_ids = list(dict.fromkeys([*(existing.get("sourceAssetIds") or []), *(incoming.get("sourceAssetIds") or [])]))
    tags = list(dict.fromkeys([*(existing.get("tags") or []), *(incoming.get("tags") or [])]))
    return {
        **base,
        "fields": fields,
        "sourceAssetIds": source_ids,
        "sourceCount": len(source_ids),
        "tags": tags,
    }


def _rows_for_asset(ctx: TenantContext, asset: Dict[str, Any]) -> List[Dict[str, str]]:
    repo = get_kb_repository()
    tenant_uuid, clerk_key = resolve_kb_tenant(ctx)
    row = repo.get_asset_row(tenant_uuid, asset["id"], clerk_key)
    if not row:
        return []

    # Project CSVs must be parsed from the stored file. Ingest chunks batch rows into
    # semicolon-delimited lines for search and lose fields when values contain ';'.
    if _is_csv_asset(asset) and row.get("storage_path"):
        try:
            csv_rows = _parse_csv_rows(repo.download_file(ctx, str(row["storage_path"])))
            if csv_rows:
                return csv_rows
        except Exception:
            pass

    chunks = repo.list_asset_chunks(ctx, asset["id"], limit=1000) if int(asset.get("chunkCount") or 0) > 0 else []
    if chunks:
        rows = _parse_chunk_rows(chunks)
        if rows:
            return rows

    return _parse_chunk_rows(chunks)


def list_kb_projects(ctx: TenantContext) -> List[Dict[str, Any]]:
    tenant_uuid, clerk_key = resolve_kb_tenant(ctx)
    cache_key = f"{tenant_uuid}:{clerk_key}"
    assets = get_kb_repository().list_assets(ctx)
    asset_signature = tuple(
        f"{asset.get('id')}:{asset.get('status')}:{asset.get('chunkCount')}:{asset.get('uploadedAt')}"
        for asset in assets
    )
    cached = _PROJECT_CACHE.get(cache_key)
    if cached and time.monotonic() - cached[0] < PROJECT_CACHE_TTL_SECONDS and cached[1] == asset_signature:
        return [dict(project) for project in cached[2]]

    projects_by_id: Dict[str, Dict[str, Any]] = {}
    seen_asset_signatures: set[str] = set()

    for asset in assets:
        if not _asset_is_projectish(asset):
            continue
        signature = "::".join(
            [
                str(asset.get("title") or ""),
                str(asset.get("fileName") or ""),
                str(asset.get("chunkCount") or 0),
                str(asset.get("status") or ""),
            ]
        ).lower()
        if signature in seen_asset_signatures and int(asset.get("chunkCount") or 0) > 0:
            continue
        seen_asset_signatures.add(signature)

        rows = _rows_for_asset(ctx, asset)
        for fields in rows:
            project = _row_to_project(fields, asset=asset)
            if not project:
                continue
            existing = projects_by_id.get(project["id"])
            projects_by_id[project["id"]] = _merge_project(existing, project) if existing else project

    projects = [_enrich_project_metadata(project) for project in projects_by_id.values()]
    projects.sort(
        key=lambda item: (
            str(item.get("sourceUploadedAt") or ""),
            str(item.get("title") or "").lower(),
        ),
        reverse=True,
    )
    _PROJECT_CACHE[cache_key] = (time.monotonic(), asset_signature, [dict(project) for project in projects])
    return projects


def get_kb_project(ctx: TenantContext, project_id: str) -> Optional[Dict[str, Any]]:
    return next((project for project in list_kb_projects(ctx) if project.get("id") == project_id), None)
