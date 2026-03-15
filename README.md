# Conversational AI BI Dashboard Prototype

This workspace holds a prototype web application that translates natural language requests into interactive BI dashboards.

## Tech Stack
- Frontend: Next.js
- Backend: FastAPI (Python)
- LLM Integration: Placeholder for Google Gemini (via Google AI Studio)
- Database: SQLite or CSV support

## Structure
- `/frontend` - React/Next.js app
- `/backend` - FastAPI service

## Getting Started

### Backend

1. Create and activate a Python virtual environment:
   ```bash
   cd backend
   python -m venv venv
   # macOS/Linux
   source venv/bin/activate
   # Windows PowerShell
   venv\\Scripts\\activate
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. (Optional) set your LLM API key as an environment variable:
   ```bash
   export OPENAI_API_KEY="your_key_here"  # macOS/Linux
   setx OPENAI_API_KEY "your_key_here"    # Windows (new shell required)
   ```
4. Start the server:
   ```bash
   uvicorn app.main:app --reload
   ```

### Frontend

1. Install dependencies:
   ```bash
   cd frontend
   npm install
   ```
2. Run development server:
   ```bash
   npm run dev
   ```

> **Tip:** There are VS Code tasks configured (`Start Backend (Python)` and `Start Frontend`) which can be invoked from the command palette or by running `Tasks: Run Task`.

## Features
- Natural language to SQL transformation (via LLM stub)
- Automatic chart selection based on prompt keywords
- Interactive dashboards rendered in the browser

## Sample Data
The backend populates a small `sales` table with example records (date, region, category, revenue).

### Using the nyka dataset
If you have received the `nyka.csv` file, place it in `backend/data/` and restart the server. It will be imported
into a table named `nyka` automatically. The schema is inferred from the CSV header.

Once imported you can ask questions about the dataset directly. Example prompts:

```
"Show the first 10 rows of the nyka table."
"What is the average price by category?"
"List top 5 products by revenue."
"How many orders are there per city?"
```

Other general queries to try:

```
"Show me all sales data."
"Give me revenue over time."
"What is the revenue by region?"
```

## License
MIT
