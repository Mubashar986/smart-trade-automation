#property copyright "Copyright 2023, MetaQuotes Software Corp."
#property link      "https://www.mql5.com"
#property version   "1.00"
#property strict
#property description "RSI-based Expert Advisor for XAUUSD H1"
#property program_name "strategy_5c7b87e6"

#include <Trade\Trade.mqh>
#include <Trade\SymbolInfo.mqh>
#include <Trade\AccountInfo.mqh>
#include <Indicators\RSI.mqh>
#include <MQL5\DateTime.mqh>

//--- Global Objects ---
CTrade             m_trade;           // Trading object
CSymbolInfo        m_symbol;          // Symbol information object
CAccountInfo       m_account;         // Account information object
int                m_rsi_handle;      // Handle for the RSI indicator

//--- Global Variables for OnTick logic ---
datetime           last_bar_time;     // Stores the time of the last processed bar to ensure once-per-bar logic
ulong              magic_number = 0x5c7b87e6; // Unique Magic Number for this EA's orders

//--- Risk Management Globals ---
int                trades_today_count = 0;         // Counter for trades executed today
datetime           last_day_reset;                 // Stores the last time trades_today_count was reset
double             initial_account_balance = 0.0;  // Account balance at EA start for drawdown calculation
int                consecutive_losses = 0;         // Counter for consecutive losing trades
bool               trading_disabled_by_drawdown = false;       // Flag to disable trading if max drawdown is exceeded
bool               trading_disabled_by_consecutive_losses = false; // Flag to disable trading if max consecutive losses are exceeded
ulong              last_processed_deal_ticket = 0; // To track the last deal processed for consecutive losses

//--- Input Parameters ---
input string               InpSymbol                   = "XAUUSD";         // Trading Symbol
input ENUM_TIMEFRAMES      InpTimeframe                = PERIOD_H1;        // Chart Timeframe
input int                  InpRSIPeriod                = 14;               // RSI Period
input double               InpRSIBuyLevel              = 30.0;             // RSI Buy Threshold (e.g., < 30)
input double               InpRSICloseLevel            = 70.0;             // RSI Close Threshold (e.g., > 70)
input double               InpLotSize                  = 0.01;             // Lot Size for Trades
input int                  InpStopLossPoints           = 300;              // Stop Loss in Points (e.g., 300 points = 30 pips for 5-digit)
input int                  InpTakeProfitPoints         = 600;              // Take Profit in Points
input int                  InpTrailingStopPoints       = 100;              // Trailing Stop in Points (0 to disable)
input int                  InpSlippagePoints           = 30;               // Maximum Slippage in Points
input int                  InpMaxTradesPerDay          = 3;                // Maximum Trades Per Day
input double               InpMaxDrawdownPercent       = 5.0;              // Max Drawdown Percentage (e.g., 5.0 for 5%)
input int                  InpMaxConsecutiveLosses     = 3;                // Max Consecutive Losing Trades

//+------------------------------------------------------------------+
//| Helper function to check and update consecutive losses           |
//+------------------------------------------------------------------+
void CheckAndUpdateConsecutiveLosses()
{
    // If trading is already disabled due to consecutive losses, no need to re-check
    if (trading_disabled_by_consecutive_losses) return;

    // Select all history to find the latest deals
    HistorySelect(0, TimeCurrent());
    ulong current_latest_deal_ticket = 0;
    
    // Iterate from the most recent deal to find the latest closing deal for our EA and symbol
    for (int i = HistoryDealsTotal() - 1; i >= 0; i--)
    {
        ulong deal_ticket = HistoryDealGetTicket(i);
        // Check if the deal belongs to our EA's magic number, is a closing deal, and for the correct symbol
        if (HistoryDealGetInteger(deal_ticket, DEAL_MAGIC) == magic_number && 
            HistoryDealGetInteger(deal_ticket, DEAL_ENTRY) == DEAL_ENTRY_OUT &&
            HistoryDealGetString(deal_ticket, DEAL_SYMBOL) == InpSymbol)
        {
            current_latest_deal_ticket = deal_ticket;
            break; // Found the most recent closing deal, exit loop
        }
    }

    // Process if a new closing deal has occurred
    if (current_latest_deal_ticket != 0 && current_latest_deal_ticket != last_processed_deal_ticket)
    {
        double profit = HistoryDealGetDouble(current_latest_deal_ticket, DEAL_PROFIT);
        
        if (profit < 0)
        {
            // This deal was a loss
            consecutive_losses++;
            PrintFormat("Deal #%lu for %s resulted in loss (%.2f). Consecutive losses: %d", 
                        current_latest_deal_ticket, InpSymbol, profit, consecutive_losses);
            
            // If max consecutive losses reached, disable trading
            if (consecutive_losses >= InpMaxConsecutiveLosses)
            {
                trading_disabled_by_consecutive_losses = true;
                PrintFormat("ALERT: Max consecutive losses (%d) reached. Trading disabled for this EA.", InpMaxConsecutiveLosses);
            }
        }
        else // Profit >= 0 (break-even or profitable)
        {
            // Reset consecutive loss counter on a non-losing trade
            if (profit > 0)
            {
                consecutive_losses = 0; 
                PrintFormat("Deal #%lu for %s resulted in profit (%.2f). Consecutive losses reset.", 
                            current_latest_deal_ticket, InpSymbol, profit);
            }
        }
        // Update the last processed deal ticket
        last_processed_deal_ticket = current_latest_deal_ticket;
    }
}

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
    //--- Initialize objects ---
    if(!m_symbol.Select(InpSymbol))
    {
        Print("Failed to select symbol: ", InpSymbol);
        return(INIT_FAILED);
    }
    m_trade.SetExpertMagicNumber(magic_number);
    m_trade.SetDeviationInPoints(InpSlippagePoints);
    m_trade.SetAsyncMode(false); // Synchronous trading operations

    //--- Validate inputs ---
    if (InpLotSize <= 0) { Print("Lot Size must be greater than 0."); return INIT_FAILED; }
    if (InpStopLossPoints < 0) { Print("Stop Loss Points cannot be negative."); return INIT_FAILED; }
    if (InpTakeProfitPoints < 0) { Print("Take Profit Points cannot be negative."); return INIT_FAILED; }
    if (InpTrailingStopPoints < 0) { Print("Trailing Stop Points cannot be negative."); return INIT_FAILED; }
    if (InpMaxTradesPerDay < 0) { Print("Max Trades Per Day cannot be negative."); return INIT_FAILED; }
    if (InpMaxDrawdownPercent < 0 || InpMaxDrawdownPercent >= 100) { Print("Max Drawdown Percent must be between 0 and 100."); return INIT_FAILED; }
    if (InpMaxConsecutiveLosses < 0) { Print("Max Consecutive Losses cannot be negative."); return INIT_FAILED; }

    //--- Get RSI indicator handle ---
    m_rsi_handle = iRSI(InpSymbol, InpTimeframe, InpRSIPeriod, PRICE_CLOSE);
    if (m_rsi_handle == INVALID_HANDLE)
    {
        Print("Failed to get RSI handle for ", InpSymbol, ", ", EnumToString(InpTimeframe), ", Period ", InpRSIPeriod);
        return(INIT_FAILED);
    }

    //--- Initialize risk management variables ---
    initial_account_balance = m_account.Balance();
    if (initial_account_balance <= 0)
    {
        Print("Initial account balance is zero or negative. Cannot determine max drawdown percentage. Trading disabled.");
        return(INIT_FAILED);
    }
    last_day_reset = TimeCurrent(); // Set initial day for reset logic
    
    Print("Expert Advisor Initialized successfully for ", InpSymbol, " ", EnumToString(InpTimeframe));
    // FIX: Corrected the Close level in the print statement
    Print("RSI Period: ", InpRSIPeriod, ", Buy < ", InpRSIBuyLevel, ", Close > ", InpRSICloseLevel);
    Print("Lot Size: ", InpLotSize, ", SL: ", InpStopLossPoints, ", TP: ", InpTakeProfitPoints);
    Print("Trailing Stop: ", InpTrailingStopPoints, ", Slippage: ", InpSlippagePoints);
    Print("Max Trades/Day: ", InpMaxTradesPerDay, ", Max Drawdown: ", InpMaxDrawdownPercent, "%, Max Consecutive Losses: ", InpMaxConsecutiveLosses);

    return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
    //--- Clean up indicator handle if necessary ---
    if (m_rsi_handle != INVALID_HANDLE)
    {
        // MQL5 handles indicator deletion automatically, no need for IndicatorRelease
        // IndicatorRelease(m_rsi_handle);
    }
    Print("Expert Advisor Deinitialized, Reason: ", reason);
}

//+------------------------------------------------------------------+
//| Expert tick function                                             |
//+------------------------------------------------------------------+
void OnTick()
{
    //--- Refresh symbol rates ---
    if (!m_symbol.RefreshRates())
    {
        Print("Failed to refresh rates for ", InpSymbol);
        return;
    }

    //--- Check for new bar to execute logic once per bar ---
    MqlRates rates[];
    if (CopyRates(InpSymbol, InpTimeframe, 0, 2, rates) != 2)
    {
        Print("Failed to get rates for ", InpSymbol, " ", EnumToString(InpTimeframe));
        return;
    }
    
    // Only proceed if it's a new bar
    if (rates[0].time == last_bar_time) return;
    last_bar_time = rates[0].time;

    //--- Daily Reset for trade counters and flags ---
    // Check if the current day is different from the last reset day
    if (TimeToString(rates[0].time, TIME_DATE) != TimeToString(last_day_reset, TIME_DATE))
    {
        trades_today_count = 0;
        consecutive_losses = 0; // Reset consecutive losses on a new day
        trading_disabled_by_consecutive_losses = false; // Re-enable trading after a new day
        trading_disabled_by_drawdown = false;           // Re-enable trading after a new day (if drawdown was the reason)
                                                        // Note: initial_account_balance is not reset, assumes it's fixed.
        last_day_reset = rates[0].time; // Update last_day_reset to the new bar's time for consistency
        Print("Daily reset: trades_today_count, consecutive_losses, and trading flags reset.");
    }
    
    //--- Call helper to update consecutive losses (covers SL/TP hits etc.) ---
    CheckAndUpdateConsecutiveLosses();

    //--- Risk Management Checks (Pre-Trade) ---
    // Static flags to print alerts only once when a disabled state is entered
    static bool drawdown_alert_printed = false;
    static bool consecutive_loss_alert_printed = false;

    if (trading_disabled_by_drawdown || trading_disabled_by_consecutive_losses)
    {
        // Print message once if just disabled, then suppress for subsequent ticks
        if (trading_disabled_by_drawdown && !drawdown_alert_printed)
        {
            Print("Trading currently disabled due to Max Drawdown.");
            drawdown_alert_printed = true;
        }
        if (trading_disabled_by_consecutive_losses && !consecutive_loss_alert_printed)
        {
            Print("Trading currently disabled due to Max Consecutive Losses.");
            consecutive_loss_alert_printed = true;
        }
        return; // Do not trade if disabled by risk management
    }
    else
    {
        // Reset alert flags if trading is re-enabled (e.g., by daily reset)
        drawdown_alert_printed = false;
        consecutive_loss_alert_printed = false;
    }

    // Check Max Trades Per Day
    if (trades_today_count >= InpMaxTradesPerDay)
    {
        //Print("Max trades per day (", InpMaxTradesPerDay, ") reached."); // Commented out to reduce log spam
        return; 
    }

    // Check Max Drawdown Percentage
    if (m_account.Equity() < initial_account_balance * (1.0 - InpMaxDrawdownPercent / 100.0))
    {
        if (!trading_disabled_by_drawdown) // Only print message once upon entering drawdown state
        {
            trading_disabled_by_drawdown = true;
            PrintFormat("ALERT: Max Drawdown (%.2f%%) exceeded. Trading disabled. Current Equity: %.2f, Initial Balance: %.2f", 
                        InpMaxDrawdownPercent, m_account.Equity(), initial_account_balance);
        }
        return;
    }

    //--- Get RSI value for the last closed bar ---
    double rsi_values[];
    // Shift 1 for the completed (closed) bar (rates[1] equivalent)
    if (CopyBuffer(m_rsi_handle, 0, 1, 1, rsi_values) != 1) 
    {
        Print("Failed to get RSI values.");
        return;
    }
    double current_rsi = rsi_values[0]; 
    
    //--- Check for open positions for this EA and symbol ---
    bool position_open = false;
    for (int i = PositionsTotal() - 1; i >= 0; i--)
    {
        ulong position_ticket = PositionGetTicket(i);
        if (PositionSelectByTicket(position_ticket)) // Select the position
        {
            if (PositionGetString(POSITION_SYMBOL) == InpSymbol && PositionGetInteger(POSITION_MAGIC) == magic_number)
            {
                position_open = true;
                ENUM_POSITION_TYPE position_type = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
                
                if (position_type == POSITION_TYPE_BUY)
                {
                    //--- Apply Trailing Stop Logic for BUY positions ---
                    if (InpTrailingStopPoints > 0)
                    {
                        double current_price = m_symbol.Bid();
                        double open_price = PositionGetDouble(POSITION_PRICE_OPEN);
                        double current_stop_loss = PositionGetDouble(POSITION_SL);
                        
                        // Trailing stop activation: price must be at least InpTrailingStopPoints profitable from open_price
                        double trailing_activation_level = open_price + InpTrailingStopPoints * m_symbol.Point();
                        
                        // Check if current price is above activation level
                        if (current_price > trailing_activation_level)
                        {
                            double new_stop_loss = current_price - InpTrailingStopPoints * m_symbol.Point();
                            new_stop_loss = m_symbol.NormalizePrice(new_stop_loss);
                            
                            // Only move SL if new SL is higher than the current one AND profitable (above open_price)
                            if (new_stop_loss > current_stop_loss && new_stop_loss > open_price)
                            {
                                if (m_trade.PositionModify(position_ticket, new_stop_loss, PositionGetDouble(POSITION_TP)))
                                {
                                    PrintFormat("Trailing Stop modified for BUY #%lu. New SL: %.5f", position_ticket, new_stop_loss);
                                }
                                else
                                {
                                    PrintFormat("Error modifying trailing stop for BUY #%lu: %d - %s", 
                                                position_ticket, m_trade.ResultRetcode(), m_trade.ResultRetcodeDescription());
                                }
                            }
                        }
                    }

                    //--- Exit Logic for BUY positions (RSI > InpRSICloseLevel) ---
                    if (current_rsi > InpRSICloseLevel)
                    {
                        if (m_trade.PositionClose(position_ticket))
                        {
                            PrintFormat("BUY #%lu closed due to RSI (%.2f) > close threshold (%.2f)", 
                                        position_ticket, current_rsi, InpRSICloseLevel);
                        }
                        else
                        {
                            PrintFormat("Error closing BUY #%lu: %d - %s", 
                                        position_ticket, m_trade.ResultRetcode(), m_trade.ResultRetcodeDescription());
                        }
                    }
                }
                // No SELL logic specified in the original request.
            }
        }
    }

    //--- Entry Logic (BUY) ---
    // Only place a new order if no positions for this EA are currently open
    if (!position_open)
    {
        // Condition: RSI < InpRSIBuyLevel
        if (current_rsi < InpRSIBuyLevel)
        {
            double open_price = m_symbol.Ask();
            double sl_price = open_price - InpStopLossPoints * m_symbol.Point();
            double tp_price = open_price + InpTakeProfitPoints * m_symbol.Point();
            
            // Normalize prices according to symbol's digits
            sl_price = m_symbol.NormalizePrice(sl_price);
            tp_price = m_symbol.NormalizePrice(tp_price);

            // Place BUY order
            if (m_trade.Buy(InpLotSize, InpSymbol, open_price, sl_price, tp_price, "RSI BUY entry"))
            {
                PrintFormat("BUY order placed. RSI: %.2f. SL: %.5f, TP: %.5f. Price: %.5f", 
                            current_rsi, sl_price, tp_price, open_price);
                trades_today_count++; // Increment trade counter
            }
            else
            {
                PrintFormat("Error placing BUY order: %d - %s", m_trade.ResultRetcode(), m_trade.ResultRetcodeDescription());
            }
        }
    }
}