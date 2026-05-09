from celery import Celery
from backend.services.llm_service import generate_mql5_script, fix_mql5_script, parse_strategy_with_llm
from backend.services.validation_service import validate_strategy
from backend.api.models.strategy_models import StrategyJSON
import json
from backend.services.github_service import GitHubService
from backend.services.backtest_service import run_backtest
from backend.db.models import JobStatus, Job
from backend.db.database import get_db, SessionLocal
from backend.config import settings
import asyncio
import ssl

# Upstash Redis requires SSL — convert redis:// to rediss://
redis_url = settings.REDIS_URL
if redis_url.startswith("redis://") and "upstash.io" in redis_url:
    redis_url = redis_url.replace("redis://", "rediss://", 1)

celery_app = Celery("tasks", broker=redis_url, backend=redis_url)

# SSL config required for Upstash
celery_app.conf.broker_use_ssl = {"ssl_cert_reqs": ssl.CERT_NONE}
celery_app.conf.redis_backend_use_ssl = {"ssl_cert_reqs": ssl.CERT_NONE}

github = GitHubService()

MAX_COMPILE_RETRIES = 3  # Maximum LLM fix attempts before giving up

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


def compile_on_github(script_name: str, script_content: str):
    """Push script to GitHub, trigger Actions, wait for result, return build log."""
    # Push
    pushed, push_error = github.push_script(script_name, script_content)
    if not pushed:
        raise Exception(f"Failed to push script to GitHub: {push_error}")

    # Trigger workflow
    triggered = github.trigger_workflow(script_name)
    if not triggered:
        raise Exception("Failed to trigger GitHub Actions workflow")

    # Get the run ID
    run_id = github.get_latest_run_id(script_name)

    # Poll until done
    result = github.poll_run_completion(run_id, timeout=300)
    if not result["completed"]:
        raise Exception("Compilation timed out")

    # Download build log
    build_log = github.download_build_log(run_id)
    compile_success = "0 error" in build_log.lower()

    return build_log, compile_success, run_id


@celery_app.task
def process_strategy_pipeline(job_id: str, prompt: str):
    try:
        # ── Step 1: Parse & Validate ─────────────────────────────────
        update_job(job_id, status=JobStatus.PARSING)
        
        # Check if it's a mock trigger before parsing
        if prompt.strip() in ["1", "2", "3", "broken"]:
            strategy_data_str = prompt.strip()
            warnings = []
        else:
            # Check if prompt is already parsed JSON (submitted from "Make Strategy Safe" UI)
            try:
                potential_json = json.loads(prompt)
                if isinstance(potential_json, dict) and "entry" in potential_json:
                    parsed_strategy = potential_json
                else:
                    parsed_strategy = asyncio.run(parse_strategy_with_llm(prompt))
            except Exception:
                parsed_strategy = asyncio.run(parse_strategy_with_llm(prompt))

            # Validate the parsed JSON
            strategy_obj = StrategyJSON(**parsed_strategy)
            
            # Save parsed strategy to the database so frontend can read it if validation fails
            update_job(job_id, status=JobStatus.VALIDATING, parsed_strategy=json.dumps(parsed_strategy))
            validation_result = validate_strategy(strategy_obj)
            
            if validation_result["status"] == "failed":
                error_msgs = "\n".join(validation_result["errors"] + validation_result["warnings"])
                update_job(
                    job_id, 
                    status=JobStatus.FAILED, 
                    error_message=f"Strategy validation failed:\n{error_msgs}\n\nPlease review your strategy input and add missing safety points."
                )
                return
            
            strategy_data_str = json.dumps(parsed_strategy, indent=2)
            warnings = validation_result["warnings"]

        # ── Step 2: Generate MQL5 script via LLM ─────────────────────
        update_job(job_id, status=JobStatus.GENERATING)
        script_content, script_name = asyncio.run(generate_mql5_script(strategy_data_str, job_id, warnings))
        update_job(job_id, script_content=script_content, script_name=script_name)

        # ── Step 2: Compile → Check → Fix loop ───────────────────────
        compile_success = False
        build_log = ""
        run_id = None

        for attempt in range(1, MAX_COMPILE_RETRIES + 1):
            update_job(job_id, status=JobStatus.COMPILING,
                       error_message=f"Compilation attempt {attempt}/{MAX_COMPILE_RETRIES}")

            build_log, compile_success, run_id = compile_on_github(script_name, script_content)
            update_job(job_id, compile_log=build_log,
                       compile_success="yes" if compile_success else "no",
                       github_run_id=run_id)

            if compile_success:
                break  # Compiled successfully!

            # ── Compilation failed: ask LLM to fix ────────────────────
            if attempt < MAX_COMPILE_RETRIES:
                update_job(job_id, status=JobStatus.GENERATING,
                           error_message=f"Fixing errors (attempt {attempt + 1}/{MAX_COMPILE_RETRIES})")

                script_content = asyncio.run(
                    fix_mql5_script(prompt, script_content, build_log, attempt + 1)
                )
                update_job(job_id, script_content=script_content)

        if not compile_success:
            update_job(job_id, status=JobStatus.FAILED,
                       error_message=f"Compilation failed after {MAX_COMPILE_RETRIES} attempts.")
            return

        # ── Step 3: Backtesting ───────────────────────────────────────
        update_job(job_id, status=JobStatus.BACKTESTING)
        backtest_result = run_backtest(script_content, prompt)
        update_job(job_id, backtest_result=backtest_result)

        # ── Step 4: Done! ─────────────────────────────────────────────
        update_job(job_id, status=JobStatus.COMPLETED)

    except Exception as e:
        update_job(job_id, status=JobStatus.FAILED, error_message=str(e))
