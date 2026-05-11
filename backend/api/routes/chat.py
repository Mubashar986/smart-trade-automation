from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.api.models.chat_models import (
    ChatThreadDetailResponse,
    ChatThreadSummaryResponse,
    CreateChatRequest,
    ModelCatalogResponse,
    RunDetailResponse,
    SendChatMessageRequest,
    SendChatMessageResponse,
)
from backend.db.database import get_db
from backend.db.models import ChatThread, Run, User
from backend.services.auth_service import enforce_script_limit, get_current_user
from backend.services.chat_service import (
    append_user_prompt_as_run,
    create_thread,
    ensure_thread_for_user,
    get_available_model_catalog,
    serialize_datetime,
)
from backend.workers.tasks import process_strategy_pipeline

router = APIRouter(prefix="/api/v1", tags=["chat"])


@router.get("/models", response_model=ModelCatalogResponse)
async def get_models():
    return get_available_model_catalog()


@router.get("/chats", response_model=list[ChatThreadSummaryResponse])
async def list_chats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    threads = (
        db.query(ChatThread)
        .filter(ChatThread.user_id == current_user.id)
        .order_by(ChatThread.updated_at.desc())
        .all()
    )
    return [
        {
            "id": str(thread.id),
            "title": thread.title,
            "updated_at": serialize_datetime(thread.updated_at),
        }
        for thread in threads
    ]


@router.post("/chats", response_model=ChatThreadSummaryResponse)
async def create_chat(
    request: CreateChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    thread = create_thread(db, current_user, request.title)
    return {
        "id": str(thread.id),
        "title": thread.title,
        "updated_at": serialize_datetime(thread.updated_at),
    }


@router.get("/chats/{thread_id}", response_model=ChatThreadDetailResponse)
async def get_chat(
    thread_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        thread = ensure_thread_for_user(db, thread_id, current_user)
    except ValueError:
        raise HTTPException(status_code=404, detail="Thread not found")

    latest_run_id = str(thread.runs[-1].id) if thread.runs else None
    return {
        "id": str(thread.id),
        "title": thread.title,
        "updated_at": serialize_datetime(thread.updated_at),
        "latest_run_id": latest_run_id,
        "messages": [
            {
                "id": str(message.id),
                "role": message.role,
                "content": message.content,
                "created_at": serialize_datetime(message.created_at),
                "linked_run_id": str(message.response_runs[0].id) if message.role == "assistant" and message.response_runs else None,
            }
            for message in thread.messages
        ],
        "runs": [
            {
                "id": str(run.id),
                "source_message_id": str(run.source_message_id),
                "response_message_id": str(run.response_message_id),
                "provider": run.provider,
                "model": run.model,
                "quality_mode": run.quality_mode,
                "status": run.status,
                "failure_type": run.failure_type,
                "created_at": serialize_datetime(run.created_at),
                "updated_at": serialize_datetime(run.updated_at),
            }
            for run in thread.runs
        ],
    }


@router.post("/chats/{thread_id}/messages", response_model=SendChatMessageResponse)
async def send_chat_message(
    thread_id: str,
    request: SendChatMessageRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        thread = ensure_thread_for_user(db, thread_id, current_user)
    except ValueError:
        raise HTTPException(status_code=404, detail="Thread not found")

    from datetime import date

    if not current_user.is_pro:
        if current_user.last_used_date != date.today():
            current_user.daily_used = 0
            current_user.last_used_date = date.today()

        if current_user.daily_used >= 5:
            raise HTTPException(status_code=429, detail="Daily limit reached. Please upgrade to Pro.")

        current_user.daily_used += 1
        db.commit()

    user_message, assistant_message, job, run = append_user_prompt_as_run(
        db,
        thread,
        request.prompt,
        request.display_message,
        request.provider,
        request.model,
        request.quality_mode,
    )

    enforce_script_limit(current_user.id, db)

    process_strategy_pipeline.delay(str(job.id), request.prompt, str(run.id), str(assistant_message.id))

    return {
        "thread_id": str(thread.id),
        "run_id": str(run.id),
        "user_message_id": str(user_message.id),
        "assistant_message_id": str(assistant_message.id),
        "status": run.status,
    }


@router.get("/runs/{run_id}", response_model=RunDetailResponse)
async def get_run_detail(
    run_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    run = (
        db.query(Run)
        .join(ChatThread, Run.thread_id == ChatThread.id)
        .filter(Run.id == run_id, ChatThread.user_id == current_user.id)
        .first()
    )
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    repairable_fields = []
    if run.repairable_fields:
        import json
        try:
            repairable_fields = json.loads(run.repairable_fields)
        except Exception:
            repairable_fields = []

    return {
        "id": str(run.id),
        "thread_id": str(run.thread_id),
        "source_message_id": str(run.source_message_id),
        "response_message_id": str(run.response_message_id),
        "provider": run.provider,
        "model": run.model,
        "quality_mode": run.quality_mode,
        "status": run.status,
        "failure_type": run.failure_type,
        "repairable_fields": repairable_fields,
        "created_at": serialize_datetime(run.created_at),
        "updated_at": serialize_datetime(run.updated_at),
        "prompt": run.job.user_prompt if run.job else None,
        "compile_success": run.job.compile_success if run.job else None,
        "compile_log": run.job.compile_log if run.job else None,
        "backtest_result": run.job.backtest_result if run.job else None,
        "script_content": run.job.script_content if run.job else None,
        "parsed_strategy": run.job.parsed_strategy if run.job else None,
        "error_message": run.job.error_message if run.job else None,
        "dry_run_available": True,
        "backtest_available": False,
    }
