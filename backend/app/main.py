from fastapi import FastAPI, HTTPException, Depends, File, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session
from .database import SessionLocal
from .models import User, Feedback, Base
from typing import Optional, List
import os
import pandas as pd
from fastapi.middleware.cors import CORSMiddleware
from .gemini_api import call_gemini_api, create_query_prompt
from .query_validator import QueryValidator, HallucinationDetector
import json
import io

# ==================== REQUEST/RESPONSE MODELS ====================

class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

class QueryRequest(BaseModel):
    prompt: str
    filename: Optional[str] = None

class FollowUpRequest(BaseModel):
    """For follow-up questions/chat"""
    original_prompt: str
    follow_up: str
    chart_data: List[dict]
    filename: Optional[str] = None

class FeedbackRequest(BaseModel):
    user_email: Optional[str] = None
    message: str

# ==================== APP SETUP ====================

app = FastAPI(title="NYKA - Conversational BI Dashboard")

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== DATABASE ====================

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

Base.metadata.create_all(bind=SessionLocal.kw['bind'])

# ==================== AUTHENTICATION ENDPOINTS ====================

@app.post("/register")
def register(request: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == request.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(name=request.name, email=request.email, password=request.password)
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"success": True, "user_id": user.id, "name": user.name}

@app.post("/login")
def login(request: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(
        User.email == request.email,
        User.password == request.password
    ).first()
    if user:
        return {"success": True, "user_id": user.id, "name": user.name}
    else:
        raise HTTPException(status_code=401, detail="Invalid credentials")

@app.get("/users")
def get_users(db: Session = Depends(get_db)):
    users = db.query(User).all()
    return [{"id": u.id, "name": u.name, "email": u.email} for u in users]

@app.post("/feedback")
def submit_feedback(feedback: FeedbackRequest, db: Session = Depends(get_db)):
    fb = Feedback(user_email=feedback.user_email, message=feedback.message)
    db.add(fb)
    db.commit()
    db.refresh(fb)
    return {"success": True, "id": fb.id}

# ==================== DATA LOADING ====================

def load_data(filename: Optional[str] = None) -> pd.DataFrame:
    """Load data from file or default CSV"""
    if filename:
        uploads_dir = os.path.join(os.path.dirname(__file__), '../data/uploads')
        file_path = os.path.join(uploads_dir, filename)
        if os.path.exists(file_path):
            return pd.read_csv(file_path)
    
    # Default data
    data_path = os.path.join(os.path.dirname(__file__), '../data/nyka.csv')
    if os.path.exists(data_path):
        return pd.read_csv(data_path)
    
    raise FileNotFoundError("No data file found")

def get_data_profile(df: pd.DataFrame) -> dict:
    """Generate insights about the data"""
    profile = {
        "total_rows": len(df),
        "total_columns": len(df.columns),
        "columns": list(df.columns),
        "numeric_columns": df.select_dtypes(include=['number']).columns.tolist(),
        "categorical_columns": df.select_dtypes(include=['object']).columns.tolist(),
        "date_columns": [],
        "missing_values": df.isnull().sum().to_dict(),
    }
    
    # Detect date columns
    for col in df.columns:
        try:
            pd.to_datetime(df[col], errors='coerce')
            if df[col].dtype == 'object':
                profile["date_columns"].append(col)
        except:
            pass
    
    return profile

# ==================== IMPROVED QUERY LOGIC ====================

def improved_infer_query(prompt: str, df: pd.DataFrame):
    """Enhanced heuristic-based fallback query generation"""
    p = prompt.lower().strip()
    columns = list(df.columns)
    
    # Time series detection - highest priority
    time_keywords = ['trend', 'over time', 'by date', 'monthly', 'daily', 'weekly', 'when', 'timeline']
    is_time_series = any(kw in p for kw in time_keywords)
    
    metric_map = {
        'revenue': 'Revenue',
        'roi': 'ROI',
        'click': 'Clicks',
        'impression': 'Impressions',
        'conversion': 'Conversions',
    }
    
    metric = None
    for keyword, col in metric_map.items():
        if keyword in p and col in columns:
            metric = col
            break
    
    group_map = {
        'segment': 'Customer_Segment',
        'segment': 'Customer_Segment',
        'campaign': 'Campaign_Type',
        'date': 'Date',
        'region': 'Region',
        'product': 'Product_Category',
    }
    
    group = None
    for keyword, col in group_map.items():
        if keyword in p and col in columns:
            group = col
            break
    
    # TIME SERIES: Date is specified or time context exists
    if is_time_series and 'Date' in columns:
        if metric:
            query = f"df.assign(Date=pd.to_datetime(df['Date'], format='%d-%m-%Y', errors='coerce')).groupby(pd.Grouper(key='Date', freq='ME'))['{metric}'].sum().reset_index().sort_values('Date')"
            return query, "line", "Date", metric
    
    # TOP N extraction
    top_match = __import__('re').search(r'top (\d+)', p)
    if top_match and metric:
        n = int(top_match.group(1))
        query = f"df[['{group if group else columns[0]}','{metric}']].sort_values('{metric}', ascending=False).head({n})"
        return query, "bar", (group if group else columns[0]), metric
    
    # GROUPBY: metric + group specified
    if metric and group:
        query = f"df.groupby('{group}')['{metric}'].sum().reset_index()"
        
        # Decide chart type
        if 'distribution' in p or 'breakdown' in p or 'proportion' in p:
            return query, "pie", group, metric
        return query, "bar", group, metric
    
    # METRIC ONLY: Just show metric (summary)
    if metric and not group:
        query = f"df[['{metric}']].describe().reset_index()"
        return query, "table", None, None
    
    # FALLBACK: Default to revenue by segment
    if 'Revenue' in columns and 'Customer_Segment' in columns:
        query = "df.groupby('Customer_Segment')['Revenue'].sum().reset_index()"
        return query, "bar", "Customer_Segment", "Revenue"
    
    # Ultimate fallback
    query = f"df[{columns[:3]}].head(10)"
    return query, "table", None, None


def compute_data_summary(df: pd.DataFrame) -> dict:
    """Compute dataset summary stats"""
    summary = {
        'total_rows': len(df),
        'columns_count': len(df.columns),
    }
    
    # Add numeric metrics if available
    numeric_cols = df.select_dtypes(include=['number']).columns
    for col in numeric_cols[:5]:  # Limit to first 5
        if df[col].notna().sum() > 0:
            summary[f'{col}_total'] = float(df[col].sum())
            summary[f'{col}_avg'] = float(df[col].mean())
    
    return summary

def generate_chart_insight(prompt: str, chart_type: str, x_key: Optional[str], y_key: Optional[str]) -> str:
    """Generate human-readable insight about the chart"""
    p = prompt.lower().strip()
    
    insights = {
        'pie': f"This pie chart shows the distribution of {y_key.replace('_', ' ').lower() if y_key else 'data'} across different {x_key.replace('_', ' ').lower() if x_key else 'categories'}.",
        'bar': f"This bar chart compares {y_key.replace('_', ' ').lower() if y_key else 'values'} by {x_key.replace('_', ' ').lower() if x_key else 'category'}.",
        'line': f"This line chart shows the trend of {y_key.replace('_', ' ').lower() if y_key else 'values'} over {x_key.replace('_', ' ').lower() if x_key else 'time'}.",
        'area': f"This area chart visualizes the volume of {y_key.replace('_', ' ').lower() if y_key else 'values'} over {x_key.replace('_', ' ').lower() if x_key else 'time'}.",
        'scatter': f"This scatter plot shows the relationship between {x_key.replace('_', ' ').lower() if x_key else 'X'} and {y_key.replace('_', ' ').lower() if y_key else 'Y'}.",
        'table': "This table shows the detailed dataset summary and statistics.",
    }
    
    return insights.get(chart_type, "Chart visualization of your data.")

# ==================== MAIN QUERY ENDPOINT ====================

@app.post("/query")
async def query_dashboard(request: QueryRequest):
    """Main endpoint for generating dashboards from prompts"""
    try:
        # Load data
        df = load_data(request.filename)
        
        if df.empty:
            raise HTTPException(status_code=400, detail="Dataset is empty")
        
        # Get data profile
        columns = list(df.columns)
        profile = get_data_profile(df)
        
        # Step 1: Extract intent from user prompt
        intent = HallucinationDetector.get_query_intent(request.prompt)
        
        # Step 2: Try LLM first
        llm_success = False
        query_code, chart_type, x_key, y_key = None, None, None, None
        
        try:
            gemini_prompt = create_query_prompt(columns, request.prompt)
            gemini_response = call_gemini_api(gemini_prompt)
            
            if "error" not in gemini_response:
                try:
                    content = gemini_response["candidates"][0]["content"]["parts"][0]["text"]
                    # Parse JSON response
                    parsed = json.loads(content)
                    query_code = parsed.get("query_code")
                    chart_type = parsed.get("chart_type")
                    x_key = parsed.get("x_key")
                    y_key = parsed.get("y_key")
                    
                    # Validate safety
                    safe, msg = QueryValidator.is_safe_query(query_code)
                    if not safe:
                        raise ValueError(f"Query validation failed: {msg}")
                    
                    # Validate against intent
                    valid, msg = HallucinationDetector.validate_query_match_intent(df, intent, query_code)
                    if not valid:
                        raise ValueError(f"Query doesn't match intent: {msg}")
                    
                    llm_success = True
                except (json.JSONDecodeError, KeyError, ValueError) as e:
                    print(f"LLM parsing failed: {e}. Falling back to heuristics.")
        except Exception as e:
            print(f"LLM call failed: {e}. Using fallback logic.")
        
        # Step 3: Fallback to improved heuristics
        if not llm_success:
            query_code, chart_type, x_key, y_key = improved_infer_query(request.prompt, df)
        
        # Step 4: Execute query safely
        try:
            local_vars = {"df": df, "pd": pd}
            exec(f"result = {query_code}", {}, local_vars)
            result = local_vars["result"]
            
            # Validate result
            valid, msg = QueryValidator.validate_result(result)
            if not valid:
                raise ValueError(msg)
            
            # Convert to JSON-serializable format
            if hasattr(result, 'to_dict'):
                chart_data = result.to_dict(orient="records")
                # Handle datetime serialization
                for row in chart_data:
                    for key, value in row.items():
                        if hasattr(value, 'isoformat'):
                            row[key] = value.isoformat()
                        elif pd.isna(value):
                            row[key] = None
            else:
                chart_data = [{"value": result}] if isinstance(result, (int, float)) else result
            
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Query execution failed: {str(e)}")
        
        # Step 5: Generate summary and insight
        summary = compute_data_summary(df)
        insight = generate_chart_insight(request.prompt, chart_type, x_key, y_key)
        
        return {
            "success": True,
            "chartType": chart_type,
            "data": chart_data,
            "columns": columns,
            "xKey": x_key,
            "yKey": y_key,
            "summary": summary,
            "analysis": insight,
            "profile": profile,
            "suggested_follow_ups": generate_suggested_questions(request.prompt, columns),
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")

def generate_suggested_questions(original_prompt: str, columns: List[str]) -> List[str]:
    """Generate suggested follow-up questions"""
    suggestions = []
    
    if 'revenue' in original_prompt.lower():
        if 'Campaign_Type' in columns:
            suggestions.append("Compare this across campaign types")
        if 'Customer_Segment' in columns:
            suggestions.append("Break down by customer segment")
        if 'Date' in columns:
            suggestions.append("Show trend over time")
    
    if 'top' not in original_prompt.lower() and any(col in columns for col in ['Revenue', 'ROI', 'Clicks']):
        suggestions.append("Show top performers")
    
    if 'Date' not in original_prompt.lower() and 'Date' in columns:
        suggestions.append("Show how this changes over time")
    
    return suggestions[:3]  # Return top 3

# ==================== FILE UPLOAD ENDPOINT ====================

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """Handle CSV file uploads"""
    try:
        if not file.filename.endswith('.csv'):
            raise HTTPException(status_code=400, detail="Only CSV files allowed")
        
        contents = await file.read()
        df = pd.read_csv(io.StringIO(contents.decode('utf-8')))
        
        if df.empty:
            raise HTTPException(status_code=400, detail="Uploaded file is empty")
        
        # Save file
        uploads_dir = os.path.join(os.path.dirname(__file__), '../data/uploads')
        os.makedirs(uploads_dir, exist_ok=True)
        
        file_path = os.path.join(uploads_dir, file.filename)
        with open(file_path, 'wb') as f:
            f.write(contents)
        
        profile = get_data_profile(df)
        
        return {
            "success": True,
            "filename": file.filename,
            "profile": profile,
            "message": f"Uploaded {file.filename} with {len(df)} rows and {len(df.columns)} columns"
        }
    
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Upload failed: {str(e)}")

# ==================== HEALTH CHECK ====================

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "NYKA Conversational BI Dashboard"}
