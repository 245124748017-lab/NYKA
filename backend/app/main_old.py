
from fastapi import FastAPI, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from .database import SessionLocal
from .models import User, Feedback, Base
from typing import Optional
import os
import pandas as pd
from fastapi.middleware.cors import CORSMiddleware
from .gemini_api import call_gemini_api
import json

# --- API for user registration ---
class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

app = FastAPI()

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Create tables if not exist
Base.metadata.create_all(bind=SessionLocal.kw['bind'])

@app.post("/register")
def register(request: RegisterRequest, db: Session = Depends(get_db)):
    # Check if user already exists
    if db.query(User).filter(User.email == request.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(name=request.name, email=request.email, password=request.password)
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"success": True, "user_id": user.id, "name": user.name}

@app.post("/login")
def login(request: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == request.email, User.password == request.password).first()
    if user:
        return {"success": True, "user_id": user.id, "name": user.name}
    else:
        raise HTTPException(status_code=401, detail="Invalid credentials")

def load_data(filename: Optional[str] = None) -> pd.DataFrame:
    data_path = os.path.join(os.path.dirname(__file__), '../data/nyka.csv')
    return pd.read_csv(data_path)



app = FastAPI()

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Create tables if not exist
Base.metadata.create_all(bind=SessionLocal.kw['bind'])
# --- API to get all users ---
@app.get("/users")
def get_users(db: Session = Depends(get_db)):
    users = db.query(User).all()
    return [{"id": u.id, "name": u.name, "email": u.email} for u in users]

# --- API to add feedback ---
class FeedbackRequest(BaseModel):
    user_email: Optional[str] = None
    message: str

@app.post("/feedback")
def submit_feedback(feedback: FeedbackRequest, db: Session = Depends(get_db)):
    fb = Feedback(user_email=feedback.user_email, message=feedback.message)
    db.add(fb)
    db.commit()
    db.refresh(fb)
    return {"success": True, "id": fb.id}



app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class QueryRequest(BaseModel):
    prompt: str
    filename:Optional[str] = None

def compute_summary(df: pd.DataFrame):
    """Compute a simple summary of the dataset for dashboard display."""
    summary = {}
    if 'Revenue' in df.columns:
        summary['totalRevenue'] = float(df['Revenue'].sum())
    if 'Campaign_ID' in df.columns:
        summary['totalCampaigns'] = int(df['Campaign_ID'].nunique())
    if 'Customer_Segment' in df.columns:
        summary['segments'] = int(df['Customer_Segment'].nunique())
    if 'ROI' in df.columns:
        summary['avgROI'] = float(df['ROI'].mean())
    return summary

def generate_analysis(prompt, chart_type, x_key, y_key, summary):
    """Generate a context-aware analysis string for the user based on input and output."""
    p = prompt.lower().strip()
    if chart_type == 'pie' and x_key and y_key:
        return f"This pie chart shows the distribution of {y_key.replace('_',' ').lower()} across {x_key.replace('_',' ').lower()} for your query: '{prompt}'."
    if chart_type == 'bar' and x_key and y_key:
        return f"This bar chart compares {y_key.replace('_',' ').lower()} by {x_key.replace('_',' ').lower()} for your query: '{prompt}'."
    if chart_type == 'line' and x_key and y_key:
        return f"This line chart shows the trend of {y_key.replace('_',' ').lower()} over {x_key.replace('_',' ').lower()} for your query: '{prompt}'."
    if chart_type == 'area' and x_key and y_key:
        return f"This area chart visualizes the volume/trend of {y_key.replace('_',' ').lower()} by {x_key.replace('_',' ').lower()} for your query: '{prompt}'."
    if chart_type == 'scatter' and x_key and y_key:
        return f"This scatter plot shows the relationship between {x_key.replace('_',' ').lower()} and {y_key.replace('_',' ').lower()} for your query: '{prompt}'."
    if chart_type == 'table':
        return f"This table summarizes the statistics for your query: '{prompt}'."
    if summary.get('totalRevenue'):
        return f"The total revenue in the data is ₹{summary['totalRevenue']:.2f}."
    return f"Analysis for your query: '{prompt}'."


def infer_query(prompt: str, df: pd.DataFrame):
    """Basic keyword-based query generator for demo when LLM is unavailable."""
    p = prompt.lower().strip()

    # Revenue by segment - Pie chart for distribution
    if "customer segment" in p or ("segment" in p and "distribution" in p):
        return "df.groupby('Customer_Segment')['Revenue'].sum().reset_index()", "pie", "Customer_Segment", "Revenue"

    # Revenue by campaign type - Bar chart
    if ("campaign type" in p or "campaign" in p) and "revenue" in p:
        return "df.groupby('Campaign_Type')['Revenue'].sum().reset_index()", "bar", "Campaign_Type", "Revenue"

    # Impressions by campaign type - Area chart for volume
    if "impression" in p and ("trend" in p or "over time" in p):
        if 'Date' in df.columns:
            return "df.assign(Date=pd.to_datetime(df['Date'], format='%d-%m-%Y', errors='coerce')).groupby(pd.Grouper(key='Date', freq='ME'))['Impressions'].sum().reset_index().sort_values('Date')", "line", "Date", "Impressions"
        else:
            return "df.groupby('Campaign_Type')['Impressions'].sum().reset_index()", "area", "Campaign_Type", "Impressions"
    elif "impression" in p:
        return "df.groupby('Campaign_Type')['Impressions'].sum().reset_index()", "bar", "Campaign_Type", "Impressions"

    # Clicks by campaign type or time
    if "click" in p and ("over time" in p or "by date" in p or "time" in p):
        if 'Date' in df.columns:
            return "df.assign(Date=pd.to_datetime(df['Date'], format='%d-%m-%Y', errors='coerce')).groupby(pd.Grouper(key='Date', freq='ME'))['Clicks'].sum().reset_index().sort_values('Date')", "line", "Date", "Clicks"
    elif "click" in p:
        return "df.groupby('Campaign_Type')['Clicks'].sum().reset_index()", "bar", "Campaign_Type", "Clicks"

    # Conversion rate over time
    if "conversion" in p and ("over time" in p or "by date" in p or "time" in p):
        if 'Date' in df.columns:
            return "(df.assign(Date=pd.to_datetime(df['Date'], format='%d-%m-%Y', errors='coerce')).groupby(pd.Grouper(key='Date', freq='ME')).agg({'Conversions': 'sum', 'Clicks': 'sum'}).assign(Conversion_Rate=lambda x: x['Conversions'] / x['Clicks'] * 100).reset_index().sort_values('Date')[['Date','Conversion_Rate']])", "line", "Date", "Conversion_Rate"
    elif "conversion" in p:
        # conversion rate = conversions / clicks
        return (
            "(df.groupby('Campaign_Type').agg({'Conversions': 'sum', 'Clicks': 'sum'})"
            ".assign(Conversion_Rate=lambda x: x['Conversions'] / x['Clicks'] * 100)"
            ".reset_index()[['Campaign_Type','Conversion_Rate']])",
            "bar",
            "Campaign_Type",
            "Conversion_Rate",
        )

    # ROI by campaign type - Scatter plot for correlation
    if "roi" in p and ("campaign" in p or "correlation" in p):
        return "df.groupby('Campaign_Type')['ROI'].mean().reset_index()", "scatter", "Campaign_Type", "ROI"
    elif "roi" in p:
        return "df.groupby('Campaign_Type')['ROI'].mean().reset_index()", "bar", "Campaign_Type", "ROI"

    # Top by ROI
    if "top" in p and "roi" in p:
        return "df[['Campaign_ID','ROI']].sort_values('ROI', ascending=False).head(10)", "bar", "Campaign_ID", "ROI"

    # Top by revenue
    if "top" in p and "revenue" in p:
        return "df[['Campaign_ID','Revenue']].sort_values('Revenue', ascending=False).head(10)", "bar", "Campaign_ID", "Revenue"

    # Performance comparison - Scatter plot
    if "performance" in p and "comparison" in p:
        return "df[['Revenue','ROI']].dropna()", "scatter", "Revenue", "ROI"

    # Monthly trends - Area chart (disabled for now)
    # if ("monthly" in p or "trend" in p) and "revenue" in p:
    #     if 'Date' in df.columns:
    #         return "df.assign(Date=pd.to_datetime(df['Date'], errors='coerce')).groupby(pd.Grouper(key='Date', freq='M'))['Revenue'].sum().reset_index()", "area", "Date", "Revenue"

    # Time series Revenue over Date - Line chart
    if "over time" in p or "by date" in p or "time" in p:
        if 'Date' in df.columns:
            return "df.assign(Date=pd.to_datetime(df['Date'], format='%d-%m-%Y', errors='coerce')).groupby(pd.Grouper(key='Date', freq='ME'))['Revenue'].sum().reset_index().sort_values('Date')", "line", "Date", "Revenue"

    # Efficiency metrics - Scatter plot
    if "efficiency" in p or "cost" in p:
        return "df[['ROI','Revenue']].dropna()", "scatter", "Revenue", "ROI"

    # Campaign analysis - Pie chart for distribution
    if "campaign" in p and ("analysis" in p or "breakdown" in p):
        return "df.groupby('Campaign_Type')['Revenue'].sum().reset_index()", "pie", "Campaign_Type", "Revenue"

    # Summary / overview request
    if "summary" in p or "overview" in p or "stats" in p:
        return "df.describe().reset_index()", "table", None, None

    # Default fallback
    return "df.groupby('Customer_Segment')['Revenue'].sum().reset_index()", "bar", "Customer_Segment", "Revenue"


@app.post("/query")
async def query_dashboard(request: QueryRequest):
    try:
        df = load_data(request.filename)

        # Use Gemini AI to determine query and chart type
        columns = list(df.columns)
        prompt_for_gemini = f"""
Given the dataframe with columns: {columns}

User query: {request.prompt}

Generate a pandas query code that answers the query. Choose appropriate chart type: bar, line, pie, area, scatter, table.

For time series queries (over time, by date, trends), group by month using:
- For revenue: df.assign(Date=pd.to_datetime(df['Date'], format='%d-%m-%Y', errors='coerce')).groupby(pd.Grouper(key='Date', freq='ME'))['Revenue'].sum().reset_index().sort_values('Date')
- For clicks: df.assign(Date=pd.to_datetime(df['Date'], format='%d-%m-%Y', errors='coerce')).groupby(pd.Grouper(key='Date', freq='ME'))['Clicks'].sum().reset_index().sort_values('Date')
- For impressions: df.assign(Date=pd.to_datetime(df['Date'], format='%d-%m-%Y', errors='coerce')).groupby(pd.Grouper(key='Date', freq='ME'))['Impressions'].sum().reset_index().sort_values('Date')
- For conversions: df.assign(Date=pd.to_datetime(df['Date'], format='%d-%m-%Y', errors='coerce')).groupby(pd.Grouper(key='Date', freq='ME'))['Conversions'].sum().reset_index().sort_values('Date')
- For conversion rate: (df.assign(Date=pd.to_datetime(df['Date'], format='%d-%m-%Y', errors='coerce')).groupby(pd.Grouper(key='Date', freq='ME')).agg({{'Conversions': 'sum', 'Clicks': 'sum'}}).assign(Conversion_Rate=lambda x: x['Conversions'] / x['Clicks'] * 100).reset_index().sort_values('Date')[['Date','Conversion_Rate']])

Specify x_key and y_key for the chart (use None for table).

Return only JSON in this format:

{{"query_code": "df.groupby('column')['column'].sum().reset_index()", "chart_type": "bar", "x_key": "column", "y_key": "column"}}

Make sure the query_code is safe pandas code.
"""
        gemini_response = call_gemini_api(prompt_for_gemini)
        
        if "error" in gemini_response:
            # Fallback to heuristics
            query_code, chart_type, x_key, y_key = infer_query(request.prompt, df)
        else:
            try:
                content = gemini_response["candidates"][0]["content"]["parts"][0]["text"]
                parsed = json.loads(content)
                query_code = parsed["query_code"]
                chart_type = parsed["chart_type"]
                x_key = parsed["x_key"]
                y_key = parsed["y_key"]
            except Exception as e:
                # Fallback to heuristics if parsing fails
                query_code, chart_type, x_key, y_key = infer_query(request.prompt, df)

        local_vars = {"df": df, "pd": pd}
        exec(f"result = {query_code}", {}, local_vars)
        chart_data = local_vars["result"]
        if hasattr(chart_data, 'to_dict'):
            chart_data = chart_data.to_dict(orient="records")
            # Convert any datetime objects to strings for JSON serialization
            for row in chart_data:
                for key, value in row.items():
                    if hasattr(value, 'isoformat'):  # datetime object
                        row[key] = value.isoformat()
        elif isinstance(chart_data, (int, float)):
            chart_data = [{"value": chart_data}]

        summary = compute_summary(df)
        analysis = generate_analysis(request.prompt, chart_type, x_key, y_key, summary)
        return {
            "chartType": chart_type,
            "data": chart_data,
            "columns": list(df.columns),
            "xKey": x_key,
            "yKey": y_key,
            "summary": summary,
            "analysis": analysis,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



