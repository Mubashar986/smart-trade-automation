from backend.api.models.strategy_models import StrategyJSON

def validate_strategy(strategy: StrategyJSON) -> dict:
    errors = []
    warnings = []

    # Rule 1: Symbol is required
    if not strategy.symbol or strategy.symbol.strip() == "":
        errors.append("Rule 1 Failed: Symbol is required. Please specify a trading symbol (e.g. XAUUSD, EURUSD).")

    # Rule 2: Timeframe is required
    valid_timeframes = ["M1", "M5", "M15", "M30", "H1", "H4", "D1"]
    if not strategy.timeframe or strategy.timeframe.strip() == "":
        errors.append("Rule 2 Failed: Timeframe is required. Please specify a timeframe (e.g. H1, M15, D1).")
    elif strategy.timeframe.upper() not in valid_timeframes:
        errors.append(f"Rule 2 Failed: Timeframe '{strategy.timeframe}' is not valid. Use one of: {', '.join(valid_timeframes)}.")

    # Rule 3: Entry condition is required
    if strategy.entry is None:
        errors.append("Rule 3 Failed: Entry condition is required. Please define when the bot should enter a trade.")
    else:
        if not strategy.entry.indicator or strategy.entry.indicator.strip() == "":
            errors.append("Rule 3 Failed: Entry indicator is missing. Specify an indicator (e.g. RSI, MA).")
        if not strategy.entry.action or strategy.entry.action.upper() not in ["BUY", "SELL"]:
            errors.append("Rule 3 Failed: Entry action must be BUY or SELL.")

    # Rule 4: Exit condition is required
    if strategy.exit is None:
        errors.append("Rule 4 Failed: Exit condition is required. Please define when the bot should close a trade.")
    else:
        if not strategy.exit.indicator or strategy.exit.indicator.strip() == "":
            errors.append("Rule 4 Failed: Exit indicator is missing. Specify an indicator (e.g. RSI, MA).")
        if not strategy.exit.action or strategy.exit.action.upper() not in ["CLOSE", "BUY", "SELL"]:
            errors.append("Rule 4 Failed: Exit action must be CLOSE, BUY, or SELL.")

    # Rule 5: Lot size must be within safe range
    lot = strategy.risk.lot_size
    if lot is None:
        errors.append("Rule 5 Failed: Lot size is required. A safe minimum is 0.01.")
    elif lot < 0.01:
        errors.append(f"Rule 5 Failed: Lot size {lot} is too small. Minimum safe lot size is 0.01.")
    elif lot > 1.0:
        errors.append(f"Rule 5 Failed: Lot size {lot} is too large. Maximum safe lot size is 1.0.")

    # Rule 6: Stop-loss is recommended
    if strategy.risk.stop_loss_points is None or strategy.risk.stop_loss_points <= 0:
        warnings.append("Rule 6 Warning: Stop-loss is missing or zero. Trading without a stop-loss exposes your account to unlimited losses. Please add a stop-loss (recommended: 300 points).")

    # Rule 7: Buy/sell logic should not conflict
    if strategy.entry and strategy.exit:
        entry_action = (strategy.entry.action or "").upper()
        exit_action = (strategy.exit.action or "").upper()
        same_indicator = strategy.entry.indicator == strategy.exit.indicator
        same_operator = strategy.entry.operator == strategy.exit.operator
        same_value = strategy.entry.value == strategy.exit.value

        # Detect fully identical entry and exit
        if same_indicator and same_operator and same_value:
            errors.append("Rule 7 Failed: Buy/sell logic conflicts — entry and exit conditions are identical. The bot cannot determine when to open vs close a trade.")

        # Detect conflicting actions (e.g. BUY entry with BUY exit)
        if entry_action == "BUY" and exit_action == "BUY":
            errors.append("Rule 7 Failed: Buy/sell logic conflicts — entry action is BUY but exit action is also BUY. Exit should be CLOSE or SELL.")
        if entry_action == "SELL" and exit_action == "SELL":
            errors.append("Rule 7 Failed: Buy/sell logic conflicts — entry action is SELL but exit action is also SELL. Exit should be CLOSE or BUY.")

    # Rule 8: Max trades per day should be limited
    mtd = strategy.risk.max_trades_per_day
    if mtd is None:
        warnings.append("Rule 8 Warning: Max trades per day is not set. Without a daily trade limit, the bot may overtrade and deplete your account rapidly.")
    elif mtd <= 0:
        errors.append("Rule 8 Failed: Max trades per day must be at least 1.")
    elif mtd > 10:
        errors.append(f"Rule 8 Failed: Max trades per day is {mtd}, which is too high and risks overtrading. Maximum allowed is 10.")

    # Rule 9: Strategy should not use unlimited martingale
    # Martingale is detected if lot size doubles aggressively with no drawdown cap
    if strategy.risk.lot_size and strategy.risk.lot_size >= 1.0 and strategy.risk.max_drawdown_percent is None:
        errors.append("Rule 9 Failed: Strategy appears to use an unlimited martingale pattern (max lot size with no drawdown limit). This can wipe out an account instantly. Please set a max drawdown limit.")

    # Rule 10: Strategy should not open infinite positions
    if mtd is not None and strategy.risk.stop_loss_points is None and mtd > 5:
        errors.append("Rule 10 Failed: Strategy may open infinite positions — no stop-loss and a high trade frequency means losses can stack indefinitely. Please add a stop-loss and reduce max trades per day.")

    # Determine final status
    status = "passed"
    if errors or warnings:
        status = "failed"

    return {
        "status": status,
        "errors": errors,
        "warnings": warnings
    }
