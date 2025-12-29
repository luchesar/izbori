#!/usr/bin/env python3
"""
Tests for analyze_fraud.py
"""

import pytest
from analyze_fraud import calculate_cv, load_election_data, get_top_parties


class TestCalculateCV:
    """Tests for the Coefficient of Variation calculation."""
    
    def test_basic_cv(self):
        """Test CV calculation with simple values."""
        # Values: [100, 100, 100] -> mean=100, std=0, CV=0
        assert calculate_cv([100, 100, 100]) == 0
    
    def test_variable_values(self):
        """Test CV with varying values."""
        # Values: [100, 200] -> mean=150, std=50, CV=33.33
        result = calculate_cv([100, 200])
        assert result is not None
        assert 33 < result < 34  # ~33.33%
    
    def test_high_variability(self):
        """Test CV with high variability."""
        # Values: [10, 100] -> mean=55, std=45, CV=81.8
        result = calculate_cv([10, 100])
        assert result is not None
        assert result > 80
    
    def test_single_value_returns_none(self):
        """CV needs at least 2 values."""
        assert calculate_cv([100]) is None
    
    def test_empty_list_returns_none(self):
        """CV of empty list is None."""
        assert calculate_cv([]) is None
    
    def test_all_zeros_returns_none(self):
        """CV when all values are zero."""
        assert calculate_cv([0, 0, 0]) is None
    
    def test_filters_zeros(self):
        """Zero values should be filtered out."""
        # [100, 100, 0] -> only [100, 100] considered
        result = calculate_cv([100, 100, 0])
        assert result == 0  # No variation in non-zero values
    
    def test_realistic_election_data(self):
        """Test with realistic voter turnout numbers."""
        # Roughly stable turnout
        stable = [1500, 1450, 1520, 1480, 1510]
        result = calculate_cv(stable)
        assert result is not None
        assert result < 5  # Low variability
        
        # Highly variable turnout (suspicious)
        variable = [1500, 500, 2000, 800, 3000]
        result = calculate_cv(variable)
        assert result is not None
        assert result > 50  # High variability


class TestIntegration:
    """Integration-level tests."""
    
    def test_cv_threshold_detection(self):
        """Verify that 30% threshold catches anomalies."""
        # Normal variation (should be below 30%)
        normal = [100, 105, 95, 102, 98]
        assert calculate_cv(normal) < 30
        
        # Suspicious variation (should be above 30%)
        suspicious = [100, 50, 150, 80, 120]
        assert calculate_cv(suspicious) > 30


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
