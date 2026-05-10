#property copyright "MQL5 Expert Advisor Generator"
#property link      "https://www.mql5.com"
#property version   "1.00"
#property description "RSI Buy Strategy - strategy_3af718d9"
#property strict

//--- Include the standard library for CTrade object
#include <Trade/Trade.mqh>

//--- Input parameters
input int        InpMagicNumber      = 12345;            // Magic number for trades
input double     InpLotSize          = 0.01;             // Lot size
input int        InpStopLossPoints   = 300;              // Stop Loss in points (e.g., 300 for 30 pips)
input int        InpTakeProfitPoints = 600;              // Take Profit in points (e.g., 600 for 60 pips)
input int        InpSlippage         = 5;                // Max slippage in points (used by CTrade if not overriden)
input int        InpRSIPeriod        = 14;               // RSI period
input double     InpRSIBuyLevel      = 50.0;             // RSI level to Buy (RSI > this level)
input double     InpRSICloseLevel    = 50.0;             // RSI level to Close Buy (RSI < this level)
input int        InpMaxTradesPerDay  = 3;                // Maximum trades allowed per day

//--- Global variables
int               h_rsi;                  // Handle for RSI indicator
MqlRates          rates_info[];           // Array to store rates data for bar check
datetime          last_bar_time;          // Timestamp of the last processed bar
int               trades_today;           // Counter for trades opened today
datetime          current_day;            // Stores the current day for trade counting (start of day)
CTrade            trade;                  // Trade object for sending orders

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
    //--- Set up trade object properties
    trade.SetExpertMagicNumber(InpMagicNumber);
    trade.SetTypeFilling(ORDER_FILLING_FOK); // Fill or Kill order execution policy
    trade.SetAsyncMode(false);               // Synchronous trading operations (wait for server response)
    trade.SetDeviationInPoints(InpSlippage); // Set maximum allowed slippage

    //--- Get indicator handle for RSI
    // _Symbol represents the current chart symbol (e.g., GBPUSD)
    // _Period represents the current chart timeframe (e.g., PERIOD_H1)
    h_rsi = iRSI(_Symbol, _Period, InpRSIPeriod, PRICE_CLOSE);
    if (h_rsi == INVALID_HANDLE)
    {
        Print("Failed to get RSI handle for ", _Symbol, " ", EnumToString(_Period), ", Error: ", GetLastError());
        return INIT_FAILED; // Initialization failed
    }

    //--- Initialize last_bar_time to 0 to ensure the first tick processes the current bar correctly
    last_bar_time = 0;

    //--- Initialize trade counter for today
    // Get the start of the current day using iTime for PERIOD_D1
    current_day = iTime(_Symbol, PERIOD_D1, 0); 
    trades_today = 0; // Reset trade counter

    //--- Print EA initialization status and parameters
    Print("EA strategy_3af718d9 initialized successfully.");
    Print("Symbol: ", _Symbol, ", Timeframe: ", EnumToString(_Period));
    Print("RSI Period: ", InpRSIPeriod, ", Buy Level: ", InpRSIBuyLevel, ", Close Level: ", InpRSICloseLevel);
    Print("Lot Size: ", InpLotSize, ", SL: ", InpStopLossPoints, " points, TP: ", InpTakeProfitPoints, " points");
    Print("Max Trades per Day: ", InpMaxTradesPerDay);

    return INIT_SUCCEEDED; // Initialization succeeded
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
    //--- Release indicator handle to free resources
    if (h_rsi != INVALID_HANDLE)
    {
        IndicatorRelease(h_rsi);
    }
    Print("EA strategy_3af718d9 deinitialized. Reason: ", reason);
}

//+------------------------------------------------------------------+
//| Expert tick function                                             |
//+------------------------------------------------------------------+
void OnTick()
{
    //--- Check if there's a new bar to process
    // CopyRates copies rate data from the chart. We need the latest closed bar (index 0).
    if (CopyRates(_Symbol, _Period, 0, 1, rates_info) != 1)
    {
        Print("Error copying rates data: ", GetLastError());
        return;
    }

    datetime current_bar_time = rates_info[0].time; // Timestamp of the most recent closed bar

    // If the bar time hasn't changed since the last tick, exit (wait for a new bar)
    if (current_bar_time == last_bar_time)
    {
        return;
    }

    last_bar_time = current_bar_time; // Update the last processed bar time

    //--- Check for a new day and reset the trade counter if it's a new day
    datetime temp_current_day = iTime(_Symbol, PERIOD_D1, 0); // Get the start of the current day
    if (temp_current_day != current_day)
    {
        current_day = temp_current_day; // Update the current day
        trades_today = 0;               // Reset trade counter for the new day
        Print("New day started. Trades today reset to 0.");
    }

    //--- Get RSI values for the most recent closed bar
    double rsi_values[];
    // CopyBuffer copies indicator buffer data. Buffer 0 contains the main RSI line.
    // We copy 1 value starting from index 1 (the current closed bar).
    if (CopyBuffer(h_rsi, 0, 1, 1, rsi_values) != 1)
    {
        Print("Error copying RSI buffer: ", GetLastError());
        return;
    }

    double current_rsi = rsi_values[0]; // RSI value for the most recent closed bar

    //--- Get current Bid and Ask prices
    MqlTick latest_tick;
    if (!SymbolInfoTick(_Symbol, latest_tick))
    {
        Print("Error getting symbol tick info: ", GetLastError());
        return;
    }

    double current_bid = latest_tick.bid;
    double current_ask = latest_tick.ask;

    //--- Determine if there are open BUY positions managed by this EA
    bool has_buy_position = false;
    for (int i = 0; i < PositionsTotal(); i++) // Iterate through all open positions
    {
        // PositionGetTicket returns 'long'
        long position_ticket = PositionGetTicket(i); // Get position ticket
        // Check if the position belongs to this EA (via Magic Number) and symbol
        if (PositionGetInteger(POSITION_MAGIC) == InpMagicNumber && PositionGetString(POSITION_SYMBOL) == _Symbol)
        {
            // If it's a BUY position, set flag and break
            if (PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY)
            {
                has_buy_position = true;
                break;
            }
        }
    }

    //--- Strategy Logic: Exit condition for BUY position
    if (has_buy_position)
    {
        // If RSI drops below the close level, close existing BUY positions
        if (current_rsi < InpRSICloseLevel)
        {
            // Iterate backwards to safely close multiple positions without affecting loop indices
            for (int i = PositionsTotal() - 1; i >= 0; i--)
            {
                // PositionGetTicket returns 'long'
                long position_ticket = PositionGetTicket(i);
                // Check again to ensure we're closing our own BUY positions
                if (PositionGetInteger(POSITION_MAGIC) == InpMagicNumber &&
                    PositionGetString(POSITION_SYMBOL) == _Symbol &&
                    PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY)
                {
                    if (trade.PositionClose(position_ticket))
                    {
                        Print("Closed BUY position #", position_ticket, " at ", PositionGetDouble(POSITION_PRICE_CURRENT), " as RSI (", current_rsi, ") fell below ", InpRSICloseLevel);
                    }
                    else
                    {
                        Print("Failed to close BUY position #", position_ticket, ", Error: ", GetLastError());
                    }
                }
            }
        }
    }
    //--- Strategy Logic: Entry condition for BUY position
    else
    {
        // If no BUY position is open and RSI is above the buy level
        if (current_rsi > InpRSIBuyLevel)
        {
            // Check if the maximum trades allowed per day has not been reached
            if (trades_today < InpMaxTradesPerDay)
            {
                // Calculate Stop Loss and Take Profit levels
                double stop_loss_price = 0;
                double take_profit_price = 0;

                // For a BUY order:
                // SL is calculated below the current Ask price.
                // TP is calculated above the current Ask price.
                // _Point is the smallest price change for the symbol (e.g., 0.00001 for 5-digit)
                stop_loss_price = current_ask - InpStopLossPoints * _Point;
                take_profit_price = current_ask + InpTakeProfitPoints * _Point;

                // Normalize prices to the symbol's number of decimal digits for accurate quoting
                stop_loss_price = NormalizeDouble(stop_loss_price, _Digits);
                take_profit_price = NormalizeDouble(take_profit_price, _Digits);

                // Send BUY order using the CTrade object
                if (trade.Buy(InpLotSize, _Symbol, current_ask, stop_loss_price, take_profit_price, "RSI Buy Entry"))
                {
                    Print("Successfully sent BUY order. Ask: ", current_ask, ", SL: ", stop_loss_price, ", TP: ", take_profit_price, ", RSI: ", current_rsi);
                    trades_today++; // Increment trade counter only on successful order placement
                }
                else
                {
                    Print("Failed to send BUY order. Ask: ", current_ask, ", Error: ", GetLastError());
                }
            }
            // else { Print("Max trades per day (", InpMaxTradesPerDay, ") reached. No new BUY orders."); }
        }
    }
}