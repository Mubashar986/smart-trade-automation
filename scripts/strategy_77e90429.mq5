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
#include <Indicators/RSI.mqh> // Include RSI indicator functions

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
MqlRates       m_rates[];         // Array to store price history

datetime       m_last_bar_time = 0; // Timestamp of the last processed bar
datetime       m_last_trade_day = 0; // Last day a trade was attempted/opened
int            m_trades_today = 0; // Counter for trades opened today

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   //--- Set up CTrade object
   m_trade.SetExpertMagicNumber(MagicNumber);
   m_trade.SetTypeFilling(ORDER_FILLING_FOK); // Fill or Kill order type
   m_trade.SetAsyncMode(false);              // Synchronous order sending

   //--- Create RSI indicator handle
   // Use PRICE_CLOSE for the applied price as per standard RSI calculation
   m_rsi_handle = iRSI(SymbolName, Timeframe, RSI_Period, PRICE_CLOSE);
   
   //--- Check if RSI handle creation was successful
   if (m_rsi_handle == INVALID_HANDLE)
   {
      Print("Error creating RSI indicator handle for ", SymbolName, " on ", EnumToString(Timeframe), ", error code: ", GetLastError());
      return INIT_FAILED;
   }
   
   //--- Set up indicator buffers for CopyBuffer
   SetIndexBuffer(0, m_rsi_buffer, INDICATOR_DATA);

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
   // This strategy is based on H1, so we want to execute once per H1 bar.
   datetime current_bar_time = iTime(SymbolName, Timeframe, 0);
   if (current_bar_time == 0) // Check if iTime returned valid time
   {
      Print("Error getting current bar time for ", SymbolName, " on ", EnumToString(Timeframe), ", error code: ", GetLastError());
      return;
   }
   
   if (m_last_bar_time == current_bar_time)
   {
      return; // No new bar, wait for the next one
   }
   
   // A new bar has formed, update the last bar time
   m_last_bar_time = current_bar_time;
   
   //--- Check if a new day has started to reset trade counter
   datetime current_day = (datetime)TimeDay(TimeCurrent());
   if (current_day != m_last_trade_day)
   {
      m_trades_today = 0;
      m_last_trade_day = current_day;
      Print("New day started. Trades counter reset to 0.");
   }

   //--- Get the latest price data
   // We need at least 2 bars for RSI calculation (current and previous closed)
   if (CopyRates(SymbolName, Timeframe, 0, 2, m_rates) != 2)
   {
      Print("Error copying rates for ", SymbolName, " on ", EnumToString(Timeframe), ", error code: ", GetLastError());
      return;
   }

   //--- Get the RSI value for the most recently CLOSED bar (index 1)
   // We need at least 2 bars for RSI calculation, and we want the value for the *previous* closed bar
   // to react to completed bar conditions, typical for H1 strategies.
   if (CopyBuffer(m_rsi_handle, 0, 1, 1, m_rsi_buffer) != 1)
   {
      Print("Error copying RSI buffer for ", SymbolName, " on ", EnumToString(Timeframe), ", error code: ", GetLastError());
      return;
   }
   
   double current_rsi = m_rsi_buffer[0];
   
   //--- Get current bid and ask prices
   double bid_price = SymbolInfoDouble(SymbolName, SYMBOL_BID);
   double ask_price = SymbolInfoDouble(SymbolName, SYMBOL_ASK);
   
   if (bid_price <= 0 || ask_price <= 0)
   {
       Print("Error getting current bid/ask prices for ", SymbolName, ". Bid: ", bid_price, ", Ask: ", ask_price);
       return;
   }

   //--- Check for open positions for this EA's magic number
   int open_buy_positions = 0;
   
   for (int i = 0; i < PositionsTotal(); i++)
   {
      ulong position_ticket = PositionGetTicket(i);
      if (position_ticket == 0)
      {
         Print("Error getting position ticket, error code: ", GetLastError());
         continue;
      }
      
      if (PositionGetInteger(POSITION_MAGIC) == MagicNumber && PositionGetString(POSITION_SYMBOL) == SymbolName)
      {
         ENUM_POSITION_TYPE position_type = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
         
         //--- Exit logic: Close BUY positions if RSI is overbought
         if (position_type == POSITION_TYPE_BUY)
         {
            open_buy_positions++;
            if (current_rsi > RSI_Overbought_Level)
            {
               Print("RSI (", current_rsi, ") > Overbought (", RSI_Overbought_Level, "). Closing BUY position #", position_ticket);
               if (!m_trade.PositionClose(position_ticket, SlippagePoints))
               {
                  Print("Failed to close BUY position #", position_ticket, ", error: ", GetLastError());
               }
               else
               {
                  // Close successful, decrement count if needed (optional, will be updated next tick)
                  open_buy_positions--; 
               }
            }
         }
      }
   }

   //--- Entry logic: BUY if RSI is oversold and no open BUY positions for this EA
   if (open_buy_positions == 0)
   {
      if (m_trades_today < MaxTradesPerDay)
      {
         if (current_rsi < RSI_Oversold_Level)
         {
            // Calculate Stop Loss and Take Profit levels
            // StopLossPoints and TakeProfitPoints are in broker points, convert to price
            double point_size = SymbolInfoDouble(SymbolName, SYMBOL_POINT);
            double sl_price = ask_price - (StopLossPoints * point_size);
            double tp_price = ask_price + (TakeProfitPoints * point_size);

            Print("RSI (", current_rsi, ") < Oversold (", RSI_Oversold_Level, "). Attempting to open BUY position.");
            if (m_trade.Buy(LotSize, SymbolName, ask_price, sl_price, tp_price, "RSI Buy"))
            {
               m_trades_today++;
               Print("BUY order placed. SL: ", sl_price, ", TP: ", tp_price, ". Trades today: ", m_trades_today);
            }
            else
            {
               Print("Failed to place BUY order, error: ", GetLastError());
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