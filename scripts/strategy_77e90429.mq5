//+------------------------------------------------------------------+
//|                                                strategy_77e90429.mq5 |
//|                                                       Generated EA |
//|                                            https://www.mql5.com |
//+------------------------------------------------------------------+
#property copyright "Generated EA"
#property link      "https://www.mql5.com"
#property version   "1.00"
#property strict
#property expert_show_inputs

#include <Trade/Trade.mqh> // Include CTrade class for easy order management

//--- Input parameters
input string   SymbolName          = "XAUUSD";      // Symbol to trade (XAUUSD)
input ENUM_TIMEFRAMES Timeframe     = PERIOD_H1;   // Timeframe for the strategy
input int      RSI_Period          = 14;            // RSI period
input double   RSI_Oversold_Level  = 30;            // RSI oversold level for BUY entry
input double   RSI_Overbought_Level = 70;           // RSI overbought level for CLOSE BUY exit

input double   LotSize             = 0.01;          // Lot size for trades
input int      StopLossPoints      = 300;           // Stop Loss in points (e.g., 300 points = 30 pips for 5-digit brokers)
input int      TakeProfitPoints    = 600;           // Take Profit in points
input int      SlippagePoints      = 3;             // Max slippage in points

input int      MaxTradesPerDay     = 3;             // Maximum trades allowed per day
input long     MagicNumber         = 12345;         // Unique magic number for this EA's trades

//--- Global variables
CTrade         m_trade;           // CTrade object for trading operations
int            m_rsi_handle;      // Handle for the RSI indicator
double         m_rsi_buffer[];    // Buffer to store RSI values

datetime       m_last_bar_time = 0;       // Timestamp of the last processed bar
datetime       m_last_trade_day_start = 0; // Stores the start of the day for trade counting
int            m_trades_today = 0;        // Counter for trades opened today

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   //--- Set up CTrade object
   m_trade.SetExpertMagicNumber(MagicNumber);
   // Changed to ORDER_FILLING_IOC for broader compatibility. FOK is very strict and might often fail.
   m_trade.SetTypeFilling(ORDER_FILLING_IOC); // Immediate or Cancel order type
   m_trade.SetAsyncMode(false);              // Synchronous order sending
   // Set slippage for CTrade operations (in points). CTrade::SetDeviation takes points directly.
   m_trade.SetDeviation(SlippagePoints);

   //--- Create RSI indicator handle
   // Use PRICE_CLOSE for the applied price as per standard RSI calculation
   m_rsi_handle = iRSI(SymbolName, Timeframe, RSI_Period, PRICE_CLOSE);
   
   //--- Check if RSI handle creation was successful
   if (m_rsi_handle == INVALID_HANDLE)
   {
      Print("Error creating RSI indicator handle for ", SymbolName, " on ", EnumToString(Timeframe), ", error code: ", GetLastError());
      return INIT_FAILED;
   }
   
   //--- Initialize m_last_trade_day_start to the beginning of the current day
   // This ensures the daily trade counter resets correctly upon EA start
   m_last_trade_day_start = (datetime)(TimeCurrent() / 86400) * 86400;

   Print("EA Initialized successfully. Symbol: ", SymbolName, ", Timeframe: ", EnumToString(Timeframe));
   
   return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   //--- Release the indicator handle to free up resources
   if (m_rsi_handle != INVALID_HANDLE)
   {
      IndicatorRelease(m_rsi_handle);
   }
   Print("EA Deinitialized. Reason: ", reason);
}

//+------------------------------------------------------------------+
//| Expert tick function                                             |
//+------------------------------------------------------------------+
void OnTick()
{
   //--- Check for new bar to avoid re-calculating on every tick within the same bar
   // This strategy uses RSI on closed bars. So, we want to execute logic
   // when a new H1 bar has just closed (index 1 for the previous closed bar).
   datetime current_bar_time = iTime(SymbolName, Timeframe, 1); // Get open time of the previously closed bar
   if (current_bar_time == 0) // Check if iTime returned valid time (0 indicates error)
   {
      Print("Error getting current bar time for ", SymbolName, " on ", EnumToString(Timeframe), ", error code: ", GetLastError());
      return;
   }
   
   if (m_last_bar_time == current_bar_time)
   {
      return; // No new bar has closed, wait for the next one
   }
   
   // A new bar has formed (previous bar closed), update the last bar time
   m_last_bar_time = current_bar_time;
   
   //--- Check if a new day has started to reset trade counter
   datetime current_day_start = (datetime)(TimeCurrent() / 86400) * 86400; // Calculate start of current day
   if (current_day_start != m_last_trade_day_start)
   {
      m_trades_today = 0;
      m_last_trade_day_start = current_day_start;
      Print("New day started. Trades counter reset to 0.");
   }

   //--- Get the RSI value for the most recently CLOSED bar (index 1)
   // Copy 1 value from index 1 (the previous closed bar) into m_rsi_buffer[0]
   if (CopyBuffer(m_rsi_handle, 0, 1, 1, m_rsi_buffer) != 1)
   {
      Print("Error copying RSI buffer for ", SymbolName, " on ", EnumToString(Timeframe), ", error code: ", GetLastError());
      return;
   }
   
   double current_rsi = m_rsi_buffer[0]; // RSI value of the previous closed bar
   
   //--- Get current bid and ask prices
   double bid_price = SymbolInfoDouble(SymbolName, SYMBOL_BID);
   double ask_price = SymbolInfoDouble(SymbolName, SYMBOL_ASK);
   
   if (bid_price <= 0 || ask_price <= 0)
   {
       Print("Error getting current bid/ask prices for ", SymbolName, ". Bid: ", bid_price, ", Ask: ", ask_price);
       return;
   }

   //--- Get symbol info for price normalization
   double point_size = SymbolInfoDouble(SymbolName, SYMBOL_POINT);
   int    digits     = (int)SymbolInfoInteger(SymbolName, SYMBOL_DIGITS);

   //--- Check for open positions for this EA's magic number and symbol
   int open_buy_positions = 0;
   
   for (int i = 0; i < PositionsTotal(); i++)
   {
      if (PositionSelectByIndex(i)) // Select position by index
      {
         // Filter positions by Magic Number and Symbol
         if (PositionGetInteger(POSITION_MAGIC) == MagicNumber && PositionGetString(POSITION_SYMBOL) == SymbolName)
         {
            ENUM_POSITION_TYPE position_type = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
            
            //--- Exit logic: Close BUY positions if RSI is overbought
            if (position_type == POSITION_TYPE_BUY)
            {
               open_buy_positions++;
               if (current_rsi > RSI_Overbought_Level)
               {
                  ulong  position_ticket = PositionGetInteger(POSITION_TICKET);
                  string pos_symbol      = PositionGetString(POSITION_SYMBOL); // For logging purposes
                  
                  Print("RSI (", current_rsi, ") > Overbought (", RSI_Overbought_Level, "). Closing BUY position #", position_ticket);
                  
                  // Correct CTrade::PositionClose usage: close by position ticket
                  if (!m_trade.PositionClose(position_ticket))
                  {
                     Print("Failed to close BUY position #", position_ticket, " for ", pos_symbol, ", error: ", GetLastError());
                  }
               }
            }
         }
      }
      else
      {
         Print("Error selecting position by index ", i, ", error code: ", GetLastError());
      }
   }

   //--- Entry logic: BUY if RSI is oversold and no open BUY positions for this EA
   // Ensure there are no existing open buy positions by this EA for this symbol
   if (open_buy_positions == 0)
   {
      // Check if maximum trades per day has not been reached
      if (m_trades_today < MaxTradesPerDay)
      {
         // Check RSI condition for entry
         if (current_rsi < RSI_Oversold_Level)
         {
            // Calculate Stop Loss and Take Profit levels
            // StopLossPoints and TakeProfitPoints are in broker points, convert to price
            double sl_price = ask_price - (StopLossPoints * point_size);
            double tp_price = ask_price + (TakeProfitPoints * point_size);

            // Normalize prices to the symbol's digits to avoid order rejection due to incorrect precision
            sl_price = NormalizeDouble(sl_price, digits);
            tp_price = NormalizeDouble(tp_price, digits);

            Print("RSI (", current_rsi, ") < Oversold (", RSI_Oversold_Level, "). Attempting to open BUY position.");
            // Place a BUY order
            if (m_trade.Buy(LotSize, SymbolName, ask_price, sl_price, tp_price, "RSI Buy"))
            {
               m_trades_today++; // Increment trade counter on successful order placement
               Print("BUY order placed. SL: ", sl_price, ", TP: ", tp_price, ". Trades today: ", m_trades_today);
            }
            else
            {
               Print("Failed to place BUY order, error: ", GetLastError(), ". Current Ask: ", ask_price);
            }
         }
      }
      else
      {
         Print("Max trades per day (", MaxTradesPerDay, ") reached. No new trades today.");
      }
   }
}
//+------------------------------------------------------------------+