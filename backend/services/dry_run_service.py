import random
from typing import Literal
from pydantic import BaseModel


class DryRunRequest(BaseModel):
    symbol: str = "XAUUSD"
    direction: Literal["BUY", "SELL"] = "BUY"
    entry_price: float
    stop_loss_points: int
    take_profit_points: int
    lot_size: float = 0.01
    point_size: float = 1.0          # 1 point = 1 price unit (e.g. SL of 20 means price moves 20 units)
    duration_seconds: int = 60
    scenario: Literal["random", "bullish", "bearish", "sideways"] = "random"


def generate_mock_movement(scenario: str, point_size: float, tick_size: float) -> float:
    """tick_size = ~1/10th of the average SL range for proportional movement."""
    base = tick_size * random.uniform(0.5, 2.5)
    if scenario == "bullish":
        return abs(base)
    elif scenario == "bearish":
        return -abs(base)
    elif scenario == "sideways":
        return base * random.choice([1, -1]) * random.uniform(0.3, 1.0)
    else:  # random
        return base * random.choice([1, -1])


def simulate_dry_run(req: DryRunRequest) -> dict:
    entry = req.entry_price

    if req.direction == "BUY":
        sl_price = entry - (req.stop_loss_points * req.point_size)
        tp_price = entry + (req.take_profit_points * req.point_size)
    else:
        sl_price = entry + (req.stop_loss_points * req.point_size)
        tp_price = entry - (req.take_profit_points * req.point_size)

    price = entry
    # tick_size = ~1/10th of the smaller of SL/TP range, ensures chart movement is proportional
    sl_range = abs(req.stop_loss_points * req.point_size)
    tp_range = abs(req.take_profit_points * req.point_size)
    tick_size = min(sl_range, tp_range) / 10.0 or (req.point_size * 2)

    price_path = [{"time": 0, "price": round(price, 5), "event": "ENTRY"}]

    result = "NO_EXIT"
    exit_price = None
    exit_time = None

    for t in range(1, req.duration_seconds + 1):
        price += generate_mock_movement(req.scenario, req.point_size, tick_size)
        event = None

        if req.direction == "BUY":
            if price <= sl_price:
                price, event, result = sl_price, "STOP_LOSS_HIT", "STOP_LOSS_HIT"
                exit_price, exit_time = price, t
            elif price >= tp_price:
                price, event, result = tp_price, "TAKE_PROFIT_HIT", "TAKE_PROFIT_HIT"
                exit_price, exit_time = price, t
        else:
            if price >= sl_price:
                price, event, result = sl_price, "STOP_LOSS_HIT", "STOP_LOSS_HIT"
                exit_price, exit_time = price, t
            elif price <= tp_price:
                price, event, result = tp_price, "TAKE_PROFIT_HIT", "TAKE_PROFIT_HIT"
                exit_price, exit_time = price, t

        price_path.append({"time": t, "price": round(price, 5), "event": event})
        if event:
            break

    if result == "TAKE_PROFIT_HIT":
        pnl_points = req.take_profit_points
    elif result == "STOP_LOSS_HIT":
        pnl_points = -req.stop_loss_points
    else:
        pnl_points = round(
            (price - entry) / req.point_size if req.direction == "BUY"
            else (entry - price) / req.point_size, 2
        )

    rr = round(req.take_profit_points / req.stop_loss_points, 2) if req.stop_loss_points > 0 else None

    return {
        "symbol": req.symbol,
        "direction": req.direction,
        "scenario": req.scenario,
        "entry_price": entry,
        "stop_loss_price": round(sl_price, 5),
        "take_profit_price": round(tp_price, 5),
        "result": result,
        "exit_price": round(exit_price, 5) if exit_price else None,
        "exit_time": exit_time,
        "pnl_points": pnl_points,
        "risk_reward_ratio": rr,
        "price_path": price_path,
        "note": "This is a mock dry-run simulation for visual purposes only. Not financial advice."
    }
