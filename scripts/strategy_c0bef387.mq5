//+------------------------------------------------------------------+
//|                                        ErrorCorrectionTest.mq5   |
//|                                  Copyright 2026, SmartTrade      |
//+------------------------------------------------------------------+
#property copyright "SmartTrade"
#property link      ""
#property version   "1.00"
#property strict

#include <Trade/Trade.mqh>

input ENUM_TIMEFRAMES InpTimeframe      = PERIOD_H1;
input int             MAPeriod          = 50;
input int             RSIPeriod         = 14;
input double          LotSize           = 0.10;
input int             StopLossPoints    = 50;
input int             TakeProfitPoints  = 100;
input ulong           MagicNumber       = 12345;
input bool            SignalConfirmed   = true;

int maHandle = INVALID_HANDLE;
int rsiHandle = INVALID_HANDLE;
CTrade trade;

//+------------------------------------------------------------------+
int OnInit()
{
   maHandle = iMA(_Symbol, InpTimeframe, MAPeriod, 0, MODE_SMA, PRICE_CLOSE);
   rsiHandle = iRSI(_Symbol, InpTimeframe, RSIPeriod, PRICE_CLOSE);

   if(maHandle == INVALID_HANDLE || rsiHandle == INVALID_HANDLE)
      return(INIT_FAILED);

   trade.SetExpertMagicNumber((uint)MagicNumber);
   return(INIT_SUCCEEDED);
}
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   if(maHandle != INVALID_HANDLE)
      IndicatorRelease(maHandle);
   if(rsiHandle != INVALID_HANDLE)
      IndicatorRelease(rsiHandle);
}
//+------------------------------------------------------------------+
void OnTick()
{
   double maBuffer[3];
   double rsiBuffer[3];
   ArraySetAsSeries(maBuffer, true);
   ArraySetAsSeries(rsiBuffer, true);

   if(CopyBuffer(maHandle, 0, 0, 3, maBuffer) < 1)
      return;
   if(CopyBuffer(rsiHandle, 0, 0, 3, rsiBuffer) < 1)
      return;

   double currentMA  = maBuffer[0];
   double currentRSI = rsiBuffer[0];
   double ask        = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   double bid        = SymbolInfoDouble(_Symbol, SYMBOL_BID);

   if(!SignalConfirmed)
      return;

   if(PositionsTotal() > 0)
      return;

   double point = SymbolInfoDouble(_Symbol, SYMBOL_POINT);

   if(ask > currentMA && currentRSI < 30.0 && SignalConfirmed)
   {
      double sl = NormalizeDouble(ask - StopLossPoints * point, _Digits);
      double tp = NormalizeDouble(ask + TakeProfitPoints * point, _Digits);
      trade.Buy(LotSize, _Symbol, ask, sl, tp, "BuySignal");
   }

   if(bid < currentMA && currentRSI > 70.0)
   {
      double sl = NormalizeDouble(bid + StopLossPoints * point, _Digits);
      double tp = NormalizeDouble(bid - TakeProfitPoints * point, _Digits);
      trade.Sell(LotSize, _Symbol, bid, sl, tp, "SellSignal");
   }
}
//+------------------------------------------------------------------+