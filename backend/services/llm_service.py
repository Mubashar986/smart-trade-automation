import json
import logging
from backend.config import settings

logger = logging.getLogger(__name__)

# ── Provider Detection ─────────────────────────────────────────────────────────
# Priority: Azure OpenAI → Gemini (native SDK)
# Azure: uses openai SDK with AzureOpenAI client
# Gemini: uses google-generativeai native SDK (avoids 403 on /v1beta/openai)
# ──────────────────────────────────────────────────────────────────────────────

_PROVIDER      = None   # "azure" | "gemini"
_azure_client  = None   # AzureOpenAI instance (Azure path)
_gemini_model  = None   # genai.GenerativeModel instance (Gemini path)
_AZURE_MODEL   = "gpt-5.4-mini"

if settings.AZURE_OPENAI_API_KEY:
    from openai import AzureOpenAI
    _azure_client = AzureOpenAI(
        api_key=settings.AZURE_OPENAI_API_KEY,
        api_version="2024-12-01-preview",
        azure_endpoint="https://searchify.openai.azure.com/",
    )
    _PROVIDER = "azure"
    logger.info("LLM provider: Azure OpenAI (model=%s)", _AZURE_MODEL)

elif settings.GEMINI_API_KEY:
    # Use native google-generativeai SDK.
    # The OpenAI-compatible endpoint (/v1beta/openai) returns 403 PERMISSION_DENIED
    # for standard AI Studio keys — native SDK works with any AI Studio key.
    import google.generativeai as genai
    genai.configure(api_key=settings.GEMINI_API_KEY)
    _gemini_model = genai.GenerativeModel(settings.CLAW_MODEL)  # e.g. gemini-2.5-flash
    _PROVIDER = "gemini"
    logger.info("LLM provider: Google Gemini native SDK (model=%s)", settings.CLAW_MODEL)

else:
    logger.warning(
        "No LLM provider configured. "
        "Set AZURE_OPENAI_API_KEY or GEMINI_API_KEY in your .env file. "
        "Mock prompts (1/2/3/broken) will still work."
    )


# ── Shared prompts ─────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """
You are an expert MQL5 programmer for MetaTrader 5.
When given a trading strategy description, generate a complete, 
compilable MQL5 Expert Advisor script.

Rules:
- Always include proper #property directives at the top
- Always implement OnInit(), OnDeinit(), OnTick() functions
- Use proper MQL5 syntax — not MQL4
- Include input parameters for key strategy values
- Add basic risk management (stop loss, take profit)
- Add comments explaining the logic
- Return ONLY the raw MQL5 code, no markdown, no explanation

The script must compile with 0 errors in MetaEditor.
"""

PARSE_SYSTEM_PROMPT = """
You are a trading strategy parser.

Your job is to convert the user's natural language trading strategy into valid JSON only.

Return only JSON. No explanation. No markdown.

Use this exact schema:

{
  "symbol": "XAUUSD",
  "timeframe": "H1",
  "strategy_type": "RSI",
  "entry": {
    "indicator": "RSI",
    "period": 14,
    "operator": "<",
    "value": 30,
    "action": "BUY"
  },
  "exit": {
    "indicator": "RSI",
    "period": 14,
    "operator": ">",
    "value": 70,
    "action": "CLOSE"
  },
  "risk": {
    "lot_size": 0.01,
    "stop_loss_points": 300,
    "take_profit_points": 600,
    "max_trades_per_day": 3,
    "max_drawdown_percent": 5.0,
    "max_consecutive_losses": 3,
    "trailing_stop_points": 100,
    "slippage_points": 30
  }
}

Rules:
- If timeframe is missing, use "H1".
- If RSI period is missing, use 14.
- If lot size is missing, use 0.01.
- If max trades per day is missing, use null.
- If stop loss is missing, use null.
- If take profit is missing, use null.
- If max_drawdown_percent is missing, use null.
- If max_consecutive_losses is missing, use null.
- If trailing_stop_points is missing, use null.
- If slippage_points is missing, use null.
- Supported strategy_type values: RSI, MA_CROSSOVER, PRICE_LEVEL.
- Supported timeframes: M1, M5, M15, M30, H1, H4, D1.
"""


# ── Mock scripts (no LLM needed) ──────────────────────────────────────────────

MOCK_SCRIPT_1 = """
//+------------------------------------------------------------------+
//|                                                   Strategy 1     |
//|                                      Copyright 2026, SmartTrade  |
//+------------------------------------------------------------------+
#property copyright "SmartTrade"
#property link      ""
#property version   "1.00"

int OnInit() { return(INIT_SUCCEEDED); }
void OnDeinit(const int reason) { }
void OnTick() { 
   // Basic Moving Average mock logic
}
//+------------------------------------------------------------------+
"""

MOCK_SCRIPT_2 = """
//+------------------------------------------------------------------+
//|                                                   Strategy 2     |
//|                                      Copyright 2026, SmartTrade  |
//+------------------------------------------------------------------+
#property copyright "SmartTrade"
#property link      ""
#property version   "1.00"

int OnInit() { return(INIT_SUCCEEDED); }
void OnDeinit(const int reason) { }
void OnTick() { 
   // RSI Oversold mock logic
}
//+------------------------------------------------------------------+
"""

MOCK_SCRIPT_3 = """
//+------------------------------------------------------------------+
//|                                                   Strategy 3     |
//|                                      Copyright 2026, SmartTrade  |
//+------------------------------------------------------------------+
#property copyright "SmartTrade"
#property link      ""
#property version   "1.00"

int OnInit() { return(INIT_SUCCEEDED); }
void OnDeinit(const int reason) { }
void OnTick() { 
   // MACD Crossover mock logic
}
//+------------------------------------------------------------------+
"""

# ── Known-broken script for error correction loop testing ─────────────
# Contains 5 deliberate MQL4/MQL5 mix-ups that MetaEditor will reject.
# Trigger: type "broken" in the frontend prompt field.
# The error correction loop will detect failures and ask the LLM to fix them.
BROKEN_TEST_SCRIPT = """
//+------------------------------------------------------------------+
//|                                   ErrorCorrectionTest.mq5        |
//|                                      Copyright 2026, SmartTrade  |
//+------------------------------------------------------------------+
#property copyright "SmartTrade"
#property link      ""
#property version   "1.00"
#property strict


int OnInit()
{
   maHandle = iMA(_Symbol, PERIOD_H1, MAPeriod, 0, MODE_SMA, PRICE_CLOSE);
   rsiHandle = iRSI(_Symbol, PERIOD_H1, RSIPeriod, PRICE_CLOSE);
   if(maHandle == INVALID_HANDLE || rsiHandle == INVALID_HANDLE)
      return(INIT_FAILED);
   return(INIT_SUCCEEDED);
}

void OnDeinit(int reason)
{
   IndicatorRelease(maHandle);
   IndicatorRelease(rsiHandle);
}

void OnTick()
{
   double maBuffer[];
   double rsiBuffer[];
   ArraySetAsSeries(maBuffer, true);
   ArraySetAsSeries(rsiBuffer, true);
   CopyBuffer(maHandle, 0, 0, 3, maBuffer);
   CopyBuffer(rsiHandle, 0, 0, 3, rsiBuffer);

   double currentMA  = maBuffer[0];
   double currentRSI = rsiBuffer[0];
   double Ask        = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   double Bid        = SymbolInfoDouble(_Symbol, SYMBOL_BID);

   if(Ask > currentMA && currentRSI < 30 && signalConfirmed == true)
   {
      OrderSend(_Symbol, OP_BUY, LotSize, Ask, 3, Ask - 50*Point, Ask + 100*Point, "BuySignal", 12345, 0, Green);
   }
   
   if(Bid < currentMA && currentRSI > 70)
   {
      OrderSend(_Symbol, OP_SELL, LotSize, Bid, 3, Bid + 50*Point, Bid - 100*Point, "SellSignal", 12345, 0, Red);
   }
}
//+------------------------------------------------------------------+
"""


# ── Helpers ────────────────────────────────────────────────────────────────────

def clean_script_content(raw: str) -> str:
    """Strip markdown code fences if the LLM wraps the output."""
    content = raw.strip()
    if content.startswith("```"):
        lines = content.split("\n")
        content = "\n".join(lines[1:])
        if content.endswith("```"):
            content = content[:-3]
        if content.startswith("mql5\n"):
            content = content[5:]
    return content.strip()


def _call_llm(system_prompt: str, user_prompt: str, json_mode: bool = False, large: bool = False) -> str:
    """
    Unified LLM call that works with either Azure OpenAI or Gemini.

    Args:
        system_prompt: Instruction context for the model.
        user_prompt:   The actual user request.
        json_mode:     If True, instructs model to return pure JSON.
        large:         If True, uses the larger/more capable model variant.

    Returns:
        Raw text response from the model.

    Raises:
        RuntimeError: If no LLM provider is configured.
    """
    if _PROVIDER is None:
        raise RuntimeError(
            "No LLM provider configured. "
            "Add AZURE_OPENAI_API_KEY or GEMINI_API_KEY to your .env file."
        )

    # ── Azure OpenAI path ──────────────────────────────────────────────
    if _PROVIDER == "azure":
        kwargs = dict(
            model=_AZURE_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": user_prompt},
            ],
            max_tokens=4096 if json_mode else 16384,
        )
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}
        response = _azure_client.chat.completions.create(**kwargs)
        return response.choices[0].message.content

    # ── Gemini native SDK path ───────────────────────────────────────────
    # Gemini doesn’t have a separate system role — prepend to user message.
    full_prompt = f"{system_prompt.strip()}\n\n{user_prompt.strip()}"
    if json_mode:
        full_prompt += "\n\nIMPORTANT: Return ONLY valid JSON. No markdown, no explanation."
    response = _gemini_model.generate_content(full_prompt)
    return response.text


# ── Public API ─────────────────────────────────────────────────────────────────

async def parse_strategy_with_llm(user_prompt: str) -> dict:
    """Convert a natural language trading strategy into a structured JSON dict."""
    if user_prompt.strip() in ["1", "2", "3", "broken"]:
        return {"mock": user_prompt.strip()}

    content = _call_llm(PARSE_SYSTEM_PROMPT, user_prompt, json_mode=True, large=False)
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        # Fallback: strip any stray markdown fences and retry
        return json.loads(clean_script_content(content))


async def generate_mql5_script(strategy_data_str: str, job_id: str, warnings: list = None) -> tuple[str, str]:
    """Generate a complete MQL5 Expert Advisor script from a strategy description."""
    script_name = f"strategy_{str(job_id)[:8]}"
    clean_prompt = strategy_data_str.strip()

    # Mock scripts for quick testing (no LLM call needed)
    if clean_prompt in ["1", "2", "3", "broken"]:
        scripts = {"1": MOCK_SCRIPT_1, "2": MOCK_SCRIPT_2, "3": MOCK_SCRIPT_3, "broken": BROKEN_TEST_SCRIPT}
        return scripts[clean_prompt].strip(), f"{script_name}.mq5"

    user_prompt = (
        f"Generate a complete MQL5 Expert Advisor for this strategy structure:\n"
        f"{strategy_data_str}\n\nScript name should be: {script_name}"
    )
    if warnings:
        user_prompt += (
            "\n\nAdditionally, please consider the following warnings from the strategy "
            "validation and add safety measures where necessary:\n"
        )
        for w in warnings:
            user_prompt += f"- {w}\n"

    raw = _call_llm(SYSTEM_PROMPT, user_prompt, json_mode=False, large=True)
    return clean_script_content(raw), f"{script_name}.mq5"


async def fix_mql5_script(
    user_prompt: str,
    failed_script: str,
    compile_errors: str,
    attempt: int,
) -> str:
    """
    Send the failed script and its compilation errors back to the LLM
    so it can produce a corrected version.
    """
    fix_prompt = f"""The following MQL5 Expert Advisor script failed to compile in MetaEditor.
This is attempt #{attempt} to fix it.

── ORIGINAL USER REQUEST ──
{user_prompt}

── FAILED SCRIPT ──
{failed_script}

── COMPILATION ERRORS ──
{compile_errors}

── YOUR TASK ──
Carefully analyze the compilation errors above.
Fix EVERY error in the script and return the COMPLETE corrected MQL5 code.
Do NOT omit any part of the script — return the full file.
Return ONLY the raw MQL5 code, no markdown, no explanation."""

    raw = _call_llm(SYSTEM_PROMPT, fix_prompt, json_mode=False, large=True)
    return clean_script_content(raw)
