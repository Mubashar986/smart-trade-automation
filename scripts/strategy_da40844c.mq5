#property strict
#property version   "1.00"
#property description "Strategy DA40844C - Buy at 100, sell at 140 with SL/TP"

#include <Trade/Trade.mqh>

CTrade trade;

input string InpSymbol              = "XAUUSD";
input double InpBuyLevel            = 100.0;
input double InpSellLevel           = 140.0;
input double InpStopLossDistance    = 10.0;
input double InpTakeProfitDistance   = 40.0;
input double InpLots                = 0.10;
input ulong  InpMagicNumber         = 40844;
input int    InpDeviationPoints     = 20;

double NormalizePrice(const string symbol, const double price)
{
   int digits = (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS);
   return NormalizeDouble(price, digits);
}

bool HaveOpenPosition(const string symbol)
{
   return PositionSelect(symbol);
}

void OpenBuy(const string symbol)
{
   if(HaveOpenPosition(symbol))
      return;

   MqlTick tick;
   if(!SymbolInfoTick(symbol, tick))
      return;

   double ask = tick.ask;
   double sl  = NormalizePrice(symbol, ask - InpStopLossDistance);
   double tp  = NormalizePrice(symbol, ask + InpTakeProfitDistance);

   trade.SetExpertMagicNumber((int)InpMagicNumber);
   trade.SetDeviationInPoints(InpDeviationPoints);
   trade.Buy(InpLots, symbol, ask, sl, tp, "Buy at level");
}

void OpenSell(const string symbol)
{
   if(HaveOpenPosition(symbol))
      return;

   MqlTick tick;
   if(!SymbolInfoTick(symbol, tick))
      return;

   double bid = tick.bid;
   double sl  = NormalizePrice(symbol, bid + InpStopLossDistance);
   double tp  = NormalizePrice(symbol, bid - InpTakeProfitDistance);

   trade.SetExpertMagicNumber((int)InpMagicNumber);
   trade.SetDeviationInPoints(InpDeviationPoints);
   trade.Sell(InpLots, symbol, bid, sl, tp, "Sell at level");
}

int OnInit()
{
   if(!SymbolSelect(InpSymbol, true))
      return INIT_FAILED;

   trade.SetExpertMagicNumber((int)InpMagicNumber);
   trade.SetDeviationInPoints(InpDeviationPoints);

   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
}

void OnTick()
{
   string symbol = InpSymbol;
   if(!SymbolSelect(symbol, true))
      return;

   if(HaveOpenPosition(symbol))
      return;

   MqlTick tick;
   if(!SymbolInfoTick(symbol, tick))
      return;

   // Buy when price reaches the buy level
   if(tick.ask <= InpBuyLevel)
   {
      OpenBuy(symbol);
      return;
   }

   // Sell when price reaches the sell level
   if(tick.bid >= InpSellLevel)
   {
      OpenSell(symbol);
      return;
   }
}