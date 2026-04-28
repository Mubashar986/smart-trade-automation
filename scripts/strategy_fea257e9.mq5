#property strict
#property version   "1.00"
#property description "Strategy FEA257E9: Buy gold at 100 and sell at 140 with fixed SL/TP."

#include <Trade/Trade.mqh>

input double InpLotSize          = 0.10;
input ulong  InpMagicNumber      = 257000000;
input int    InpDeviationPoints  = 20;
input double InpBuyPrice         = 100.0;
input double InpSellPrice        = 140.0;
input double InpStopLossPoints   = 10.0;
input double InpTakeProfitPoints = 40.0;
input bool   InpUseBuyOrders     = true;
input bool   InpUseSellOrders    = true;

CTrade trade;

string g_symbol;
int    g_digits;
double g_point;

double NormalizePrice(const double price)
{
   return NormalizeDouble(price, g_digits);
}

bool HasOpenPositionByType(const ENUM_POSITION_TYPE pos_type)
{
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0)
         continue;

      if(PositionSelectByTicket(ticket))
      {
         if(PositionGetString(POSITION_SYMBOL) == g_symbol &&
            (ulong)PositionGetInteger(POSITION_MAGIC) == InpMagicNumber &&
            (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE) == pos_type)
         {
            return true;
         }
      }
   }
   return false;
}

bool OpenBuy()
{
   if(HasOpenPositionByType(POSITION_TYPE_BUY))
      return false;

   double ask = SymbolInfoDouble(g_symbol, SYMBOL_ASK);
   if(ask <= 0.0)
      return false;

   double sl = NormalizePrice(ask - InpStopLossPoints * g_point);
   double tp = NormalizePrice(ask + InpTakeProfitPoints * g_point);

   trade.SetExpertMagicNumber(InpMagicNumber);
   trade.SetDeviationInPoints(InpDeviationPoints);

   return trade.Buy(InpLotSize, g_symbol, 0.0, sl, tp, "Buy at target price");
}

bool OpenSell()
{
   if(HasOpenPositionByType(POSITION_TYPE_SELL))
      return false;

   double bid = SymbolInfoDouble(g_symbol, SYMBOL_BID);
   if(bid <= 0.0)
      return false;

   double sl = NormalizePrice(bid + InpStopLossPoints * g_point);
   double tp = NormalizePrice(bid - InpTakeProfitPoints * g_point);

   trade.SetExpertMagicNumber(InpMagicNumber);
   trade.SetDeviationInPoints(InpDeviationPoints);

   return trade.Sell(InpLotSize, g_symbol, 0.0, sl, tp, "Sell at target price");
}

int OnInit()
{
   g_symbol = _Symbol;
   g_digits  = (int)SymbolInfoInteger(g_symbol, SYMBOL_DIGITS);
   g_point   = SymbolInfoDouble(g_symbol, SYMBOL_POINT);

   if(g_point <= 0.0)
      return INIT_FAILED;

   trade.SetTypeFillingBySymbol(g_symbol);

   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
}

void OnTick()
{
   if(!TerminalInfoInteger(TERMINAL_TRADE_ALLOWED))
      return;

   MqlTick tick;
   if(!SymbolInfoTick(g_symbol, tick))
      return;

   double bid = tick.bid;
   double ask = tick.ask;

   if(bid <= 0.0 || ask <= 0.0)
      return;

   // Buy when price reaches or goes below the configured buy level
   if(InpUseBuyOrders && bid <= InpBuyPrice)
   {
      OpenBuy();
   }

   // Sell when price reaches or goes above the configured sell level
   if(InpUseSellOrders && ask >= InpSellPrice)
   {
      OpenSell();
   }
}