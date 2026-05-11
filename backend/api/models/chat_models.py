from pydantic import BaseModel, Field
from typing import List, Optional


class CreateChatRequest(BaseModel):
    title: Optional[str] = None


class SendChatMessageRequest(BaseModel):
    prompt: str = Field(..., min_length=1)
    display_message: Optional[str] = None
    provider: str = "gemini"
    model: str = "gemini-2.5-flash"
    quality_mode: str = "balanced"


class ModelOptionResponse(BaseModel):
    id: str
    label: str
    quality_modes: List[str]


class ProviderOptionResponse(BaseModel):
    id: str
    label: str
    models: List[ModelOptionResponse]


class ModelCatalogResponse(BaseModel):
    providers: List[ProviderOptionResponse]


class ChatThreadSummaryResponse(BaseModel):
    id: str
    title: str
    updated_at: str


class ChatMessageResponse(BaseModel):
    id: str
    role: str
    content: str
    created_at: str
    linked_run_id: Optional[str] = None


class RunSummaryResponse(BaseModel):
    id: str
    source_message_id: str
    response_message_id: str
    provider: str
    model: str
    quality_mode: str
    status: str
    failure_type: Optional[str] = None
    created_at: str
    updated_at: str


class ChatThreadDetailResponse(BaseModel):
    id: str
    title: str
    updated_at: str
    latest_run_id: Optional[str] = None
    messages: List[ChatMessageResponse]
    runs: List[RunSummaryResponse]


class SendChatMessageResponse(BaseModel):
    thread_id: str
    run_id: str
    user_message_id: str
    assistant_message_id: str
    status: str


class RunDetailResponse(BaseModel):
    id: str
    thread_id: str
    source_message_id: str
    response_message_id: str
    provider: str
    model: str
    quality_mode: str
    status: str
    failure_type: Optional[str] = None
    repairable_fields: List[str] = []
    created_at: str
    updated_at: str
    prompt: Optional[str] = None
    compile_success: Optional[str] = None
    compile_log: Optional[str] = None
    backtest_result: Optional[str] = None
    script_content: Optional[str] = None
    parsed_strategy: Optional[str] = None
    error_message: Optional[str] = None
    dry_run_available: bool = True
    backtest_available: bool = False
