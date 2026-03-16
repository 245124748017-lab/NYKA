import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import Navbar from '../components/Navbar';
import SearchBar from '../components/SearchBar';
import UploadCSV from '../components/UploadCSV';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1', '#d084d0', '#ffb347', '#87ceeb'];

const EXAMPLE_PROMPTS = [
  '📊 revenue by campaign type',
  '🎯 Top 5 campaigns by ROI',
  '📈 Revenue trend over time',
  '🔄 Conversion rate by segment',
  '💰 Compare ROI across segments',
];

export default function Home() {
  const router = useRouter();
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [queryHistory, setQueryHistory] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [currentFile, setCurrentFile] = useState('default');
  const [chatMessages, setChatMessages] = useState([]);
  const [followUpInput, setFollowUpInput] = useState('');
  const [showChat, setShowChat] = useState(false);
  const chatContainerRef = useRef(null);

  // Load from localStorage
  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('nyka-theme');
      if (savedTheme === 'dark') {
        setIsDarkMode(true);
        document.body.classList.add('dark-mode');
      }

      const savedHistory = localStorage.getItem('nyka-query-history');
      if (savedHistory) setQueryHistory(JSON.parse(savedHistory));

      const savedFavorites = localStorage.getItem('nyka-favorites');
      if (savedFavorites) setFavorites(JSON.parse(savedFavorites));
    }
  }, []);

  // Auto scroll chat to bottom
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const toggleTheme = () => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);
    if (newTheme) {
      document.body.classList.add('dark-mode');
      localStorage.setItem('nyka-theme', 'dark');
    } else {
      document.body.classList.remove('dark-mode');
      localStorage.setItem('nyka-theme', 'light');
    }
  };

  const queryBackend = useCallback(
    async (query, file = currentFile) => {
      setLoading(true);
      setError(null);
      try {
        const payload = {
          prompt: query,
          filename: file === 'default' ? null : file,
        };

        const res = await axios.post(`${API_BASE}/query`, payload, {
          timeout: 30000,
        });

        if (res.data.success) {
          const data = res.data;
          setResponse(data);

          // Add to history
          if (mounted) {
            const newHistory = [query, ...queryHistory.slice(0, 9)];
            setQueryHistory(newHistory);
            localStorage.setItem('nyka-query-history', JSON.stringify(newHistory));
          }

          // Initialize chat with first message
          setChatMessages([
            {
              type: 'assistant',
              text: data.analysis,
              timestamp: new Date(),
            },
          ]);
          setShowChat(true);

          return data;
        } else {
          throw new Error(res.data.message || 'Query failed');
        }
      } catch (err) {
        const errorMsg =
          err.response?.data?.detail ||
          err.message ||
          'Error querying backend. Please try again.';
        setError(errorMsg);
        console.error('Query error:', err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [currentFile, mounted, queryHistory]
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    await queryBackend(prompt);
  };

  const handleExampleClick = async (example) => {
    setPrompt(example);
    await queryBackend(example);
  };

  const handleFollowUp = async (e) => {
    e.preventDefault();
    if (!followUpInput.trim() || !response) return;

    // Add user message to chat
    setChatMessages((prev) => [
      ...prev,
      { type: 'user', text: followUpInput, timestamp: new Date() },
    ]);

    setFollowUpInput('');
    setLoading(true);

    try {
      // For now, generate a contextual follow-up
      const followUpQuery = `${prompt} - ${followUpInput}`;
      const result = await queryBackend(followUpQuery);

      if (result) {
        setChatMessages((prev) => [
          ...prev,
          { type: 'assistant', text: result.analysis, timestamp: new Date() },
        ]);
        setResponse(result);
      }
    } catch (err) {
      setChatMessages((prev) => [
        ...prev,
        {
          type: 'error',
          text: 'Failed to process follow-up question',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const toggleFavorite = (query) => {
    let newFavorites;
    if (favorites.includes(query)) {
      newFavorites = favorites.filter((q) => q !== query);
    } else {
      newFavorites = [query, ...favorites.slice(0, 4)];
    }
    setFavorites(newFavorites);
    localStorage.setItem('nyka-favorites', JSON.stringify(newFavorites));
  };

  const handleFileUpload = (filename) => {
    setCurrentFile(filename);
    setResponse(null);
    setPrompt('');
  };

  const renderChart = () => {
    if (!response || !response.data) return null;

    const { chartType, data, xKey, yKey } = response;
    const containerProps = {
      width: '100%',
      height: 400,
      margin: { top: 20, right: 30, left: 0, bottom: 20 },
    };

    switch (chartType) {
      case 'line':
        return (
          <ResponsiveContainer {...containerProps}>
            <LineChart data={data} margin={{ top: 20, right: 30, left: 60, bottom: 50 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={xKey} />
              <YAxis label={{ value: yKey, angle: -90, position: 'insideLeft', offset: -10 }} />
              <Tooltip formatter={(value) => typeof value === 'number' ? value.toLocaleString() : value} />
              <Legend />
              <Line
                type="monotone"
                dataKey={yKey}
                stroke="#8884d8"
                name={yKey}
                dot={{ r: 4 }}
                isAnimationActive={true}
              />
            </LineChart>
          </ResponsiveContainer>
        );

      case 'bar':
        return (
          <ResponsiveContainer {...containerProps}>
            <BarChart data={data} margin={{ top: 20, right: 30, left: 60, bottom: 80 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={xKey} angle={-45} textAnchor="end" height={100} />
              <YAxis label={{ value: yKey, angle: -90, position: 'insideLeft', offset: -10 }} />
              <Tooltip formatter={(value) => typeof value === 'number' ? value.toLocaleString() : value} />
              <Legend />
              <Bar dataKey={yKey} fill="#8884d8" name={yKey} isAnimationActive={true} />
            </BarChart>
          </ResponsiveContainer>
        );

      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={500}>
            <PieChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={true}
                label={({ [xKey]: name, [yKey]: value }) => `${name}: ${typeof value === 'number' ? value.toLocaleString() : value}`}
                outerRadius={120}
                innerRadius={0}
                fill="#8884d8"
                dataKey={yKey}
                nameKey={xKey}
              >
                {data && data.length > 0 && data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value) => typeof value === 'number' ? value.toLocaleString() : value}
                contentStyle={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb' }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        );

      case 'area':
        return (
          <ResponsiveContainer {...containerProps}>
            <AreaChart data={data} margin={{ top: 20, right: 30, left: 60, bottom: 50 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={xKey} />
              <YAxis label={{ value: yKey, angle: -90, position: 'insideLeft', offset: -10 }} />
              <Tooltip formatter={(value) => typeof value === 'number' ? value.toLocaleString() : value} />
              <Legend />
              <Area
                type="monotone"
                dataKey={yKey}
                fill="#8884d8"
                stroke="#8884d8"
                name={yKey}
                isAnimationActive={true}
              />
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'scatter':
        return (
          <ResponsiveContainer {...containerProps}>
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" dataKey={xKey} />
              <YAxis type="number" dataKey={yKey} />
              <Tooltip />
              <Legend />
              <Scatter
                name={yKey}
                data={data}
                fill="#8884d8"
                isAnimationActive={true}
              />
            </ScatterChart>
          </ResponsiveContainer>
        );

      case 'table':
        return (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  {Object.keys(data[0] || {}).map((key) => (
                    <th key={key}>{key}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row, idx) => (
                  <tr key={idx}>
                    {Object.values(row).map((val, vIdx) => (
                      <td key={vIdx}>{typeof val === 'number' ? val.toFixed(2) : val}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );

      default:
        return null;
    }
  };

  const isFavorited = mounted && prompt && favorites.includes(prompt);

  return (
    <div className={`page-container ${isDarkMode ? 'dark-mode' : ''}`}>
      <Navbar theme={isDarkMode} onThemeToggle={toggleTheme} />

      <div className="main-content">
        {/* Search Section - Title Only */}
        <section className="search-section">
          <h1 className="title">🚀 Conversational Business Intelligence</h1>
          <p className="subtitle">Ask any question about your data in plain English</p>
        </section>

        {/* File Upload Section */}
        <section className="upload-section">
          <UploadCSV onFileUpload={handleFileUpload} currentFile={currentFile} />
        </section>

        {/* Search/Query Section */}
        <section className="query-section">
          <form onSubmit={handleSubmit} className="query-form">
            <div className="input-wrapper">
              <input
                type="text"
                placeholder="E.g., 'Show revenue by campaign type' or 'Top 10 products by ROI'"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="search-input"
                disabled={loading}
              />
              <button type="submit" disabled={loading} className="search-button">
                {loading ? '🔄 Generating...' : '✨ Generate Dashboard'}
              </button>
              {prompt && (
                <button
                  type="button"
                  className={`favorite-button ${isFavorited ? 'favorited' : ''}`}
                  onClick={() => toggleFavorite(prompt)}
                  title="Add to favorites"
                >
                  {isFavorited ? '⭐' : '☆'}
                </button>
              )}
            </div>
          </form>

          {error && (
            <div className="error-box">
              <strong>⚠️ Error:</strong> {error}
            </div>
          )}

          {loading && (
            <div className="loading-indicator">
              <div className="spinner"></div>
              <p>Analyzing your data and generating dashboard...</p>
            </div>
          )}

          {/* Example Prompts */}
          {!response && !loading && (
            <div className="examples-section">
              <h3>💡 Try These Queries:</h3>
              <div className="examples-grid">
                {EXAMPLE_PROMPTS.map((example, idx) => (
                  <button
                    key={idx}
                    className="example-button"
                    onClick={() => handleExampleClick(example)}
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Results Section */}
        {response && !loading && (
          <section className="results-section">
            <div className="chart-container">{renderChart()}</div>

            {/* Analysis & Summary */}
            <div className="insights-panel">
              <h3>📊 Analysis</h3>
              <p className="analysis-text">{response.analysis}</p>

              {response.summary && (
                <div className="summary-stats">
                  <h4>📈 Key Metrics</h4>
                  <div className="stats-grid">
                    {Object.entries(response.summary)
                      .slice(0, 4)
                      .map(([key, value]) => (
                        <div key={key} className="stat-item">
                          <span className="stat-label">{key.replace(/_/g, ' ')}</span>
                          <span className="stat-value">
                            {typeof value === 'number'
                              ? value > 1000
                                ? `₹${(value / 1000).toFixed(1)}K`
                                : value.toFixed(2)
                              : value}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Suggested Follow-Ups */}
              {response.suggested_follow_ups && response.suggested_follow_ups.length > 0 && (
                <div className="follow-up-suggestions">
                  <h4>💬 Suggested Questions:</h4>
                  <div className="suggestions-list">
                    {response.suggested_follow_ups.map((suggestion, idx) => (
                      <button
                        key={idx}
                        className="suggestion-button"
                        onClick={() => handleExampleClick(suggestion)}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Chat Interface */}
        {showChat && response && (
          <section className="chat-section">
            <h3>💬 Follow-up Questions</h3>
            <div className="chat-messages" ref={chatContainerRef}>
              {chatMessages.map((msg, idx) => (
                <div key={idx} className={`chat-message ${msg.type}`}>
                  <span className="message-icon">
                    {msg.type === 'user' ? '👤' : msg.type === 'error' ? '❌' : '🤖'}
                  </span>
                  <span className="message-text">{msg.text}</span>
                </div>
              ))}
            </div>

            <form onSubmit={handleFollowUp} className="follow-up-form">
              <input
                type="text"
                placeholder="Ask a follow-up question about this data..."
                value={followUpInput}
                onChange={(e) => setFollowUpInput(e.target.value)}
                disabled={loading}
                className="follow-up-input"
              />
              <button type="submit" disabled={loading} className="follow-up-button">
                {loading ? '...' : '→'}
              </button>
            </form>
          </section>
        )}

        {/* Query History & Favorites */}
        {mounted && (queryHistory.length > 0 || favorites.length > 0) && !response && (
          <section className="history-section">
            {favorites.length > 0 && (
              <div className="favorites-panel">
                <h3>⭐ Favorite Queries</h3>
                <div className="history-list">
                  {favorites.map((query, idx) => (
                    <button
                      key={idx}
                      className="history-item favorite"
                      onClick={() => handleExampleClick(query)}
                    >
                      {query}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {queryHistory.length > 0 && (
              <div className="history-panel">
                <h3>🕐 Recent Queries</h3>
                <div className="history-list">
                  {queryHistory.slice(0, 5).map((query, idx) => (
                    <button
                      key={idx}
                      className="history-item"
                      onClick={() => handleExampleClick(query)}
                    >
                      {query}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
