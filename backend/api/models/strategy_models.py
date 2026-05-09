from pydantic import BaseModel, Field
from typing import Optional, Literal

class StrategyEntry(BaseModel):
    indicator: str
    period: Optional[int] = None
    operator: str
    value: float
    action: str

class StrategyExit(BaseModel):
    indicator: str
    period: Optional[int] = None
    operator: str
    value: float
    action: str

class StrategyRisk(BaseModel):
    lot_size: float = 0.01
    stop_loss_points: Optional[int] = None
    take_profit_points: Optional[int] = None
    max_trades_per_day: Optional[int] = 3
    max_drawdown_percent: Optional[float] = None
    max_consecutive_losses: Optional[int] = None
    trailing_stop_points: Optional[int] = None
    slippage_points: Optional[int] = None

class StrategyJSON(BaseModel):
    symbol: str = "XAUUSD"
    timeframe: str = "H1"
    strategy_type: str
    entry: StrategyEntry
    exit: StrategyExit
    risk: StrategyRisk
