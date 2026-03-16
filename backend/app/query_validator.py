"""
Query validation and error handling utilities
"""
import pandas as pd
import re
from typing import Tuple, Dict, Any, Optional

class QueryValidator:
    """Validates and sanitizes pandas queries"""
    
    DANGEROUS_PATTERNS = [
        r'__.*__',  # Dunder methods
        r'eval\(',  # eval function
        r'exec\(',  # exec function
        r'compile\(',  # compile function
        r'__import__',  # import exploitation
        r'open\(',  # file operations
    ]
    
    ALLOWED_METHODS = {
        'groupby', 'sum', 'mean', 'count', 'min', 'max', 'std',
        'reset_index', 'sort_values', 'head', 'tail', 'assign',
        'agg', 'filter', 'dropna', 'to_datetime', 'isoformat',
        'nunique', 'unique', 'astype', 'query'
    }
    
    @staticmethod
    def is_safe_query(query_code: str) -> Tuple[bool, Optional[str]]:
        """Check if query code is safe to execute"""
        # Check for dangerous patterns
        for pattern in QueryValidator.DANGEROUS_PATTERNS:
            if re.search(pattern, query_code, re.IGNORECASE):
                return False, f"Dangerous pattern detected: {pattern}"
        
        # Code should start with df
        if not query_code.strip().startswith('df'):
            return False, "Query must start with 'df'"
        
        # Check length
        if len(query_code) > 2000:
            return False, "Query is too long"
        
        return True, None
    
    @staticmethod
    def validate_result(result: Any, max_rows: int = 10000) -> Tuple[bool, Optional[str]]:
        """Validate query result"""
        if isinstance(result, pd.DataFrame):
            if len(result) > max_rows:
                return False, f"Result has {len(result)} rows, max allowed is {max_rows}"
            if len(result.columns) > 50:
                return False, "Result has too many columns"
        return True, None


class HallucinationDetector:
    """Detects if LLM is hallucinating about data"""
    
    @staticmethod
    def validate_columns_exist(df: pd.DataFrame, expected_columns: list) -> Tuple[bool, list]:
        """Check if expected columns exist in dataframe"""
        missing = [col for col in expected_columns if col not in df.columns]
        return len(missing) == 0, missing
    
    @staticmethod
    def get_query_intent(prompt: str) -> Dict[str, Any]:
        """Extract intent from user prompt"""
        prompt_lower = prompt.lower()
        
        intent = {
            'metric': None,
            'groups': [],
            'time_series': False,
            'top_n': None,
        }
        
        # Detect metric
        metrics = {
            'revenue': 'Revenue',
            'roi': 'ROI',
            'clicks': 'Clicks',
            'impressions': 'Impressions',
            'conversions': 'Conversions',
            'conversion rate': 'Conversion_Rate',
        }
        
        for keyword, metric in metrics.items():
            if keyword in prompt_lower:
                intent['metric'] = metric
                break
        
        # Detect grouping
        groups = {
            'segment': 'Customer_Segment',
            'campaign': 'Campaign_Type',
            'date': 'Date',
            'region': 'Region',
        }
        
        for keyword, group in groups.items():
            if keyword in prompt_lower:
                intent['groups'].append(group)
        
        # Detect time series
        time_keywords = ['trend', 'over time', 'by date', 'monthly', 'daily'],
        if any(kw in prompt_lower for kw in time_keywords[0]):
            intent['time_series'] = True
        
        # Detect top N
        top_match = re.search(r'top (\d+)', prompt_lower)
        if top_match:
            intent['top_n'] = int(top_match.group(1))
        
        return intent
    
    @staticmethod
    def validate_query_match_intent(
        df: pd.DataFrame,
        intent: Dict[str, Any],
        query_code: str
    ) -> Tuple[bool, Optional[str]]:
        """Validate that generated query matches user intent"""
        
        # Check if metric exists if specified
        if intent['metric'] and intent['metric'] not in df.columns:
            return False, f"Metric '{intent['metric']}' not found in data"
        
        # Check if groups exist if specified
        for group in intent['groups']:
            if group not in df.columns:
                return False, f"Grouping column '{group}' not found in data"
        
        # Check if query attempts time grouping when needed
        if intent['time_series'] and 'Date' in df.columns:
            if 'groupby' not in query_code and 'Grouper' not in query_code:
                return False, "Query doesn't group by date for time series analysis"
        
        return True, None
