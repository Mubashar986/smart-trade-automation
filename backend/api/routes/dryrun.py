from fastapi import APIRouter, Depends
from backend.services.dry_run_service import DryRunRequest, simulate_dry_run
from backend.db.models import User
from backend.services.auth_service import get_current_user

router = APIRouter(prefix="/api/v1", tags=["dryrun"])


@router.post("/dry-run")
async def run_dry_simulation(
    request: DryRunRequest,
    current_user: User = Depends(get_current_user),
):
    result = simulate_dry_run(request)
    return result
