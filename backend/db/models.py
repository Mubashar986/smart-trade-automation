from sqlalchemy import Column, String, Text, DateTime, Enum, ForeignKey, Boolean, Integer, Date
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
import enum

from backend.db.database import Base

class JobStatus(enum.Enum):
    PENDING = "pending"
    PARSING = "parsing"
    VALIDATING = "validating"
    GENERATING = "generating"
    COMPILING = "compiling"
    BACKTESTING = "backtesting"
    COMPLETED = "completed"
    FAILED = "failed"

class User(Base):
    __tablename__ = "users"

    id                 = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username           = Column(String(50), unique=True, nullable=False, index=True)
    email              = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password    = Column(String(255), nullable=False)
    created_at         = Column(DateTime, default=datetime.utcnow)
    is_pro             = Column(Boolean, default=False)
    daily_used         = Column(Integer, default=0)
    last_used_date     = Column(Date, nullable=True)
    stripe_customer_id = Column(String(255), nullable=True)

    jobs = relationship("Job", back_populates="user", order_by="Job.created_at.desc()")
    chat_threads = relationship("ChatThread", back_populates="user", order_by="ChatThread.updated_at.desc()")

class Job(Base):
    __tablename__ = "jobs"

    id              = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id         = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    user_prompt     = Column(Text, nullable=False)
    script_name     = Column(String(255), nullable=False)
    script_content  = Column(Text, nullable=True)
    compile_log     = Column(Text, nullable=True)
    compile_success = Column(String(10), nullable=True)
    backtest_result = Column(Text, nullable=True)
    parsed_strategy = Column(Text, nullable=True)
    status          = Column(Enum(JobStatus), default=JobStatus.PENDING)
    github_run_id   = Column(String(50), nullable=True)
    created_at      = Column(DateTime, default=datetime.utcnow)
    updated_at      = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    error_message   = Column(Text, nullable=True)

    user = relationship("User", back_populates="jobs")
    run = relationship("Run", back_populates="job", uselist=False)


class ChatThread(Base):
    __tablename__ = "chat_threads"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_run_status = Column(String(32), nullable=True)

    user = relationship("User", back_populates="chat_threads")
    messages = relationship("ChatMessage", back_populates="thread", order_by="ChatMessage.created_at.asc()")
    runs = relationship("Run", back_populates="thread", order_by="Run.created_at.asc()")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    thread_id = Column(PG_UUID(as_uuid=True), ForeignKey("chat_threads.id"), nullable=False, index=True)
    role = Column(String(20), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    thread = relationship("ChatThread", back_populates="messages")
    source_runs = relationship("Run", back_populates="source_message", foreign_keys="Run.source_message_id")
    response_runs = relationship("Run", back_populates="response_message", foreign_keys="Run.response_message_id")


class Run(Base):
    __tablename__ = "runs"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    thread_id = Column(PG_UUID(as_uuid=True), ForeignKey("chat_threads.id"), nullable=False, index=True)
    source_message_id = Column(PG_UUID(as_uuid=True), ForeignKey("chat_messages.id"), nullable=False)
    response_message_id = Column(PG_UUID(as_uuid=True), ForeignKey("chat_messages.id"), nullable=False)
    job_id = Column(PG_UUID(as_uuid=True), ForeignKey("jobs.id"), nullable=False, unique=True)
    provider = Column(String(64), nullable=False)
    model = Column(String(128), nullable=False)
    quality_mode = Column(String(32), nullable=False, default="balanced")
    status = Column(String(32), nullable=False, default=JobStatus.PENDING.value)
    failure_type = Column(String(64), nullable=True)
    repairable_fields = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    thread = relationship("ChatThread", back_populates="runs")
    source_message = relationship("ChatMessage", back_populates="source_runs", foreign_keys=[source_message_id])
    response_message = relationship("ChatMessage", back_populates="response_runs", foreign_keys=[response_message_id])
    job = relationship("Job", back_populates="run")
