import requests
import os
from dotenv import load_dotenv

GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent"
load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

SYSTEM_PROMPT = """You are an expert data analyst and visualization specialist.
Your task is to convert natural language queries into pandas code and chart recommendations.

CRITICAL RULES:
1. ONLY return valid JSON in this exact format. No markdown, no explanations:
{"query_code": "...", "chart_type": "...", "x_key": "...", "y_key": "..."}

2. For TIME SERIES queries (contains: trend, over time, monthly, daily, date comparison):
   - ALWAYS use pd.Grouper with freq='ME' for monthly aggregation
   - ALWAYS include .sort_values('Date')
   - Return chart_type: "line" or "area"
   Example: df.assign(Date=pd.to_datetime(df['Date'], format='%d-%m-%Y', errors='coerce')).groupby(pd.Grouper(key='Date', freq='ME'))['Revenue'].sum().reset_index().sort_values('Date')

3. For DISTRIBUTION queries (pie charts):
   - Use groupby() to aggregate by category
   - Return chart_type: "pie"
   - x_key should be the grouping column

4. For COMPARISON queries (bar/line):
   - Use groupby() to group by dimension
   - Return chart_type: "bar" or "line"

5. For TOP N queries:
   - Use .sort_values(ascending=False).head(n)
   - Return chart_type: "bar"

6. ALWAYS validate that columns exist in the data before using them.
7. Do NOT use columns not listed in the provided column list.
8. If a column is missing, suggest the closest match or return an error insight.
"""

def create_query_prompt(columns: list, user_query: str) -> str:
    """Create an optimized prompt for Gemini"""
    return f"""{SYSTEM_PROMPT}

Available columns: {', '.join(columns)}

User query: {user_query}

Generate the JSON response now. MUST be valid JSON only."""

def call_gemini_api(prompt: str, use_streaming=False):
    """Call Gemini API with better error handling"""
    headers = {"Content-Type": "application/json"}
    data = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.3,  # Lower temp for consistency
            "maxOutputTokens": 500,
        }
    }
    params = {"key": GEMINI_API_KEY}
    
    try:
        response = requests.post(
            GEMINI_API_URL,
            headers=headers,
            params=params,
            json=data,
            timeout=30
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            return {"error": f"API Error: {response.status_code} - {response.text}"}
    
    except requests.exceptions.Timeout:
        return {"error": "API request timeout. Please try again."}
    except Exception as e:
        return {"error": f"API call failed: {str(e)}"}
