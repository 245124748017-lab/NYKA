import requests

GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent"
GEMINI_API_KEY = "AIzaSyCz6eFpG_M_RsYEqEc0GhdtT-KAQoBBD3E"  # User's actual Gemini API key

def call_gemini_api(prompt: str):
    headers = {"Content-Type": "application/json"}
    data = {
        "contents": [{"parts": [{"text": prompt}]}]
    }
    params = {"key": GEMINI_API_KEY}
    response = requests.post(GEMINI_API_URL, headers=headers, params=params, json=data)
    if response.status_code == 200:
        return response.json()
    else:
        return {"error": response.text}
