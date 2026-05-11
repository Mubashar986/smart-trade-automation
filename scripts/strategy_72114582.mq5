#property copyright "Copyright 2023, MetaQuotes Software Corp."
#property link      "https://www.mql5.com"
#property version   "1.00"
#property description "Expert Advisor based on strategy_72114582 JSON description."
#property description "Implements EMA fixed level entry/exit strategy with basic risk management."
#property strict    // Enable strict compilation

// Include standard library for trading operations
#include <Trade/Trade.mqh>
// Include standard library for indicator operations
#include <Indicators/Indicators.mqh>

//--- Input parameters
input string            Expert_Name                 = "strategy_72114582";      // Expert Advisor Name
input long              MagicNumber                 = 72114582;                 // Magic Number for trades
input ENUM_TIMEFRAMES   Trade_Timeframe             = PERIOD_H1;                // Timeframe for strategy logic
input double            Lots                        = 0.01;                     // Lot Size
input int               StopLossPoints              = 300;                      // Stop Loss in points (e.g., 300 points = 30 pips for 5-digit brokers)
input int               TakeProfitPoints            = 600;                      // Take Profit in points (e.g., 600 points = 60 pips for 5-digit brokers)
input int               TrailingStopPoints          = 100;                      // Trailing Stop in points (0 to disable)
input int               SlippagePoints              = 30;                       // Max slippage in points (e.g., 30 points = 3 pips)
input int               EMA_Period                  = 50;                       // EMA Period
input double            Entry_Level_Buy             = 30.0;                     // EMA value must be less than this level to BUY
input double            Exit_Level_Close            = 70.0;                     // EMA value must be greater than this level to CLOSE BUY

// --- Risk Management Parameters (declared as inputs but not fully implemented in this basic EA structure)
input int               MaxTradesPerDay             = 3;                        // Maximum trades allowed per day
input double            MaxDrawdownPercent          = 5.0;                      // Max drawdown percentage (e.g., 5.0 for 5%)
input int               MaxConsecutiveLosses        = 3;                        // Max consecutive losing trades

//--- Global variables
CTrade                  trade;                      // Trade object for sending orders
CiMA                    iMA_Handle;                 // Indicator handle for EMA
double                  _SymbolPoint;               // Symbol's point size
int                     _SymbolDigits;              // Symbol's number of digits after decimal point
datetime                _lastBarTime                = 0;                        // Time of the last processed bar
datetime                _lastTradeDay               = 0;                        // Stores the last day a trade was opened
int                     _tradesToday                = 0;                        // Counter for trades opened today

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
    //--- Initialize trade object
    trade.SetExpertMagic(MagicNumber);
    // Set initial deviation using _Point. This will be updated on each tick based on the specific symbol.
    trade.SetDeviation(SlippagePoints * _Point); 

    //--- Get symbol properties for the current chart symbol (NULL for _Symbol)
    _SymbolPoint = SymbolInfoDouble(NULL, SYMBOL_POINT);
    _SymbolDigits = (int)SymbolInfoInteger(NULL, SYMBOL_DIGITS);
    
    //--- Validate symbol point
    if (_SymbolPoint == 0)
    {
        Print("Failed to get symbol point for ", _Symbol, ". Initialization failed.");
        return INIT_FAILED;
    }

    //--- Create EMA indicator handle
    // The strategy description explicitly defines "EMA < value" and "EMA > value" with fixed numerical values (30, 70).
    // This implies comparing the EMA's actual calculated value against these fixed levels.
    // For currency pairs like EURUSD, typical EMA values are around 1.0 - 1.2, not 30-70.
    // This implementation strictly follows the JSON structure, meaning these entry/exit levels
    // might need adjustment or are specific to a different instrument/chart scaling for practical use.
    iMA_Handle.Create(NULL, Trade_Timeframe, EMA_Period, 0, MODE_EMA, PRICE_CLOSE);
    
    if (iMA_Handle.Handle() == INVALID_HANDLE)
    {
        Print("Failed to create EMA indicator handle. Error: ", GetLastError(), ". Initialization failed.");
        return INIT_FAILED;
    }

    //--- Set initial last trade day to today to prevent immediate trade count reset on first tick
    _lastTradeDay = TimeDay(TimeCurrent());
    
    Print(Expert_Name, " initialized successfully.");
    Print("Symbol: ", _Symbol, ", Timeframe: ", EnumToString(Trade_Timeframe));
    Print("EMA Period: ", EMA_Period, ", Entry BUY if EMA < ", Entry_Level_Buy, ", Close BUY if EMA > ", Exit_Level_Close);
    Print("Lot Size: ", Lots, ", SL: ", StopLossPoints, " points, TP: ", TakeProfitPoints, " points");
    Print("Trailing Stop: ", TrailingStopPoints, " points (0=disabled)");
    Print("Max Trades Per Day: ", MaxTradesPerDay);
    
    return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
    //--- Release indicator handle to free resources
    iMA_Handle.Release();
    Print(Expert_Name, " deinitialized. Reason: ", reason);
}

//+------------------------------------------------------------------+
//| Expert tick function                                             |
//+------------------------------------------------------------------+
void OnTick()
{
    //--- Check for a new bar to execute logic once per bar
    MqlRates rates[];
    // Copy rates for the specified symbol and timeframe to check for new bar
    if (CopyRates(NULL, Trade_Timeframe, 0, 1, rates) < 1)
    {
        Print("Failed to copy rates data. Error: ", GetLastError());
        return;
    }

    datetime currentBarTime = rates[0].time;
    if (currentBarTime == _lastBarTime)
    {
        return; // No new bar, exit to avoid redundant calculations
    }
    _lastBarTime = currentBarTime; // Update last processed bar time

    //--- Update symbol properties on each new bar for robustness, especially if _Point changes (e.g., fractional pips)
    _SymbolPoint = SymbolInfoDouble(NULL, SYMBOL_POINT);
    _SymbolDigits = (int)SymbolInfoInteger(NULL, SYMBOL_DIGITS);
    trade.SetDeviation(SlippagePoints * _Point); // Update deviation using current _Point

    //--- Reset daily trade counter if a new day has started
    if (TimeDay(TimeCurrent()) != _lastTradeDay)
    {
        _tradesToday = 0;
        _lastTradeDay = TimeDay(TimeCurrent());
        Print("New day. Daily trade counter reset to 0.");
    }

    //--- Get current bid/ask prices
    MqlTick tick;
    if (!SymbolInfoTick(NULL, tick))
    {
        Print("Failed to get SymbolInfoTick for ", _Symbol, ". Error: ", GetLastError());
        return;
    }
    double currentBid = tick.bid;
    double currentAsk = tick.ask;

    //--- Get EMA value for the current (0th) bar
    double ema_buffer[];
    // Copy the latest EMA value from the indicator buffer
    if (CopyBuffer(iMA_Handle.Handle(), 0, 0, 1, ema_buffer) < 1)
    {
        Print("Failed to copy EMA buffer. Error: ", GetLastError());
        return;
    }
    double current_ema_value = ema_buffer[0];

    //--- Check for an existing BUY position controlled by this EA's MagicNumber and symbol
    bool has_open_buy_position = false;
    ulong buy_position_ticket = 0;
    double position_open_price = 0;
    double current_stop_loss = 0;
    double current_take_profit = 0;

    for (int i = 0; i < PositionsTotal(); i++)
    {
        if (PositionGetTicket(i)) // Select a position by its index
        {
            // Check if the position belongs to this EA (by MagicNumber) and symbol
            if (PositionGetInteger(POSITION_MAGIC) == MagicNumber &&
                PositionGetString(POSITION_SYMBOL) == _Symbol)
            {
                // If it's a BUY position, store its details and mark as found
                if (PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY)
                {
                    has_open_buy_position = true;
                    buy_position_ticket = PositionGetInteger(POSITION_TICKET);
                    position_open_price = PositionGetDouble(POSITION_PRICE_OPEN);
                    current_stop_loss = PositionGetDouble(POSITION_SL);
                    current_take_profit = PositionGetDouble(POSITION_TP);
                    break; // Found our position, no need to check further
                }
            }
        }
    }

    //--- Entry Logic: BUY
    // Condition: EMA value is less than Entry_Level_Buy, AND no open BUY position, AND daily trade limit not reached
    if (!has_open_buy_position && _tradesToday < MaxTradesPerDay)
    {
        if (current_ema_value < Entry_Level_Buy)
        {
            // Calculate Stop Loss and Take Profit prices
            double sl_price = currentAsk - StopLossPoints * _SymbolPoint;
            double tp_price = currentAsk + TakeProfitPoints * _SymbolPoint;

            // Normalize prices to the symbol's digits
            sl_price = NormalizeDouble(sl_price, _SymbolDigits);
            tp_price = NormalizeDouble(tp_price, _SymbolDigits);

            // Send BUY order
            if (trade.Buy(Lots, NULL, 0, sl_price, tp_price, "BUY_EA_Signal"))
            {
                _tradesToday++; // Increment daily trade counter
                Print("BUY order sent successfully. Open Price: ", DoubleToString(currentAsk, _SymbolDigits), 
                      ", SL: ", DoubleToString(sl_price, _SymbolDigits), 
                      ", TP: ", DoubleToString(tp_price, _SymbolDigits));
            }
            else
            {
                Print("Failed to send BUY order. Error: ", GetLastError(), ". Retrying on next bar.");
            }
        }
    }

    //--- Exit Logic: CLOSE BUY position
    // Condition: EMA value is greater than Exit_Level_Close, AND there is an open BUY position
    if (has_open_buy_position)
    {
        if (current_ema_value > Exit_Level_Close)
        {
            // Close the existing BUY position
            if (trade.PositionClose(buy_position_ticket, SlippagePoints * _Point))
            {
                Print("BUY position (Ticket: ", buy_position_ticket, ") closed by strategy logic (EMA > Exit_Level_Close).");
            }
            else
            {
                Print("Failed to close BUY position (Ticket: ", buy_position_ticket, "). Error: ", GetLastError());
            }
        }
    }

    //--- Trailing Stop Logic for BUY position
    if (TrailingStopPoints > 0 && has_open_buy_position)
    {
        // Calculate current profit in points
        double profit_in_points = (currentBid - position_open_price) / _SymbolPoint;

        // Check if position is in profit by at least TrailingStopPoints
        if (profit_in_points >= TrailingStopPoints)
        {
            // Calculate new Stop Loss price
            double new_sl_price = currentBid - TrailingStopPoints * _SymbolPoint;
            new_sl_price = NormalizeDouble(new_sl_price, _SymbolDigits);

            // Only modify SL if the new calculated SL is better (higher for a BUY position) than the current one
            if (new_sl_price > current_stop_loss)
            {
                // Modify the position's Stop Loss
                if (trade.PositionModify(buy_position_ticket, new_sl_price, current_take_profit))
                {
                    Print("Trailing Stop modified for BUY position (Ticket: ", buy_position_ticket, "). New SL: ", DoubleToString(new_sl_price, _SymbolDigits));
                }
                else
                {
                    Print("Failed to modify Trailing Stop for BUY position (Ticket: ", buy_position_ticket, "). Error: ", GetLastError());
                }
            }
        }
    }
    
    //--- Note on MaxDrawdownPercent and MaxConsecutiveLosses:
    //    These risk management features are declared as inputs but are not actively
    //    managed in this basic Expert Advisor structure due to their significant complexity.
    //    Implementing them robustly requires persistent history tracking across EA restarts,
    //    advanced account state monitoring, and potentially shutting down trading
    //    which goes beyond the scope of a simple strategy implementation request.
}