# PLACEHOLDER PRICES — UPDATE BEFORE USE
# Run from the backend/ directory: python seed.py
# Requires: alembic upgrade head first

import asyncio
import json
import sys
import os
from datetime import datetime, timezone, timedelta

sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import text, delete
from app.config import settings
from app.models.orm import (
    Base, Folder, Prompt, PromptVersion,
    ModelPricing, Asset, TestCase, TestRun, RunResult,
)


def utcnow(offset_hours: int = 0) -> datetime:
    return (datetime.now(timezone.utc) - timedelta(hours=offset_hours)).replace(tzinfo=None)


async def clear_db(session):
    """Delete all seeded rows in dependency order."""
    for table in ["run_results", "test_runs", "test_cases", "prompt_versions",
                  "prompts", "assets", "model_pricing", "folders"]:
        await session.execute(text(f"DELETE FROM {table}"))
    await session.commit()
    print("Cleared existing data.")


async def seed():
    engine = create_async_engine(settings.database_url, echo=False)
    AsyncSession = async_sessionmaker(engine, expire_on_commit=False)

    async with AsyncSession() as session:
        await clear_db(session)

        # ── Folders ──────────────────────────────────────────────────────────
        mkt   = Folder(name="Marketing",   parent_id=None, team_shared=True,  created_at=utcnow(72))
        eng   = Folder(name="Engineering", parent_id=None, team_shared=True,  created_at=utcnow(72))
        sales = Folder(name="Sales",       parent_id=None, team_shared=True,  created_at=utcnow(48))
        hr    = Folder(name="HR & People", parent_id=None, team_shared=False, created_at=utcnow(24))
        ops   = Folder(name="Operations",  parent_id=None, team_shared=True,  created_at=utcnow(12))
        session.add_all([mkt, eng, sales, hr, ops])
        await session.flush()

        # Sub-folders
        social = Folder(name="Social Media", parent_id=mkt.id, team_shared=True, created_at=utcnow(48))
        devtools = Folder(name="Dev Tools",  parent_id=eng.id, team_shared=True, created_at=utcnow(36))
        session.add_all([social, devtools])
        await session.flush()

        # ── Assets ───────────────────────────────────────────────────────────
        asset_json = Asset(
            name="json_output_format",
            content=(
                "Respond ONLY with a valid JSON object. No markdown fences, no explanation text, "
                "no trailing commas. Use snake_case keys. If you cannot complete the task, return "
                '{"error": "<reason>"}.'
            ),
            type="format_spec", team_shared=True, owner="system",
            created_at=utcnow(72), updated_at=utcnow(72),
        )
        asset_tone = Asset(
            name="professional_tone",
            content=(
                "Write in a professional, clear, and concise tone. Avoid jargon unless the audience "
                "is technical. Use active voice and direct language. Keep sentences under 20 words."
            ),
            type="snippet", team_shared=True, owner="system",
            created_at=utcnow(72), updated_at=utcnow(72),
        )
        asset_friendly = Asset(
            name="friendly_casual_tone",
            content=(
                "Write in a warm, conversational tone — like a knowledgeable friend explaining something. "
                "Use contractions, avoid corporate speak, and keep things approachable."
            ),
            type="snippet", team_shared=True, owner="carol",
            created_at=utcnow(48), updated_at=utcnow(48),
        )
        asset_cot = Asset(
            name="chain_of_thought",
            content=(
                "Before giving your final answer, reason step by step inside <thinking> tags. "
                "Then provide your final answer outside those tags."
            ),
            type="system_prompt", team_shared=True, owner="bob",
            created_at=utcnow(36), updated_at=utcnow(36),
        )
        asset_safety = Asset(
            name="safety_disclaimer",
            content=(
                "Important: This output is AI-generated and should be reviewed by a qualified human "
                "before use in production. Do not use this as a substitute for professional advice."
            ),
            type="snippet", team_shared=True, owner="system",
            created_at=utcnow(24), updated_at=utcnow(24),
        )
        session.add_all([asset_json, asset_tone, asset_friendly, asset_cot, asset_safety])
        await session.flush()

        # ── Model Pricing  (PLACEHOLDER VALUES — UPDATE BEFORE USE) ──────────
        pricing_rows = [
            ModelPricing(provider="openai",     model_name="gpt-4o",                   input_rate=0.005,    output_rate=0.015,   currency="USD", updated_at=utcnow()),
            ModelPricing(provider="openai",     model_name="gpt-4o-mini",              input_rate=0.00015,  output_rate=0.0006,  currency="USD", updated_at=utcnow()),
            ModelPricing(provider="openai",     model_name="gpt-4-turbo",              input_rate=0.01,     output_rate=0.03,    currency="USD", updated_at=utcnow()),
            ModelPricing(provider="openai",     model_name="gpt-3.5-turbo",            input_rate=0.0005,   output_rate=0.0015,  currency="USD", updated_at=utcnow()),
            ModelPricing(provider="anthropic",  model_name="claude-sonnet-4-6",        input_rate=0.003,    output_rate=0.015,   currency="USD", updated_at=utcnow()),
            ModelPricing(provider="anthropic",  model_name="claude-haiku-4-5-20251001",input_rate=0.00025,  output_rate=0.00125, currency="USD", updated_at=utcnow()),
            ModelPricing(provider="anthropic",  model_name="claude-opus-4-8",          input_rate=0.015,    output_rate=0.075,   currency="USD", updated_at=utcnow()),
            ModelPricing(provider="deepseek",   model_name="deepseek-chat",            input_rate=0.00014,  output_rate=0.00028, currency="USD", updated_at=utcnow()),
            ModelPricing(provider="deepseek",   model_name="deepseek-reasoner",        input_rate=0.00055,  output_rate=0.00219, currency="USD", updated_at=utcnow()),
        ]
        session.add_all(pricing_rows)
        await session.flush()

        # ════════════════════════════════════════════════════════════════════
        # PROMPTS
        # ════════════════════════════════════════════════════════════════════

        # ── 1. Email Drafter ─────────────────────────────────────────────────
        p_email = Prompt(
            name="Sales Email Drafter",
            description="Writes personalised outreach and follow-up emails that convert",
            folder_id=sales.id, owner="diana",
            tags=json.dumps(["sales", "email", "outreach", "copywriting"]),
            created_at=utcnow(60), updated_at=utcnow(10),
        )
        session.add(p_email); await session.flush()

        pv_email_1 = PromptVersion(
            prompt_id=p_email.id, version_number=1,
            content=(
                "Write a cold outreach email to {{prospect_name}} at {{company}}.\n\n"
                "Our product: {{product_pitch}}\n\n"
                "Keep it under 150 words. Subject line included."
            ),
            system_prompt="You are an expert B2B sales copywriter. Write emails that feel human, not salesy.",
            variables=json.dumps({
                "prospect_name": "Full name of the prospect",
                "company": "Prospect's company name",
                "product_pitch": "One-sentence description of what we're selling",
            }),
            commit_message="Initial cold outreach template",
            author="diana", created_at=utcnow(60),
        )
        pv_email_2 = PromptVersion(
            prompt_id=p_email.id, version_number=2,
            content=(
                "Write a {{email_type}} email to {{prospect_name}}, {{prospect_title}} at {{company}}.\n\n"
                "Context about them: {{prospect_context}}\n"
                "Our product: {{product_pitch}}\n"
                "Key pain point to address: {{pain_point}}\n\n"
                "Requirements:\n"
                "- Subject line that achieves >30% open rate\n"
                "- Opening line referencing their specific context (not generic)\n"
                "- Value proposition in one sentence\n"
                "- Soft CTA — ask for a 15-min call, not a demo\n"
                "- Under 120 words in the body\n\n"
                "{{asset:professional_tone}}"
            ),
            system_prompt=(
                "You are a senior B2B sales copywriter with 10 years experience. "
                "You study prospect LinkedIn profiles and tailor every email. "
                "You never use phrases like 'Hope this finds you well' or 'I wanted to reach out'."
            ),
            variables=json.dumps({
                "email_type": "Type: cold outreach, follow-up, re-engagement, or breakup",
                "prospect_name": "Full name",
                "prospect_title": "Their job title",
                "company": "Company name",
                "prospect_context": "Relevant detail about them (recent post, funding, news)",
                "product_pitch": "One-sentence value prop",
                "pain_point": "The specific problem we solve for this person",
            }),
            commit_message="Add email type, prospect context, pain point — major quality improvement",
            author="diana", created_at=utcnow(10),
        )
        pv_email_3 = PromptVersion(
            prompt_id=p_email.id, version_number=3,
            content=(
                "Write a {{email_type}} email to {{prospect_name}}, {{prospect_title}} at {{company}}.\n\n"
                "Context: {{prospect_context}}\n"
                "Product: {{product_pitch}}\n"
                "Pain point: {{pain_point}}\n"
                "Previous touchpoints: {{previous_touchpoints}}\n\n"
                "Requirements:\n"
                "- Subject line (A/B variant included)\n"
                "- Opening hook tied to their context\n"
                "- One clear value prop\n"
                "- Social proof line (use [CUSTOMER] and [RESULT] as placeholders)\n"
                "- Soft CTA\n"
                "- P.S. line (outperforms by 30%)\n"
                "- Max 150 words\n\n"
                "{{asset:professional_tone}}\n\n"
                "{{asset:json_output_format}}"
            ),
            system_prompt=(
                "You are a senior B2B sales copywriter. Output JSON with keys: "
                "subject_a, subject_b, body, ps_line."
            ),
            variables=json.dumps({
                "email_type": "cold outreach | follow-up | re-engagement | breakup",
                "prospect_name": "Full name",
                "prospect_title": "Job title",
                "company": "Company name",
                "prospect_context": "Recent trigger or relevant detail",
                "product_pitch": "One-sentence value prop",
                "pain_point": "Problem we solve for them",
                "previous_touchpoints": "Summary of prior emails/calls, or 'none'",
            }),
            commit_message="Add A/B subject lines, PS line, social proof placeholder, JSON output",
            author="diana", created_at=utcnow(2),
        )
        session.add_all([pv_email_1, pv_email_2, pv_email_3])

        # ── 2. SQL Generator ─────────────────────────────────────────────────
        p_sql = Prompt(
            name="SQL Query Generator",
            description="Converts natural language questions into correct, optimised SQL",
            folder_id=devtools.id, owner="bob",
            tags=json.dumps(["engineering", "sql", "database", "dev-tool"]),
            created_at=utcnow(50), updated_at=utcnow(8),
        )
        session.add(p_sql); await session.flush()

        pv_sql_1 = PromptVersion(
            prompt_id=p_sql.id, version_number=1,
            content=(
                "Convert this question to SQL:\n\n"
                "{{question}}\n\n"
                "Database schema:\n{{schema}}"
            ),
            system_prompt="You are a SQL expert. Write clean, correct SQL queries.",
            variables=json.dumps({
                "question": "Natural language question to answer with SQL",
                "schema": "CREATE TABLE statements or table descriptions",
            }),
            commit_message="Initial version",
            author="bob", created_at=utcnow(50),
        )
        pv_sql_2 = PromptVersion(
            prompt_id=p_sql.id, version_number=2,
            content=(
                "Convert the following question to a {{dialect}} SQL query.\n\n"
                "Question: {{question}}\n\n"
                "Database schema:\n```sql\n{{schema}}\n```\n\n"
                "Dialect-specific rules:\n"
                "- Use {{dialect}}-compatible syntax only\n"
                "- Prefer CTEs over subqueries for readability\n"
                "- Add index hints if the query will scan large tables\n\n"
                "{{asset:chain_of_thought}}\n\n"
                "Output: the SQL query only, wrapped in ```sql``` fences. "
                "Include a one-line comment explaining the approach."
            ),
            system_prompt=(
                "You are a database engineer with deep expertise in query optimisation. "
                "You always consider indexes, join order, and avoid SELECT *. "
                "You reason through the schema before writing the query."
            ),
            variables=json.dumps({
                "question": "Natural language question",
                "schema": "DDL (CREATE TABLE statements)",
                "dialect": "SQL dialect: PostgreSQL, MySQL, SQLite, BigQuery, Snowflake",
            }),
            commit_message="Add dialect support, CTE preference, chain-of-thought reasoning",
            author="bob", created_at=utcnow(8),
        )
        session.add_all([pv_sql_1, pv_sql_2])

        # ── 3. Product Description Writer ────────────────────────────────────
        p_product = Prompt(
            name="Product Description Writer",
            description="Creates compelling e-commerce product descriptions that convert browsers to buyers",
            folder_id=mkt.id, owner="alice",
            tags=json.dumps(["marketing", "ecommerce", "copywriting", "seo"]),
            created_at=utcnow(45), updated_at=utcnow(5),
        )
        session.add(p_product); await session.flush()

        pv_product_1 = PromptVersion(
            prompt_id=p_product.id, version_number=1,
            content=(
                "Write a product description for:\n\n"
                "Product: {{product_name}}\n"
                "Features: {{features}}\n"
                "Target customer: {{customer}}"
            ),
            system_prompt="You are an e-commerce copywriter. Write descriptions that sell.",
            variables=json.dumps({
                "product_name": "Name of the product",
                "features": "List of key features/specs",
                "customer": "Who this product is for",
            }),
            commit_message="Initial version",
            author="alice", created_at=utcnow(45),
        )
        pv_product_2 = PromptVersion(
            prompt_id=p_product.id, version_number=2,
            content=(
                "Write an e-commerce product description for {{platform}}.\n\n"
                "Product: {{product_name}}\n"
                "Category: {{category}}\n"
                "Key features: {{features}}\n"
                "Price point: {{price_point}}\n"
                "Target customer: {{customer}}\n"
                "Brand voice: {{brand_voice}}\n\n"
                "Structure:\n"
                "1. Hook headline (max 10 words, benefit-led)\n"
                "2. Opening paragraph — lead with the biggest benefit, not features (2-3 sentences)\n"
                "3. Feature bullets — 4-6 bullets, each starting with a benefit then the feature\n"
                "4. Closing CTA sentence\n\n"
                "SEO: naturally include {{seo_keywords}} in the copy.\n\n"
                "{{asset:professional_tone}}"
            ),
            system_prompt=(
                "You are a conversion copywriter specialising in e-commerce. "
                "You follow the FAB framework (Feature → Advantage → Benefit). "
                "You never start bullets with 'Featuring' or 'Includes'."
            ),
            variables=json.dumps({
                "platform": "Shopify, Amazon, Etsy, etc.",
                "product_name": "Full product name",
                "category": "Product category",
                "features": "Comma-separated features and specs",
                "price_point": "Budget / mid-range / premium / luxury",
                "customer": "Target customer persona",
                "brand_voice": "e.g. playful, authoritative, minimalist",
                "seo_keywords": "2-4 target keywords to include naturally",
            }),
            commit_message="Add platform, brand voice, price point, SEO keywords, FAB structure",
            author="alice", created_at=utcnow(5),
        )
        session.add_all([pv_product_1, pv_product_2])

        # ── 4. Meeting Notes Summariser ──────────────────────────────────────
        p_meeting = Prompt(
            name="Meeting Notes Summariser",
            description="Turns raw meeting transcripts into structured summaries with action items",
            folder_id=ops.id, owner="carol",
            tags=json.dumps(["productivity", "meetings", "summarisation", "operations"]),
            created_at=utcnow(40), updated_at=utcnow(3),
        )
        session.add(p_meeting); await session.flush()

        pv_meeting_1 = PromptVersion(
            prompt_id=p_meeting.id, version_number=1,
            content=(
                "Summarise this meeting transcript:\n\n{{transcript}}"
            ),
            system_prompt="You are an executive assistant. Create clear, concise meeting summaries.",
            variables=json.dumps({"transcript": "Raw meeting transcript text"}),
            commit_message="Initial version",
            author="carol", created_at=utcnow(40),
        )
        pv_meeting_2 = PromptVersion(
            prompt_id=p_meeting.id, version_number=2,
            content=(
                "Summarise the following {{meeting_type}} meeting transcript.\n\n"
                "Meeting date: {{date}}\n"
                "Participants: {{participants}}\n\n"
                "Transcript:\n---\n{{transcript}}\n---\n\n"
                "Output structure (use these exact headings):\n\n"
                "## TL;DR\n"
                "One paragraph, max 3 sentences.\n\n"
                "## Key Decisions\n"
                "Bullet list of decisions made (skip if none).\n\n"
                "## Action Items\n"
                "Table with columns: | Owner | Action | Due Date |\n"
                "Infer due dates from context; use 'TBD' if unclear.\n\n"
                "## Open Questions\n"
                "Unresolved items that need follow-up.\n\n"
                "## Next Meeting\n"
                "Date and agenda if mentioned."
            ),
            system_prompt=(
                "You are an executive assistant for a fast-moving startup. "
                "You extract only what matters — skip small talk and repeated points. "
                "You are precise about who said what when assigning action items."
            ),
            variables=json.dumps({
                "meeting_type": "Type: standup, planning, retro, 1:1, all-hands, client call",
                "date": "Meeting date (YYYY-MM-DD)",
                "participants": "Comma-separated list of attendee names",
                "transcript": "Full meeting transcript or rough notes",
            }),
            commit_message="Add meeting type, structured output with action item table",
            author="carol", created_at=utcnow(3),
        )
        session.add_all([pv_meeting_1, pv_meeting_2])

        # ── 5. Code Reviewer ─────────────────────────────────────────────────
        p_code = Prompt(
            name="Code Review Assistant",
            description="Reviews code for bugs, security vulnerabilities, and best practices",
            folder_id=eng.id, owner="bob",
            tags=json.dumps(["engineering", "code-review", "security", "quality"]),
            created_at=utcnow(38), updated_at=utcnow(6),
        )
        session.add(p_code); await session.flush()

        pv_code_1 = PromptVersion(
            prompt_id=p_code.id, version_number=1,
            content=(
                "Review this {{language}} code:\n\n```{{language}}\n{{code}}\n```\n\n"
                "Find bugs, security issues, and style problems."
            ),
            system_prompt="You are a senior software engineer. Be specific and constructive.",
            variables=json.dumps({
                "language": "Programming language",
                "code": "Code to review",
            }),
            commit_message="Initial version",
            author="bob", created_at=utcnow(38),
        )
        pv_code_2 = PromptVersion(
            prompt_id=p_code.id, version_number=2,
            content=(
                "Conduct a code review of the following {{language}} code.\n"
                "Context: {{context}}\n"
                "PR description: {{pr_description}}\n\n"
                "```{{language}}\n{{code}}\n```\n\n"
                "Review against these dimensions:\n"
                "1. **Critical** — bugs that will cause runtime errors or data loss\n"
                "2. **Security** — injection, auth bypass, secrets in code, unvalidated input\n"
                "3. **Performance** — N+1 queries, blocking I/O, unnecessary allocations\n"
                "4. **Maintainability** — naming, complexity, missing tests, dead code\n"
                "5. **Positive** — what was done well (always include at least one)\n\n"
                "For each issue: state the line number, explain the problem, provide a corrected snippet.\n\n"
                "{{asset:chain_of_thought}}"
            ),
            system_prompt=(
                "You are a staff engineer with deep expertise in security and performance. "
                "You give specific, actionable feedback with code examples. "
                "You balance criticism with recognition of good work."
            ),
            variables=json.dumps({
                "language": "Python | TypeScript | Go | Rust | Java | etc.",
                "code": "The full code diff or snippet",
                "context": "Production API | internal tool | data pipeline | CLI | etc.",
                "pr_description": "What this PR is trying to achieve",
            }),
            commit_message="Add severity levels, security dimension, positive feedback, chain-of-thought",
            author="bob", created_at=utcnow(6),
        )
        session.add_all([pv_code_1, pv_code_2])

        # ── 6. Customer Support Reply ─────────────────────────────────────────
        p_support = Prompt(
            name="Customer Support Reply",
            description="Drafts empathetic, on-brand support responses across tiers",
            folder_id=mkt.id, owner="carol",
            tags=json.dumps(["support", "customer-service", "cx"]),
            created_at=utcnow(35), updated_at=utcnow(4),
        )
        session.add(p_support); await session.flush()

        pv_support_1 = PromptVersion(
            prompt_id=p_support.id, version_number=1,
            content="Customer message:\n\"{{customer_message}}\"\n\nDraft a helpful reply.",
            system_prompt="You are a friendly, professional customer support agent.",
            variables=json.dumps({"customer_message": "The customer's message"}),
            commit_message="Initial version",
            author="carol", created_at=utcnow(35),
        )
        pv_support_2 = PromptVersion(
            prompt_id=p_support.id, version_number=2,
            content=(
                "Draft a customer support reply for {{product_name}}.\n\n"
                "Customer tier: {{tier}}\n"
                "Issue category: {{issue_category}}\n"
                "Customer sentiment: {{sentiment}}\n\n"
                "Customer message:\n\"{{customer_message}}\"\n\n"
                "Internal notes (not visible to customer): {{internal_notes}}\n\n"
                "Your reply must:\n"
                "- Open by acknowledging their specific situation (not a generic greeting)\n"
                "- Explain the resolution clearly\n"
                "- Set expectations for any follow-up timeline\n"
                "- Close warmly\n"
                "- For enterprise tier: offer a follow-up call\n\n"
                "{{asset:friendly_casual_tone}}"
            ),
            system_prompt=(
                "You are a customer support specialist. You adapt your tone to the customer's "
                "emotional state. For angry customers, you de-escalate first. "
                "For technical issues, you give clear step-by-step instructions."
            ),
            variables=json.dumps({
                "product_name": "Product name",
                "tier": "free | pro | enterprise",
                "issue_category": "billing | bug | feature request | how-to | complaint | refund",
                "sentiment": "happy | neutral | frustrated | angry",
                "customer_message": "The customer's verbatim message",
                "internal_notes": "Context from CRM, previous tickets, or 'none'",
            }),
            commit_message="Add tier, sentiment, issue category, internal notes, conditional enterprise handling",
            author="carol", created_at=utcnow(4),
        )
        session.add_all([pv_support_1, pv_support_2])

        # ── 7. LinkedIn Post Generator ───────────────────────────────────────
        p_linkedin = Prompt(
            name="LinkedIn Post Generator",
            description="Writes high-engagement LinkedIn posts that build personal brand",
            folder_id=social.id, owner="alice",
            tags=json.dumps(["social-media", "linkedin", "content", "personal-brand"]),
            created_at=utcnow(30), updated_at=utcnow(1),
        )
        session.add(p_linkedin); await session.flush()

        pv_linkedin_1 = PromptVersion(
            prompt_id=p_linkedin.id, version_number=1,
            content="Write a LinkedIn post about: {{topic}}\nAuthor background: {{background}}",
            system_prompt="You are a LinkedIn content strategist. Write posts that get engagement.",
            variables=json.dumps({
                "topic": "What the post is about",
                "background": "Author's professional background",
            }),
            commit_message="Initial version",
            author="alice", created_at=utcnow(30),
        )
        pv_linkedin_2 = PromptVersion(
            prompt_id=p_linkedin.id, version_number=2,
            content=(
                "Write a LinkedIn post in the style of {{post_format}}.\n\n"
                "Topic: {{topic}}\n"
                "Core insight or story: {{core_message}}\n"
                "Author background: {{background}}\n"
                "Target audience: {{audience}}\n"
                "Desired outcome: {{goal}}\n\n"
                "LinkedIn-specific rules:\n"
                "- First line must stop the scroll (no 'I'm excited to share')\n"
                "- Use line breaks generously — one idea per line\n"
                "- 3-5 short paragraphs maximum\n"
                "- End with a question that invites comments\n"
                "- 3-5 relevant hashtags at the end\n"
                "- No emojis unless the format calls for them\n"
                "- Optimal length: 1,000-1,300 characters\n\n"
                "{{asset:friendly_casual_tone}}"
            ),
            system_prompt=(
                "You are a LinkedIn ghostwriter whose clients regularly hit 50k+ impressions. "
                "You know that hooks, white space, and curiosity gaps drive engagement. "
                "You never write corporate clichés."
            ),
            variables=json.dumps({
                "post_format": "story | list | contrarian take | lesson learned | announcement",
                "topic": "Subject of the post",
                "core_message": "The key insight, story, or data point to build around",
                "background": "Author's role, industry, years of experience",
                "audience": "Who should see and engage with this post",
                "goal": "build authority | drive leads | grow followers | spark debate",
            }),
            commit_message="Add post format types, character limit, scroll-stopping hook rules",
            author="alice", created_at=utcnow(1),
        )
        session.add_all([pv_linkedin_1, pv_linkedin_2])

        # ── 8. Resume Screener ───────────────────────────────────────────────
        p_resume = Prompt(
            name="Resume Screener",
            description="Scores resumes against job requirements and highlights gaps",
            folder_id=hr.id, owner="emma",
            tags=json.dumps(["hr", "recruiting", "screening"]),
            created_at=utcnow(25), updated_at=utcnow(7),
        )
        session.add(p_resume); await session.flush()

        pv_resume_1 = PromptVersion(
            prompt_id=p_resume.id, version_number=1,
            content=(
                "Screen this resume against the job description.\n\n"
                "Job: {{job_description}}\n\nResume:\n{{resume}}"
            ),
            system_prompt="You are a recruiter. Evaluate objectively.",
            variables=json.dumps({
                "job_description": "Full job description",
                "resume": "Candidate's resume text",
            }),
            commit_message="Initial version",
            author="emma", created_at=utcnow(25),
        )
        pv_resume_2 = PromptVersion(
            prompt_id=p_resume.id, version_number=2,
            content=(
                "Screen the following candidate resume for the role of {{role_title}}.\n\n"
                "## Job Requirements\n{{job_description}}\n\n"
                "## Must-Have Criteria\n{{must_haves}}\n\n"
                "## Nice-to-Have Criteria\n{{nice_to_haves}}\n\n"
                "## Candidate Resume\n{{resume}}\n\n"
                "Evaluate and output:\n"
                "1. **Overall Score**: X/10 with one-line justification\n"
                "2. **Must-Haves Met**: list each criterion with ✓ or ✗ and evidence from the resume\n"
                "3. **Nice-to-Haves Met**: same format\n"
                "4. **Red Flags**: unexplained gaps, job-hopping, mismatched seniority\n"
                "5. **Recommended Interview Questions**: 3 targeted questions based on gaps\n"
                "6. **Decision**: Advance | Maybe | Pass — with one sentence rationale\n\n"
                "{{asset:safety_disclaimer}}\n\n"
                "{{asset:json_output_format}}"
            ),
            system_prompt=(
                "You are an experienced technical recruiter. You evaluate candidates fairly "
                "based on evidence in the resume, not assumptions. "
                "You flag when requirements are unrealistic (10 years experience in a 5-year-old technology)."
            ),
            variables=json.dumps({
                "role_title": "Job title being hired for",
                "job_description": "Full job description",
                "must_haves": "Non-negotiable requirements, one per line",
                "nice_to_haves": "Preferred but optional criteria, one per line",
                "resume": "Candidate resume (paste as text)",
            }),
            commit_message="Add must/nice-to-have split, scoring rubric, interview questions, JSON output",
            author="emma", created_at=utcnow(7),
        )
        session.add_all([pv_resume_1, pv_resume_2])

        # ── 9. Sentiment Analyser ────────────────────────────────────────────
        p_sentiment = Prompt(
            name="Sentiment & Intent Analyser",
            description="Classifies customer feedback by sentiment, intent, and urgency",
            folder_id=ops.id, owner="bob",
            tags=json.dumps(["nlp", "analytics", "customer-feedback", "classification"]),
            created_at=utcnow(20), updated_at=utcnow(2),
        )
        session.add(p_sentiment); await session.flush()

        pv_sentiment_1 = PromptVersion(
            prompt_id=p_sentiment.id, version_number=1,
            content="Analyse the sentiment of: {{text}}",
            system_prompt="Classify as positive, negative, or neutral.",
            variables=json.dumps({"text": "Text to analyse"}),
            commit_message="Initial version",
            author="bob", created_at=utcnow(20),
        )
        pv_sentiment_2 = PromptVersion(
            prompt_id=p_sentiment.id, version_number=2,
            content=(
                "Analyse the following customer {{feedback_source}} text.\n\n"
                "Product context: {{product_context}}\n\n"
                "Text:\n---\n{{text}}\n---\n\n"
                "Classify and extract:\n"
                "- sentiment: positive | negative | neutral | mixed\n"
                "- sentiment_score: -1.0 to 1.0\n"
                "- primary_intent: complaint | praise | question | feature_request | churn_risk | bug_report\n"
                "- urgency: low | medium | high | critical\n"
                "- topics: list of up to 5 topics mentioned\n"
                "- action_required: true/false — does this need a human response within 24h?\n"
                "- key_quote: the single most important sentence from the text\n"
                "- recommended_team: support | product | engineering | billing | leadership\n\n"
                "{{asset:json_output_format}}"
            ),
            system_prompt=(
                "You are a CX analytics model. You classify with high precision. "
                "When in doubt between urgency levels, choose the higher one. "
                "Churn risk signals: 'cancel', 'switching', 'competitor', 'disappointed', 'last chance'."
            ),
            variables=json.dumps({
                "feedback_source": "review | support ticket | NPS survey | social media | email",
                "product_context": "Brief description of the product being discussed",
                "text": "The customer feedback text to analyse",
            }),
            commit_message="Full classification schema with urgency, intent, routing, and churn signals",
            author="bob", created_at=utcnow(2),
        )
        session.add_all([pv_sentiment_1, pv_sentiment_2])

        # ── 10. Blog Post Writer ─────────────────────────────────────────────
        p_blog = Prompt(
            name="SEO Blog Post Writer",
            description="Produces long-form, SEO-optimised blog content with E-E-A-T signals",
            folder_id=mkt.id, owner="alice",
            tags=json.dumps(["marketing", "content", "seo", "blog"]),
            created_at=utcnow(15), updated_at=utcnow(1),
        )
        session.add(p_blog); await session.flush()

        pv_blog_1 = PromptVersion(
            prompt_id=p_blog.id, version_number=1,
            content="Write a blog post about {{topic}} for {{audience}}.",
            system_prompt="You are an SEO content writer.",
            variables=json.dumps({
                "topic": "Blog post topic",
                "audience": "Target audience",
            }),
            commit_message="Initial version",
            author="alice", created_at=utcnow(15),
        )
        pv_blog_2 = PromptVersion(
            prompt_id=p_blog.id, version_number=2,
            content=(
                "Write a {{word_count}}-word SEO blog post.\n\n"
                "Title/keyword: {{primary_keyword}}\n"
                "Secondary keywords: {{secondary_keywords}}\n"
                "Target audience: {{audience}}\n"
                "Funnel stage: {{funnel_stage}}\n"
                "CTA goal: {{cta_goal}}\n\n"
                "SEO requirements:\n"
                "- Include primary keyword in H1, first 100 words, and conclusion\n"
                "- Secondary keywords distributed naturally\n"
                "- At least 2 H2 subheadings\n"
                "- Suggest 2 internal link anchor texts (mark as [INTERNAL LINK: topic])\n"
                "- Meta description (150-160 chars) at the top\n\n"
                "Content requirements:\n"
                "- Open with a statistic or surprising fact\n"
                "- Include one concrete example or case study\n"
                "- End with a clear CTA aligned to {{cta_goal}}\n\n"
                "{{asset:professional_tone}}"
            ),
            system_prompt=(
                "You are an SEO content strategist with expertise in E-E-A-T (Experience, Expertise, "
                "Authoritativeness, Trustworthiness). You write for humans first, search engines second. "
                "You never keyword-stuff. You cite specific data points."
            ),
            variables=json.dumps({
                "primary_keyword": "Main SEO keyword or blog title",
                "secondary_keywords": "2-4 related keywords, comma-separated",
                "audience": "Who will read this (role, industry, knowledge level)",
                "word_count": "Target word count: 800 | 1200 | 1800 | 2500",
                "funnel_stage": "awareness | consideration | decision",
                "cta_goal": "newsletter signup | book a demo | download guide | contact sales",
            }),
            commit_message="Add full SEO structure, meta description, internal links, E-E-A-T system prompt",
            author="alice", created_at=utcnow(1),
        )
        session.add_all([pv_blog_1, pv_blog_2])

        await session.flush()

        # ── Test Cases ────────────────────────────────────────────────────────
        tc1 = TestCase(
            name="Email — SaaS cold outreach to VP Engineering",
            prompt_version_id=pv_email_2.id,
            variable_inputs=json.dumps({
                "email_type": "cold outreach",
                "prospect_name": "Sarah Chen",
                "prospect_title": "VP Engineering",
                "company": "Acme Corp",
                "prospect_context": "Recently posted about scaling their CI/CD pipeline on LinkedIn",
                "product_pitch": "We cut CI build times by 60% with intelligent test parallelisation",
                "pain_point": "Slow CI pipelines blocking developer velocity",
            }),
            assertion_type="contains",
            assertion_value="CI",
            created_at=utcnow(5),
        )
        tc2 = TestCase(
            name="SQL — Monthly revenue by plan from subscriptions table",
            prompt_version_id=pv_sql_2.id,
            variable_inputs=json.dumps({
                "dialect": "PostgreSQL",
                "question": "What is the total monthly recurring revenue broken down by subscription plan for the last 3 months?",
                "schema": (
                    "CREATE TABLE subscriptions (\n"
                    "  id SERIAL PRIMARY KEY,\n"
                    "  user_id INT NOT NULL,\n"
                    "  plan VARCHAR(50) NOT NULL, -- 'free', 'pro', 'enterprise'\n"
                    "  mrr DECIMAL(10,2) NOT NULL,\n"
                    "  status VARCHAR(20) NOT NULL, -- 'active', 'cancelled', 'paused'\n"
                    "  created_at TIMESTAMP NOT NULL,\n"
                    "  cancelled_at TIMESTAMP\n"
                    ");"
                ),
            }),
            assertion_type="contains",
            assertion_value="GROUP BY",
            created_at=utcnow(4),
        )
        tc3 = TestCase(
            name="Sentiment — Angry churn-risk customer",
            prompt_version_id=pv_sentiment_2.id,
            variable_inputs=json.dumps({
                "feedback_source": "support ticket",
                "product_context": "B2B project management SaaS",
                "text": (
                    "I've been a paying customer for 2 years and this is the third time "
                    "this month my data export failed. I'm seriously considering switching to "
                    "Notion or Linear. Your support response times are terrible and I'm paying "
                    "$400/month for this. Fix this or I'm cancelling."
                ),
            }),
            assertion_type="contains",
            assertion_value="churn_risk",
            created_at=utcnow(3),
        )
        tc4 = TestCase(
            name="Meeting summary — Product planning session",
            prompt_version_id=pv_meeting_2.id,
            variable_inputs=json.dumps({
                "meeting_type": "planning",
                "date": "2026-06-27",
                "participants": "Alice (PM), Bob (Engineering), Carol (Design), Diana (Sales)",
                "transcript": (
                    "Alice: Let's kick off Q3 planning. Bob, what's the engineering capacity?\n"
                    "Bob: We have 3 engineers fully available after the migration is done next week. "
                    "Carol's design work is blocking the new onboarding flow.\n"
                    "Carol: I'll have the onboarding mockups done by Friday EOD.\n"
                    "Alice: Great. Diana, what are the top sales requests?\n"
                    "Diana: SSO and audit logs are the #1 blockers for enterprise deals. "
                    "We lost Acme last week because of it.\n"
                    "Bob: SSO is probably 2 weeks. Audit logs maybe 3 weeks if we start now.\n"
                    "Alice: Let's prioritise SSO for Q3 sprint 1. Bob owns it, target July 15.\n"
                    "Bob: Confirmed. I'll need Diana to intro me to the Acme tech team for requirements.\n"
                    "Diana: I'll set that up by Monday.\n"
                    "Alice: Carol, can the onboarding redesign wait for sprint 2?\n"
                    "Carol: Yes, that works. I'll use the time to finish the design system.\n"
                    "Alice: Perfect. Next meeting same time next week."
                ),
            }),
            assertion_type="contains",
            assertion_value="SSO",
            created_at=utcnow(2),
        )
        session.add_all([tc1, tc2, tc3, tc4])
        await session.flush()

        await session.commit()

    await engine.dispose()

    print("\nSeed complete!")
    print(f"  Folders   : Marketing, Engineering, Sales, HR & People, Operations + 2 sub-folders")
    print(f"  Assets    : {5} (json_output_format, professional_tone, friendly_casual_tone, chain_of_thought, safety_disclaimer)")
    print(f"  Pricing   : {len(pricing_rows)} model rows (OpenAI x4, Anthropic x3, DeepSeek x2)")
    print(f"  Prompts   : 10 prompts × 2-3 versions each")
    print(f"  Test cases: 4")


if __name__ == "__main__":
    asyncio.run(seed())
