#property copyright "MetaQuotes"
#property link      "https://www.mql5.com"
#property version   "1.00"
#property description "RSI-based trading strategy"
#property strict

// --- Required MQL5 libraries ---
#include <Trade\Trade.mqh>      // For CTrade class (sending orders)
#include <Trade\SymbolInfo.mqh> // For CSymbolInfo class (getting symbol details)

// --- Input Parameters ---
input string InpSymbol              = "XAUUSD";             // Trading Symbol
input ENUM_TIMEFRAMES InpTimeframe  = PERIOD_H1;            // Chart Timeframe

input int    InpRSIPeriod           = 14;                   // RSI Period
input double InpRSIBuyLevel         = 30.0;                 // RSI Buy Entry Level (below this)
input double InpRSIExitLevel        = 70.0;                 // RSI Buy Exit Level (above this)

input double InpLotSize             = 0.01;                 // Lot Size
input int    InpStopLossPoints      = 300;                  // Stop Loss in Points (0 for no SL)
input int    InpTakeProfitPoints    = 600;                  // Take Profit in Points (0 for no TP)
input int    InpTrailingStopPoints  = 100;                  // Trailing Stop in Points (0 for no Trailing Stop)
input int    InpSlippagePoints      = 30;                   // Maximum Slippage in Points

input int    InpMaxTradesPerDay     = 3;                    // Maximum trades per day

input ulong  InpMagicNumber         = 12345678;             // Magic Number for orders

// --- Global Objects ---
CTrade      m_trade;                // Trade object for sending orders
CSymbolInfo m_symbolInfo;           // Symbol information object

// --- Global Variables ---
int        m_rsiHandle;             // RSI indicator handle
double     m_point;                 // Symbol's point size
int        m_digits;                // Symbol's digits after decimal point
datetime   m_lastBarTime = 0;       // Stores the time of the last processed bar

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
    // Initialize CTrade object with magic number and EA name
    // Fix: Use MQL_PROGRAM_NAME instead of __FILE__ for the expert name.
    if (!m_trade.Init(InpMagicNumber, MQL_PROGRAM_NAME))
    {
        Print("Failed to initialize CTrade object. Error: ", GetLastError());
        return INIT_FAILED;
    }
    
    // Set slippage for CTrade object
    m_trade.SetDeviationInPoints(InpSlippagePoints);

    // Initialize CSymbolInfo for the specified symbol
    if (!m_symbolInfo.Name(InpSymbol))
    {
        Print("Failed to set symbol name for CSymbolInfo: ", InpSymbol);
        return INIT_FAILED;
    }

    // Refresh symbol information
    if (!m_symbolInfo.Refresh())
    {
        Print("Failed to get symbol info for ", InpSymbol);
        return INIT_FAILED;
    }

    m_point  = m_symbolInfo.Point();
    m_digits = m_symbolInfo.Digits();
    
    // Check if the current chart symbol matches the input symbol for easier debugging
    if (m_symbolInfo.Name() != _Symbol)
    {
        Print("Warning: The EA is attached to chart '", _Symbol, "', but configured to trade '", InpSymbol, "'. Please attach to '", InpSymbol, "' or change InpSymbol parameter.");
    }
    
    // Create RSI indicator handle
    m_rsiHandle = iRSI(InpSymbol, InpTimeframe, InpRSIPeriod, PRICE_CLOSE);
    if (m_rsiHandle == INVALID_HANDLE)
    {
        Print("Failed to create RSI indicator handle. Error code: ", GetLastError());
        return INIT_FAILED;
    }
    
    // Check if symbol is selected in Market Watch
    if (!SymbolInfoInteger(InpSymbol, SYMBOL_SELECT))
    {
        Print(InpSymbol," is not selected in Market Watch, attempting to add it now.");
        SymbolSelect(InpSymbol, true);
        if (!SymbolInfoInteger(InpSymbol, SYMBOL_SELECT))
        {
            Print("Failed to select ",InpSymbol," in Market Watch. Please add it manually or check symbol name.");
            return INIT_FAILED;
        }
    }

    // Validate input parameters
    if (InpLotSize <= 0)
    {
        Print("Lot size must be greater than 0.");
        return INIT_FAILED;
    }
    if (InpRSIPeriod <= 1)
    {
        Print("RSI Period must be greater than 1.");
        return INIT_FAILED;
    }
    if (InpRSIBuyLevel < 0 || InpRSIBuyLevel >= 50 || InpRSIExitLevel <= 50 || InpRSIExitLevel > 100)
    {
        Print("RSI levels for buy/sell are usually between 0-100. Check InpRSIBuyLevel and InpRSIExitLevel.");
    }

    Print("EA initialized successfully for ", InpSymbol, " ", EnumToString(InpTimeframe));
    return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
    // Clean up indicator handle
    if (m_rsiHandle != INVALID_HANDLE)
    {
        IndicatorRelease(m_rsiHandle);
    }
    Print("EA deinitialized. Reason: ", reason);
}

//+------------------------------------------------------------------+
//| Expert tick function                                             |
//+------------------------------------------------------------------+
void OnTick()
{
    // --- Check for new bar ---
    MqlRates rates[];
    // Get the last bar's data for the specified symbol and timeframe
    // Copy 1 bar starting from index 0 (the most recent completed bar).
    if (CopyRates(InpSymbol, InpTimeframe, 0, 1, rates) != 1)
    {
        // If we can't get rates, it might be due to no new data or network issues.
        // Or if the timeframe is not available for the symbol.
        Print("Failed to get rates for ", InpSymbol, " ", EnumToString(InpTimeframe), ". Error: ", GetLastError());
        return;
    }

    datetime currentBarTime = rates[0].time; // Time of the just completed bar
    if (currentBarTime == m_lastBarTime)
    {
        // No new bar yet, so exit
        return;
    }
    m_lastBarTime = currentBarTime; // Update the last processed bar time

    Print("New bar detected for ", InpSymbol, " ", EnumToString(InpTimeframe), " at ", TimeToString(currentBarTime, TIME_DATE|TIME_SECONDS));

    // --- Get RSI values ---
    double rsiBuffer[];
    // Copy the last 2 RSI values (current and previous bar)
    // rsiBuffer[0] will be for the most recently completed bar (matching rates[0])
    // rsiBuffer[1] will be for the bar prior to that.
    if (CopyBuffer(m_rsiHandle, 0, 0, 2, rsiBuffer) != 2)
    {
        Print("Failed to get RSI values. Error code: ", GetLastError());
        return;
    }

    double currentRSI  = rsiBuffer[0]; // RSI for the just closed bar
    double previousRSI = rsiBuffer[1]; // RSI for the bar before the just closed one

    // --- Trading Logic ---
    
    // Get count of BUY positions managed by this EA and symbol
    int buyPositionsCount = GetOpenPositionsCount(POSITION_TYPE_BUY);

    // --- Entry Logic (BUY) ---
    // Only attempt to open a new BUY position if no BUY positions are currently open
    if (buyPositionsCount == 0)
    {
        // Check if the maximum number of daily trades has been reached
        if (GetDailyTradesCount() >= InpMaxTradesPerDay)
        {
            Print("Maximum trades per day (", InpMaxTradesPerDay, ") reached for ", InpSymbol, ". Skipping new entry.");
            return; // Exit OnTick to prevent further actions on this bar
        }

        // RSI buy condition: previous bar's RSI was below the buy level (oversold)
        // This suggests a potential reversal from oversold conditions.
        if (previousRSI < InpRSIBuyLevel)
        {
            Print("BUY Signal detected: Previous RSI (", previousRSI, ") < Buy Level (", InpRSIBuyLevel, "). Attempting to open BUY position.");
            
            // Refresh symbol info to get the latest Ask price
            if (!m_symbolInfo.RefreshRates())
            {
                Print("Failed to refresh rates for ", InpSymbol, ". Error: ", GetLastError());
                return;
            }
            double askPrice = m_symbolInfo.Ask();
            if (askPrice == 0)
            {
                Print("Failed to get Ask price for ", InpSymbol);
                return;
            }

            // Calculate Stop Loss and Take Profit levels
            double slPrice = 0.0;
            if (InpStopLossPoints > 0)
            {
                slPrice = NormalizeDouble(askPrice - InpStopLossPoints * m_point, m_digits);
            }

            double tpPrice = 0.0;
            if (InpTakeProfitPoints > 0)
            {
                tpPrice = NormalizeDouble(askPrice + InpTakeProfitPoints * m_point, m_digits);
            }
            
            // Send BUY order
            if (m_trade.Buy(InpLotSize, InpSymbol, askPrice, slPrice, tpPrice, "RSI Buy Trade"))
            {
                Print("BUY order sent successfully. Volume: ", InpLotSize, ", Price: ", askPrice, ", SL: ", slPrice, ", TP: ", tpPrice);
            }
            else
            {
                Print("Failed to send BUY order. Error: ", m_trade.ResultRetcode(), " (", m_trade.ResultComment(), ")");
            }
        }
    }
    // --- Exit Logic (CLOSE BUY) and Trailing Stop ---
    else if (buyPositionsCount > 0) // If there are open BUY positions to manage
    {
        // RSI close condition: current bar's RSI crossed above the exit level (overbought)
        // This suggests a potential reversal from overbought conditions, signaling to close BUYs.
        if (currentRSI > InpRSIExitLevel)
        {
            Print("CLOSE BUY Signal detected: Current RSI (", currentRSI, ") > Exit Level (", InpRSIExitLevel, "). Attempting to close open BUY positions.");
            
            // Refresh symbol info to get the latest Bid price for closing
            if (!m_symbolInfo.RefreshRates())
            {
                Print("Failed to refresh rates for ", InpSymbol, ". Error: ", GetLastError());
                return;
            }

            // Iterate through open positions and close BUYs belonging to this EA and symbol
            for (int i = PositionsTotal() - 1; i >= 0; i--)
            {
                ulong positionTicket = PositionGetTicket(i);
                if (PositionSelectByTicket(positionTicket))
                {
                    if (PositionGetString(POSITION_SYMBOL) == InpSymbol && 
                        PositionGetInteger(POSITION_MAGIC) == InpMagicNumber &&
                        PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY)
                    {
                        if (m_trade.PositionClose(positionTicket))
                        {
                            Print("Closed BUY position ", positionTicket, ". Close Price: ", m_symbolInfo.Bid());
                        }
                        else
                        {
                            Print("Failed to close BUY position ", positionTicket, ". Error: ", m_trade.ResultRetcode(), " (", m_trade.ResultComment(), ")");
                        }
                    }
                }
            }
        }

        // --- Trailing Stop Logic for BUY positions ---
        if (InpTrailingStopPoints > 0)
        {
            // Refresh symbol info to get the latest Bid price
            if (!m_symbolInfo.RefreshRates())
            {
                Print("Failed to refresh rates for ", InpSymbol, ". Error: ", GetLastError());
                return;
            }
            double currentBid = m_symbolInfo.Bid();

            for (int i = PositionsTotal() - 1; i >= 0; i--)
            {
                ulong positionTicket = PositionGetTicket(i);
                if (PositionSelectByTicket(positionTicket))
                {
                    // Check if it's a BUY position managed by this EA for the correct symbol
                    if (PositionGetString(POSITION_SYMBOL) == InpSymbol &&
                        PositionGetInteger(POSITION_MAGIC) == InpMagicNumber &&
                        PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY)
                    {
                        double currentStopLoss = PositionGetDouble(POSITION_SL);
                        double openPrice       = PositionGetDouble(POSITION_PRICE_OPEN);

                        // Calculate the new potential stop loss based on trailing points
                        // For a BUY, SL should move up as price moves up.
                        double newStopLoss = NormalizeDouble(currentBid - InpTrailingStopPoints * m_point, m_digits);

                        // Only adjust SL if the position is in profit and the new SL is higher than the current SL
                        // (or if current SL is 0 and new SL is profitable)
                        // Ensure price has moved enough to cover the trailing stop distance from open price
                        if (currentBid > openPrice + InpTrailingStopPoints * m_point) 
                        {
                            // Ensure the new Stop Loss is above the open price and improves the current SL
                            // The condition `newStopLoss > openPrice` ensures we are locking in profit.
                            if (newStopLoss > currentStopLoss && newStopLoss > openPrice)
                            {
                                if (m_trade.PositionModify(positionTicket, newStopLoss, PositionGetDouble(POSITION_TP)))
                                {
                                    Print("Trailing Stop modified for BUY position ", positionTicket, ". Old SL: ", currentStopLoss, ", New SL: ", newStopLoss);
                                }
                                else
                                {
                                    Print("Failed to modify Trailing Stop for BUY position ", positionTicket, ". Error: ", m_trade.ResultRetcode(), " (", m_trade.ResultComment(), ")");
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

//+------------------------------------------------------------------+
//| Helper: Count open positions for this EA and symbol              |
//+------------------------------------------------------------------+
int GetOpenPositionsCount(ENUM_POSITION_TYPE type)
{
    int count = 0;
    for (int i = PositionsTotal() - 1; i >= 0; i--)
    {
        ulong positionTicket = PositionGetTicket(i);
        if (PositionSelectByTicket(positionTicket))
        {
            // Filter by symbol, magic number, and position type
            if (PositionGetString(POSITION_SYMBOL) == InpSymbol && 
                PositionGetInteger(POSITION_MAGIC) == InpMagicNumber &&
                PositionGetInteger(POSITION_TYPE) == type)
            {
                count++;
            }
        }
    }
    return count;
}

//+------------------------------------------------------------------+
//| Helper: Count total opening trades executed by this EA for the current day|
//+------------------------------------------------------------------+
int GetDailyTradesCount()
{
    int openTradeCount = 0;
    // Get the start of the current day for the specified symbol
    // Fix: Use InpSymbol for iTime to ensure consistency with trading symbol.
    datetime today = iTime(InpSymbol, PERIOD_D1, 0); 

    // Select all history from today to now
    if (!HistorySelect(today, TimeCurrent()))
    {
        Print("Failed to select history. Error: ", GetLastError());
        return 0;
    }

    int totalDeals = HistoryDealsTotal();
    for (int i = 0; i < totalDeals; i++)
    {
        ulong dealTicket = HistoryDealGetTicket(i);
        if (dealTicket != 0)
        {
            // Filter by symbol and magic number
            if (HistoryDealGetString(dealTicket, DEAL_SYMBOL) == InpSymbol &&
                HistoryDealGetInteger(dealTicket, DEAL_MAGIC) == InpMagicNumber &&
                HistoryDealGetInteger(dealTicket, DEAL_ENTRY) == DEAL_ENTRY_IN) // Count only opening deals
            {
                openTradeCount++;
            }
        }
    }
    return openTradeCount;
}