import asyncio
import json
import ssl

from celery import Celery

from backend.api.models.strategy_models import StrategyJSON
from backend.config import settings
from backend.db.database import SessionLocal
from backend.db.models import Job, JobStatus
from backend.services.backtest_service import run_backtest
from backend.services.chat_service import classify_validation_failure, update_run_from_job
from backend.services.github_service import GitHubService
from backend.services.llm_service import fix_mql5_script, generate_mql5_script, parse_strategy_with_llm
from backend.services.validation_service import validate_strategy

# Upstash Redis requires SSL - convert redis:// -> rediss:// only for Upstash URLs
redis_url = settings.REDIS_URL
if redis_url.startswith("redis://") and "upstash.io" in redis_url:
    redis_url = redis_url.replace("redis://", "rediss://", 1)

celery_app = Celery("tasks", broker=redis_url, backend=redis_url)

# Only apply SSL config when actually using a rediss:// (Upstash) connection.
# Applying SSL params to a plain redis:// causes a Celery startup crash.
if redis_url.startswith("rediss://"):
    celery_app.conf.broker_use_ssl = {"ssl_cert_reqs": ssl.CERT_NONE}
    celery_app.conf.redis_backend_use_ssl = {"ssl_cert_reqs": ssl.CERT_NONE}

github = GitHubService()

MAX_COMPILE_RETRIES = 3


def update_job(job_id: str, db=None, **kwargs):
    close_db = False
    if db is None:
        db = SessionLocal()
        close_db = True

    try:
        job = db.query(Job).filter(Job.id == job_id).first()
        if job:
            for key, value in kwargs.items():
                setattr(job, key, value)
            db.commit()
    finally:
        if close_db:
            db.close()


def reflect_run_state(
    job_id,
    *,
    status: str | None = None,
    failure_type: str | None = None,
    repairable_fields: list[str] | None = None,
    assistant_content: str | None = None,
):
    db = SessionLocal()
    try:
        update_run_from_job(
            db,
            job_id,
            status=status,
            failure_type=failure_type,
            repairable_fields=repairable_fields,
            assistant_content=assistant_content,
        )
    finally:
        db.close()


def compile_on_github(script_name: str, script_content: str):
    pushed, push_error = github.push_script(script_name, script_content)
    if not pushed:
        raise Exception(f"Failed to push script to GitHub: {push_error}")

    triggered = github.trigger_workflow(script_name)
    if not triggered:
        raise Exception("Failed to trigger GitHub Actions workflow")

    run_id = github.get_latest_run_id(script_name)
    result = github.poll_run_completion(run_id, timeout=300)
    if not result["completed"]:
        raise Exception("Compilation timed out")

    build_log = github.download_build_log(run_id)
    compile_success = "0 error" in build_log.lower()
    return build_log, compile_success, run_id


@celery_app.task
def process_strategy_pipeline(job_id: str, prompt: str, run_id: str | None = None, assistant_message_id: str | None = None):
    try:
        update_job(job_id, status=JobStatus.PARSING)
        reflect_run_state(
            job_id,
            status=JobStatus.PARSING.value,
            assistant_content="Parsing your strategy request into structured trading intent.",
        )

        if prompt.strip() in ["1", "2", "3", "broken"]:
            strategy_data_str = prompt.strip()
            warnings = []
        else:
            try:
                potential_json = json.loads(prompt)
                if isinstance(potential_json, dict) and "entry" in potential_json:
                    parsed_strategy = potential_json
                else:
                    parsed_strategy = asyncio.run(parse_strategy_with_llm(prompt))
            except Exception:
                parsed_strategy = asyncio.run(parse_strategy_with_llm(prompt))

            strategy_obj = StrategyJSON(**parsed_strategy)

            update_job(job_id, status=JobStatus.VALIDATING, parsed_strategy=json.dumps(parsed_strategy))
            reflect_run_state(
                job_id,
                status=JobStatus.VALIDATING.value,
                assistant_content="Running validation and safety checks on the parsed strategy.",
            )

            validation_result = validate_strategy(strategy_obj)
            if validation_result["status"] == "failed":
                error_msgs = "\n".join(validation_result["errors"] + validation_result["warnings"])
                failure_type, repairable_fields = classify_validation_failure(validation_result)
                update_job(
                    job_id,
                    status=JobStatus.FAILED,
                    error_message=f"Strategy validation failed:\n{error_msgs}\n\nPlease review your strategy input and add missing safety points.",
                )
                reflect_run_state(
                    job_id,
                    status=JobStatus.FAILED.value,
                    failure_type=failure_type,
                    repairable_fields=repairable_fields,
                    assistant_content="Validation failed. Review the recovery options and pipeline details for this run.",
                )
                return

            strategy_data_str = json.dumps(parsed_strategy, indent=2)
            warnings = validation_result["warnings"]

        update_job(job_id, status=JobStatus.GENERATING)
        reflect_run_state(
            job_id,
            status=JobStatus.GENERATING.value,
            assistant_content="Generating structured MQL5 logic for the current strategy attempt.",
        )
        script_content, script_name = asyncio.run(generate_mql5_script(strategy_data_str, job_id, warnings))
        update_job(job_id, script_content=script_content, script_name=script_name)

        compile_success = False
        build_log = ""
        github_run_id = None

        for attempt in range(1, MAX_COMPILE_RETRIES + 1):
            update_job(job_id, status=JobStatus.COMPILING, error_message=f"Compilation attempt {attempt}/{MAX_COMPILE_RETRIES}")
            reflect_run_state(
                job_id,
                status=JobStatus.COMPILING.value,
                assistant_content=f"Compiling generated code. Attempt {attempt} of {MAX_COMPILE_RETRIES}.",
            )

            build_log, compile_success, github_run_id = compile_on_github(script_name, script_content)
            update_job(
                job_id,
                compile_log=build_log,
                compile_success="yes" if compile_success else "no",
                github_run_id=github_run_id,
            )

            if compile_success:
                break

            if attempt < MAX_COMPILE_RETRIES:
                update_job(job_id, status=JobStatus.GENERATING, error_message=f"Fixing errors (attempt {attempt + 1}/{MAX_COMPILE_RETRIES})")
                reflect_run_state(
                    job_id,
                    status=JobStatus.GENERATING.value,
                    assistant_content=f"Compilation failed. Generating a corrected version for attempt {attempt + 1}.",
                )
                script_content = asyncio.run(fix_mql5_script(prompt, script_content, build_log, attempt + 1))
                update_job(job_id, script_content=script_content)

        if not compile_success:
            update_job(job_id, status=JobStatus.FAILED, error_message=f"Compilation failed after {MAX_COMPILE_RETRIES} attempts.")
            reflect_run_state(
                job_id,
                status=JobStatus.FAILED.value,
                failure_type="compile_failed",
                repairable_fields=[],
                assistant_content="Compilation failed after multiple attempts. Review the compile log and generated code for this run.",
            )
            return

        update_job(job_id, status=JobStatus.BACKTESTING)
        reflect_run_state(
            job_id,
            status=JobStatus.BACKTESTING.value,
            assistant_content="Compilation succeeded. Preparing backtest artifacts and result context.",
        )
        backtest_result = run_backtest(script_content, prompt)
        update_job(job_id, backtest_result=backtest_result)

        update_job(job_id, status=JobStatus.COMPLETED)
        reflect_run_state(
            job_id,
            status=JobStatus.COMPLETED.value,
            assistant_content="Run completed. Open the right-side tabs to inspect code, dry-run context, and future result artifacts.",
        )

    except Exception as exc:
        update_job(job_id, status=JobStatus.FAILED, error_message=str(exc))
        reflect_run_state(
            job_id,
            status=JobStatus.FAILED.value,
            failure_type="infrastructure_failed",
            repairable_fields=[],
            assistant_content="The run failed because of an internal or infrastructure issue. Review the error details for this attempt.",
        )
