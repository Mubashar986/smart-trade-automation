//+------------------------------------------------------------------+
//|                                                   ErrorCorrection |
//|                                      Copyright 2026, SmartTrade   |
//+------------------------------------------------------------------+
#property copyright "SmartTrade"
#property link      ""
#property version   "1.10"
#property strict

#include <Trade/Trade.mqh>

input ENUM_TIMEFRAMES InpTimeframe      = PERIOD_H1;
input int             InpMAPeriod       = 50;
input int             InpRSIPeriod      = 14;
input double          InpLots           = 0.10;
input int             InpStopLossPoints = 500;
input int             InpTakeProfitPoints= 1000;
input int             InpDeviationPoints = 30;
input ulong           InpMagicNumber    = 12345;
input bool            InpUseSignalConfirmation = true;

int maHandle = INVALID_HANDLE;
int rsiHandle = INVALID_HANDLE;
CTrade trade;

int OnInit()
{
   maHandle = iMA(_Symbol, InpTimeframe, InpMAPeriod, 0, MODE_SMA, PRICE_CLOSE);
   rsiHandle = iRSI(_Symbol, InpTimeframe, InpRSIPeriod, PRICE_CLOSE);

   if(maHandle == INVALID_HANDLE || rsiHandle == INVALID_HANDLE)
      return(INIT_FAILED);

   trade.SetExpertMagicNumber((int)InpMagicNumber);
   trade.SetDeviationInPoints(InpDeviationPoints);

   return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason)
{
   if(maHandle != INVALID_HANDLE)
   {
      IndicatorRelease(maHandle);
      maHandle = INVALID_HANDLE;
   }

   if(rsiHandle != INVALID_HANDLE)
   {
      IndicatorRelease(rsiHandle);
      rsiHandle = INVALID_HANDLE;
   }
}

bool HasOpenPosition()
{
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      if(PositionSelectByIndex(i))
      {
         if(PositionGetString(POSITION_SYMBOL) == _Symbol &&
            (ulong)PositionGetInteger(POSITION_MAGIC) == InpMagicNumber)
            return true;
      }
   }
   return false;
}

bool SignalConfirmed()
{
   if(!InpUseSignalConfirmation)
      return true;

   MqlRates rates[];
   ArraySetAsSeries(rates, true);
   if(CopyRates(_Symbol, InpTimeframe, 0, 3, rates) < 3)
      return false;

   return (rates[0].close > rates[1].close);
}

void OnTick()
{
   if(HasOpenPosition())
      return;

   double maBuffer[];
   double rsiBuffer[];
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
   double point      = SymbolInfoDouble(_Symbol, SYMBOL_POINT);

   if(point <= 0.0)
      return;

   bool confirmed = SignalConfirmed();

   // Buy condition: price above MA, RSI oversold, optional confirmation
   if(ask > currentMA && currentRSI < 30.0 && confirmed)
   {
      double sl = NormalizeDouble(ask - InpStopLossPoints * point, _Digits);
      double tp = NormalizeDouble(ask + InpTakeProfitPoints * point, _Digits);
      trade.Buy(InpLots, _Symbol, ask, sl, tp, "BuySignal");
   }

   // Sell condition: price below MA and RSI overbought
   if(bid < currentMA && currentRSI > 70.0)
   {
      double sl = NormalizeDouble(bid + InpStopLossPoints * point, _Digits);
      double tp = NormalizeDouble(bid - InpTakeProfitPoints * point, _Digits);
      trade.Sell(InpLots, _Symbol, bid, sl, tp, "SellSignal");
   }
}
//+------------------------------------------------------------------+