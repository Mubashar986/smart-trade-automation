import json
import re
from datetime import datetime
from sqlalchemy.orm import Session

from backend.config import settings
from backend.db.models import ChatMessage, ChatThread, Job, JobStatus, Run, User


def generate_thread_title(prompt: str) -> str:
    text = " ".join(prompt.strip().split())
    if not text:
        return "New strategy chat"
    words = text.split()
    title = " ".join(words[:9])
    if len(words) > 9:
        title += "..."
    return title


def serialize_datetime(value: datetime) -> str:
    return value.isoformat() if value else ""


def get_available_model_catalog() -> dict:
    providers = []

    if settings.GEMINI_API_KEY:
        providers.append({
            "id": "gemini",
            "label": "Google Gemini",
            "models": [
                {
                    "id": settings.CLAW_MODEL,
                    "label": settings.CLAW_MODEL.replace("-", " ").title(),
                    "quality_modes": ["balanced"],
                }
            ],
        })

    if settings.AZURE_OPENAI_API_KEY:
        providers.append({
            "id": "azure-openai",
            "label": "Azure OpenAI",
            "models": [
                {
                    "id": "gpt-5.4-mini",
                    "label": "GPT-5.4 Mini",
                    "quality_modes": ["balanced"],
                }
            ],
        })

    return {"providers": providers}


def create_thread(db: Session, user: User, title: str | None = None) -> ChatThread:
    thread = ChatThread(user_id=user.id, title=title or "New strategy chat")
    db.add(thread)
    db.commit()
    db.refresh(thread)
    return thread


def ensure_thread_for_user(db: Session, thread_id: str, user: User) -> ChatThread:
    thread = db.query(ChatThread).filter(ChatThread.id == thread_id, ChatThread.user_id == user.id).first()
    if not thread:
        raise ValueError("Thread not found")
    return thread


def create_job(db: Session, prompt: str, user_id) -> Job:
    job = Job(user_prompt=prompt, script_name="", user_id=user_id)
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def append_user_prompt_as_run(
    db: Session,
    thread: ChatThread,
    prompt: str,
    display_message: str | None,
    provider: str,
    model: str,
    quality_mode: str,
) -> tuple[ChatMessage, ChatMessage, Job, Run]:
    if thread.title == "New strategy chat":
        thread.title = generate_thread_title(prompt)

    user_message = ChatMessage(thread_id=thread.id, role="user", content=display_message or prompt)
    db.add(user_message)
    db.flush()

    assistant_message = ChatMessage(
        thread_id=thread.id,
        role="assistant",
        content="Working on your strategy. Pipeline details will appear under this response.",
    )
    db.add(assistant_message)
    db.flush()

    job = Job(user_prompt=prompt, script_name="", user_id=thread.user_id)
    db.add(job)
    db.flush()

    run = Run(
        thread_id=thread.id,
        source_message_id=user_message.id,
        response_message_id=assistant_message.id,
        job_id=job.id,
        provider=provider,
        model=model,
        quality_mode=quality_mode,
        status=JobStatus.PENDING.value,
    )
    db.add(run)

    thread.updated_at = datetime.utcnow()
    thread.last_run_status = JobStatus.PENDING.value

    db.commit()
    db.refresh(user_message)
    db.refresh(assistant_message)
    db.refresh(job)
    db.refresh(run)
    db.refresh(thread)
    return user_message, assistant_message, job, run


def classify_validation_failure(validation_result: dict) -> tuple[str, list[str]]:
    combined = " ".join(validation_result.get("errors", []) + validation_result.get("warnings", []))

    structural_markers = [
        "Symbol is required",
        "Timeframe is required",
        "not valid",
        "Entry condition is required",
        "Exit condition is required",
        "Entry indicator is missing",
        "Exit indicator is missing",
        "Buy/sell logic conflicts",
    ]

    if any(marker in combined for marker in structural_markers):
        return "input_invalid", []

    repairable_fields = []
    if "Lot size" in combined:
        repairable_fields.append("risk.lot_size")
    if "Stop-loss" in combined:
        repairable_fields.append("risk.stop_loss_points")
    if "Max trades per day" in combined:
        repairable_fields.append("risk.max_trades_per_day")
    if "drawdown" in combined.lower() or "martingale" in combined.lower():
        repairable_fields.append("risk.max_drawdown_percent")
    if "Take Profit" in combined or "reward" in combined:
        repairable_fields.append("risk.take_profit_points")

    if repairable_fields:
        # Preserve order while deduplicating
        repairable_fields = list(dict.fromkeys(repairable_fields))
        return "input_risky_recoverable", repairable_fields

    return "input_invalid", []


def update_run_from_job(
    db: Session,
    job_id,
    *,
    status: str | None = None,
    failure_type: str | None = None,
    repairable_fields: list[str] | None = None,
    assistant_content: str | None = None,
) -> None:
    run = db.query(Run).filter(Run.job_id == job_id).first()
    if not run:
        return

    if status is not None:
        run.status = status
        if run.thread:
            run.thread.last_run_status = status

    if failure_type is not None:
        run.failure_type = failure_type

    if repairable_fields is not None:
        run.repairable_fields = json.dumps(repairable_fields)

    if assistant_content is not None and run.response_message:
        run.response_message.content = assistant_content

    if run.thread:
        run.thread.updated_at = datetime.utcnow()

    db.commit()
