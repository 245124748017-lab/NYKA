# Project Checklist for Conversational AI BI Dashboard

## 1. Data Preparation
- [ ] Ensure nyka.csv is clean and in backend/data/nyka.csv

## 2. Backend Setup (FastAPI)
- [ ] Create FastAPI endpoints: /query
- [ ] Integrate Google Gemini API
- [ ] Execute generated query on CSV (Pandas)
- [ ] Return results and chart config as JSON

## 3. Frontend Setup (Next.js)
- [ ] Build UI: input, dashboard, loading/error states
- [ ] Connect to backend /query endpoint
- [ ] Render charts (Chart.js/Plotly)

## 4. LLM Prompt Engineering
- [ ] Design system prompt for Gemini

## 5. Error Handling
- [ ] Backend: catch/return errors
- [ ] Frontend: show user-friendly errors

## 6. Interactivity & UX
- [ ] Interactive charts, responsive layout, loading indicators

## 7. Bonus Features
- [ ] CSV upload, follow-up queries

## 8. Testing
- [ ] Test with 3+ queries

## 9. Deployment & Presentation
- [ ] Deploy app, prepare demo, push to GitHub
