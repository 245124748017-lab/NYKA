import { useState, useEffect } from 'react';
import axios from 'axios';
import Navbar from '../components/Navbar';
import SearchBar from '../components/SearchBar';
// ...existing code...
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area, ScatterChart, Scatter } from 'recharts';

const EXAMPLE_PROMPTS = [
  'Show total revenue by campaign type',
  'Show revenue by customer segment',
  'Show summary statistics',
];

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1', '#d084d0', '#ffb347', '#87ceeb'];

export default function Home() {
  const [prompt, setPrompt] = useState('');
  // ...existing code...
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [queryHistory, setQueryHistory] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [mounted, setMounted] = useState(false);
  // Feedback state
  const [feedback, setFeedback] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState('');
  // const [userEmail, setUserEmail] = useState('');

  const handleFeedback = async (e) => {
    e.preventDefault();
    setFeedbackMsg('');
    const res = await fetch('http://localhost:8000/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: feedback })
    });
    if (res.ok) {
      setFeedbackMsg('Thank you for your feedback!');
      setFeedback('');
    } else {
      setFeedbackMsg('Failed to submit feedback.');
    }
  };

  useEffect(() => {
    setMounted(true);
    // Load data from localStorage only after component mounts
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('nyka-theme');
      if (savedTheme === 'dark') {
        setIsDarkMode(true);
        document.body.classList.add('dark-mode');
      }

      const savedHistory = localStorage.getItem('nyka-query-history');
      if (savedHistory) {
        setQueryHistory(JSON.parse(savedHistory));
      }

      const savedFavorites = localStorage.getItem('nyka-favorites');
      if (savedFavorites) {
        setFavorites(JSON.parse(savedFavorites));
      }
    }
  }, []);

  const queryBackend = async (query) => {
    setLoading(true);
    try {
      const payload = { prompt: query };
      // ...existing code...
      const res = await axios.post('http://localhost:8000/query', payload);
      // Add to history
      if (mounted) {
        const newHistory = [query, ...queryHistory.slice(0, 9)]; // Keep last 10
        setQueryHistory(newHistory);
        localStorage.setItem('nyka-query-history', JSON.stringify(newHistory));
      }
      return res.data;
    } catch (err) {
      console.error(err);
      alert('Error querying backend');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    const data = await queryBackend(prompt);
    setResponse(data);
  };

  const handleExampleClick = async (example) => {
    setPrompt(example);
    const data = await queryBackend(example);
    setResponse(data);
  };

  const exportData = () => {
    if (!response?.data) return;
    const dataStr = JSON.stringify(response.data, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = 'nyka-data.json';
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const handleThemeToggle = () => {
    if (!mounted) return;
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);
    localStorage.setItem('nyka-theme', newTheme ? 'dark' : 'light');
    document.body.classList.toggle('dark-mode', newTheme);
  };

  const toggleFavorite = (query) => {
    if (!mounted) return;
    const newFavorites = favorites.includes(query)
      ? favorites.filter(f => f !== query)
      : [query, ...favorites];
    setFavorites(newFavorites);
    localStorage.setItem('nyka-favorites', JSON.stringify(newFavorites));
  };

  const renderChart = (result) => {
    if (!result) return null;

    const { chartType, data, xKey, yKey } = result;

    if (chartType === 'line') {
      return (
        <div style={{ width: '100%', height: '400px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={xKey} />
              <YAxis label={{ value: yKey, angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Line type="monotone" dataKey={yKey} stroke="#8884d8" strokeWidth={3} dot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      );
    }

    if (chartType === 'bar') {
      return (
        <div style={{ width: '100%', height: '400px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={xKey} />
              <YAxis label={{ value: yKey, angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Bar dataKey={yKey} radius={[4, 4, 0, 0]}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }

    if (chartType === 'pie') {
      return (
        <div style={{ width: '100%', height: '400px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey={yKey}
                nameKey={xKey}
                cx="50%"
                cy="50%"
                outerRadius={100}
                fill="#8884d8"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      );
    }

    if (chartType === 'area') {
      return (
        <div style={{ width: '100%', height: '400px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={xKey} />
              <YAxis label={{ value: yKey, angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Area type="monotone" dataKey={yKey} stroke="#8884d8" fill="#8884d8" fillOpacity={0.3} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      );
    }

    if (chartType === 'scatter') {
      return (
        <div style={{ width: '100%', height: '400px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={xKey} />
              <YAxis dataKey={yKey} label={{ value: yKey, angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Scatter dataKey={yKey} fill="#8884d8" />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      );
    }

    if (result.error) {
      return <p style={{ color: 'red' }}>{result.error}</p>;
    }

    if (Array.isArray(result.data) && result.data.length > 0) {
      return (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f5f5f5' }}>
                {Object.keys(result.data[0]).map((key) => (
                  <th key={key} style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'left' }}>{key}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.data.map((row, index) => (
                <tr key={index}>
                  {Object.values(row).map((value, i) => (
                    <td key={i} style={{ padding: '10px', border: '1px solid #ddd' }}>{value}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    return <p>No data available.</p>;
  };

  return (
    <>
      <Navbar onThemeToggle={handleThemeToggle} isDarkMode={isDarkMode} />
      <div style={{ padding: '20px', marginTop: '80px', maxWidth: '1200px', marginLeft: 'auto', marginRight: 'auto' }}>
        {/* ...existing code... */}
              {/* Feedback floating section */}
              <div style={{
                position: 'fixed',
                bottom: 24,
                right: 24,
                zIndex: 9999,
                width: 320,
                background: '#fffbe6',
                border: '2px solid #ffd700',
                borderRadius: 12,
                boxShadow: '0 2px 12px rgba(255, 215, 0, 0.10)',
                padding: 18,
                fontSize: '1em',
                color: '#333',
              }}>
                <h4 style={{ margin: '0 0 8px 0', color: '#b48800', fontWeight: 700 }}>Share Feedback</h4>
                <form onSubmit={handleFeedback}>
                  <textarea
                    value={feedback}
                    onChange={e => setFeedback(e.target.value)}
                    placeholder="Your feedback..."
                    rows={3}
                    style={{ width: '100%', padding: 6, borderRadius: 4, border: '1px solid #ccc' }}
                    required
                  />
                  <button type="submit" style={{ marginTop: 8, background: '#ffd700', border: 'none', borderRadius: 4, padding: '8px 16px', fontWeight: 600, width: '100%' }}>
                    Submit
                  </button>
                </form>
                {feedbackMsg && <div style={{ marginTop: 8, color: feedbackMsg.startsWith('Thank') ? 'green' : 'red' }}>{feedbackMsg}</div>}
              </div>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '20px', flexDirection: 'column' }}>
          <h1 style={{ textAlign: 'center' }}>Conversational BI Dashboard</h1>
          <button
            onClick={handleThemeToggle}
            style={{
              padding: '8px 16px',
              background: isDarkMode ? '#333' : '#f0f0f0',
              color: isDarkMode ? 'white' : 'black',
              border: 'none',
              borderRadius: '20px',
              cursor: 'pointer'
            }}
          >
            {isDarkMode ? '☀️ Light' : '🌙 Dark'}
          </button>
        </div>

        <div style={{ margin: '20px 0' }}>
          <h3>Try one of these queries:</h3>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {EXAMPLE_PROMPTS.map((p) => (
              <button
                key={p}
                onClick={() => handleExampleClick(p)}
                style={{
                  padding: '10px 16px',
                  background: '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {favorites.length > 0 && mounted && (
          <div style={{ margin: '20px 0' }}>
            <h3>⭐ Your Favorites:</h3>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {favorites.map((fav) => (
                <button
                  key={fav}
                  onClick={() => handleExampleClick(fav)}
                  style={{
                    padding: '8px 12px',
                    background: '#ffd700',
                    color: 'black',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  {fav}
                </button>
              ))}
            </div>
          </div>
        )}

        {queryHistory.length > 0 && mounted && (
          <div style={{ margin: '20px 0' }}>
            <h3>🕒 Recent Queries:</h3>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {queryHistory.slice(0, 5).map((hist, index) => (
                <button
                  key={index}
                  onClick={() => handleExampleClick(hist)}
                  style={{
                    padding: '6px 10px',
                    background: '#f0f0f0',
                    color: 'black',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  {hist}
                </button>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ margin: '20px 0' }}>
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ask a question..."
            style={{
              padding: '10px',
              width: '300px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              marginRight: '10px'
            }}
          />
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '10px 20px',
              background: '#667eea',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            {loading ? 'Loading...' : 'Ask'}
          </button>
          {response && mounted && (
            <button
              type="button"
              onClick={exportData}
              style={{
                padding: '10px 15px',
                background: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                marginLeft: '10px'
              }}
            >
              📥 Export
            </button>
          )}
        </form>

        {response && (
          <div style={{ margin: '20px 0', padding: '20px', background: '#f5f5f5', borderRadius: '8px' }}>
            <h2>Result</h2>
            {renderChart(response)}
            {/* Simple analysis/summary for non-executives */}
            {response.summary && (
              <div style={{
                marginTop: 32,
                padding: 24,
                background: '#fffbe6',
                borderRadius: 10,
                border: '2px solid #ffd700',
                boxShadow: '0 2px 12px rgba(255, 215, 0, 0.10)',
                color: '#333',
                fontSize: '1.15em',
                maxWidth: 700,
                marginLeft: 'auto',
                marginRight: 'auto',
                textAlign: 'left',
                fontWeight: 500
              }}>
                <h3 style={{ marginBottom: 12, color: '#b48800', fontWeight: 700, fontSize: '1.3em' }}>Analysis</h3>
                {/* Input Analysis */}
                <div style={{ marginBottom: 14, padding: '10px 0', borderBottom: '1px solid #ffe066' }}>
                  <b>Input Query:</b> <span style={{ color: '#0070f3' }}>{prompt}</span>
                </div>
                {/* Output/Chart Analysis */}
                <div style={{ marginBottom: 18 }}>
                  <b>Output:</b> {response.chartType && (
                    <span style={{ color: '#a020f0' }}>
                      {(() => {
                        switch (response.chartType) {
                          case 'bar': return 'Bar chart (comparison)';
                          case 'line': return 'Line chart (trend over time)';
                          case 'pie': return 'Pie chart (distribution)';
                          case 'area': return 'Area chart (volume/trend)';
                          case 'scatter': return 'Scatter plot (correlation)';
                          case 'table': return 'Table (summary statistics)';
                          default: return response.chartType;
                        }
                      })()}
                    </span>
                  )}
                  {response.xKey && response.yKey && (
                    <span> showing <b>{response.yKey.replace(/([A-Z])/g, ' $1').toLowerCase()}</b> by <b>{response.xKey.replace(/([A-Z])/g, ' $1').toLowerCase()}</b>.</span>
                  )}
                </div>
                <ul style={{ margin: 0, paddingLeft: 28, color: '#444', fontSize: '1.08em' }}>
                  {Object.entries(response.summary).map(([key, value]) => (
                    <li key={key} style={{ marginBottom: 6 }}>
                      <b>{key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:</b> {typeof value === 'number' ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : value}
                    </li>
                  ))}
                </ul>
                <div style={{ marginTop: 14, color: '#222', fontSize: '1.09em', fontWeight: 400 }}>
                  {/* Friendly summary for non-executives */}
                  {response.summary.totalRevenue && (
                    <div style={{ marginBottom: 4 }}>Total revenue generated is <b style={{ color: '#008000' }}>₹{response.summary.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</b>.</div>
                  )}
                  {response.summary.totalCampaigns && (
                    <div style={{ marginBottom: 4 }}>There are <b style={{ color: '#0070f3' }}>{response.summary.totalCampaigns}</b> unique campaigns in the data.</div>
                  )}
                  {response.summary.segments && (
                    <div style={{ marginBottom: 4 }}>The data covers <b style={{ color: '#a020f0' }}>{response.summary.segments}</b> customer segments.</div>
                  )}
                  {response.summary.avgROI && (
                    <div style={{ marginBottom: 4 }}>The average ROI across all campaigns is <b style={{ color: '#e67e22' }}>{response.summary.avgROI.toFixed(2)}%</b>.</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
