#!/usr/bin/env python3
"""
Unit tests for logic_validator.py

Tests all validation rules to ensure they correctly identify issues.
"""

import unittest
import sys
import os

# Add hooks directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'hooks'))

from logic_validator import LogicValidator, analyze_code_logic


class TestSilentFailures(unittest.TestCase):
    """Test detection of silent failure patterns"""

    def test_detect_silent_failure_empty_list(self):
        """Should detect exception returning empty list without logging"""
        code = """
try:
    results = search()
except Exception as e:
    return []
"""
        result = analyze_code_logic(code)
        self.assertTrue(result['is_buggy'])
        self.assertIn('silent_failure', [i.issue_type for i in result['issues']])

    def test_detect_silent_failure_none(self):
        """Should detect exception returning None without logging"""
        code = """
try:
    data = fetch()
except Exception:
    return None
"""
        result = analyze_code_logic(code)
        self.assertTrue(result['is_buggy'])

    def test_allow_logged_failure(self):
        """Should allow empty return if error is logged"""
        code = """
import logging
logger = logging.getLogger(__name__)

try:
    results = search()
except Exception as e:
    logger.error(f"Search failed: {e}")
    return []
"""
        result = analyze_code_logic(code)
        # Should not have critical silent_failure issues
        critical_silent_failures = [
            i for i in result['issues']
            if i.issue_type == 'silent_failure' and i.severity == 'critical'
        ]
        self.assertEqual(len(critical_silent_failures), 0)

    def test_allow_print_for_debugging(self):
        """Should allow empty return with print (for debugging)"""
        code = """
try:
    results = search()
except Exception as e:
    print(f"Error: {e}")
    return []
"""
        result = analyze_code_logic(code)
        critical_silent_failures = [
            i for i in result['issues']
            if i.issue_type == 'silent_failure' and i.severity == 'critical'
        ]
        self.assertEqual(len(critical_silent_failures), 0)


class TestBroadExceptions(unittest.TestCase):
    """Test detection of overly broad exception handling"""

    def test_detect_bare_except(self):
        """Should detect bare except clause"""
        code = """
try:
    do_something()
except:
    return None
"""
        result = analyze_code_logic(code)
        bare_except_issues = [i for i in result['issues'] if i.issue_type == 'bare_except']
        self.assertGreater(len(bare_except_issues), 0)

    def test_detect_broad_exception_without_reraise(self):
        """Should warn about catching Exception without re-raising"""
        code = """
try:
    risky_operation()
except Exception as e:
    return None
"""
        result = analyze_code_logic(code)
        broad_exception_issues = [i for i in result['issues'] if i.issue_type == 'broad_exception']
        self.assertGreater(len(broad_exception_issues), 0)

    def test_allow_exception_with_reraise(self):
        """Should allow Exception catch if it re-raises"""
        code = """
try:
    risky_operation()
except Exception as e:
    logger.error(f"Error: {e}")
    raise
"""
        result = analyze_code_logic(code)
        # Should not warn about broad exception if re-raising
        broad_exception_issues = [i for i in result['issues'] if i.issue_type == 'broad_exception']
        self.assertEqual(len(broad_exception_issues), 0)

    def test_allow_exception_with_conditional_reraise(self):
        """Should allow Exception catch with conditional re-raise"""
        code = """
try:
    risky_operation()
except Exception as e:
    if 'critical' in str(e):
        raise
    logger.warning(f"Non-critical error: {e}")
"""
        result = analyze_code_logic(code)
        broad_exception_issues = [i for i in result['issues'] if i.issue_type == 'broad_exception']
        self.assertEqual(len(broad_exception_issues), 0)

    def test_prefer_specific_exceptions(self):
        """Should prefer specific exception types"""
        code = """
try:
    value = int(user_input)
except ValueError as e:
    logger.warning(f"Invalid input: {e}")
    return None
"""
        result = analyze_code_logic(code)
        # Should not have any broad exception warnings
        broad_issues = [
            i for i in result['issues']
            if 'broad' in i.issue_type or 'bare' in i.issue_type
        ]
        self.assertEqual(len(broad_issues), 0)


class TestErrorPropagation(unittest.TestCase):
    """Test detection of missing error propagation for critical errors"""

    def test_detect_swallowed_gpu_error(self):
        """Should detect GPU errors that are not propagated"""
        code = """
try:
    model.forward(data)
except Exception as e:
    if 'cuda' in str(e).lower():
        logger.error("GPU error")
        return None
"""
        result = analyze_code_logic(code)
        propagation_issues = [
            i for i in result['issues']
            if i.issue_type == 'critical_error_not_propagated'
        ]
        self.assertGreater(len(propagation_issues), 0)

    def test_detect_swallowed_oom_error(self):
        """Should detect OOM errors that are not propagated"""
        code = """
try:
    load_model()
except Exception as e:
    if 'oom' in str(e).lower():
        return None
"""
        result = analyze_code_logic(code)
        propagation_issues = [
            i for i in result['issues']
            if i.issue_type == 'critical_error_not_propagated'
        ]
        self.assertGreater(len(propagation_issues), 0)

    def test_allow_propagated_critical_error(self):
        """Should allow critical errors that are propagated"""
        code = """
try:
    model.forward(data)
except RuntimeError as e:
    if 'cuda' in str(e).lower():
        logger.error(f"FATAL GPU error: {e}")
        raise
    logger.error(f"Model error: {e}")
    return None
"""
        result = analyze_code_logic(code)
        propagation_issues = [
            i for i in result['issues']
            if i.issue_type == 'critical_error_not_propagated'
        ]
        self.assertEqual(len(propagation_issues), 0)


class TestMissingMetrics(unittest.TestCase):
    """Test detection of missing failure metrics"""

    def test_suggest_metrics_for_logged_errors(self):
        """Should suggest adding metrics when logging errors"""
        code = """
import logging
logger = logging.getLogger(__name__)

try:
    operation()
except ValueError as e:
    logger.error(f"Error: {e}")
    return None
"""
        result = analyze_code_logic(code)
        metrics_issues = [i for i in result['issues'] if i.issue_type == 'missing_metrics']
        # This should be an info-level suggestion
        self.assertGreater(len(metrics_issues), 0)
        for issue in metrics_issues:
            self.assertEqual(issue.severity, 'info')

    def test_allow_metrics_tracking(self):
        """Should not complain if metrics are tracked"""
        code = """
import logging
logger = logging.getLogger(__name__)

class MyClass:
    def __init__(self):
        self.metrics = {'failures': 0}

    def operation(self):
        try:
            do_something()
        except ValueError as e:
            logger.error(f"Error: {e}")
            self.metrics['failures'] += 1
            return None
"""
        result = analyze_code_logic(code)
        metrics_issues = [i for i in result['issues'] if i.issue_type == 'missing_metrics']
        self.assertEqual(len(metrics_issues), 0)


class TestAmbiguousErrors(unittest.TestCase):
    """Test detection of ambiguous error messages"""

    def test_detect_generic_error_message(self):
        """Should detect generic error messages"""
        code = """
import logging
logger = logging.getLogger(__name__)

logger.error("error")
"""
        result = analyze_code_logic(code)
        ambiguous_issues = [i for i in result['issues'] if i.issue_type == 'ambiguous_error']
        self.assertGreater(len(ambiguous_issues), 0)

    def test_detect_failed_message(self):
        """Should detect 'failed' as ambiguous"""
        code = """
import logging
logger = logging.getLogger(__name__)

logger.error("failed")
"""
        result = analyze_code_logic(code)
        ambiguous_issues = [i for i in result['issues'] if i.issue_type == 'ambiguous_error']
        self.assertGreater(len(ambiguous_issues), 0)

    def test_allow_specific_error_message(self):
        """Should allow specific, informative error messages"""
        code = """
import logging
logger = logging.getLogger(__name__)

logger.error("Failed to connect to database: connection timeout after 30s")
"""
        result = analyze_code_logic(code)
        ambiguous_issues = [i for i in result['issues'] if i.issue_type == 'ambiguous_error']
        self.assertEqual(len(ambiguous_issues), 0)


class TestComplexScenarios(unittest.TestCase):
    """Test complex real-world scenarios"""

    def test_src_pattern_bad(self):
        """Test the bad pattern from production system"""
        code = """
def search_concepts(self, concept):
    try:
        results = self.search_engine.search(concept)
        return results
    except Exception as e:
        return []
"""
        result = analyze_code_logic(code)
        self.assertTrue(result['is_buggy'])
        # Should have both silent failure and broad exception
        issue_types = [i.issue_type for i in result['issues']]
        self.assertIn('silent_failure', issue_types)
        self.assertIn('broad_exception', issue_types)

    def test_src_pattern_good(self):
        """Test the corrected pattern from production system"""
        code = """
import logging
logger = logging.getLogger(__name__)

class SearchEngine:
    def __init__(self):
        self.metrics = {'search_failures': 0}

    def search_concepts(self, concept):
        try:
            results = self.search_engine.search(concept)
            return results
        except ValueError as e:
            logger.warning(f"Invalid concept: {e}")
            return []
        except RuntimeError as e:
            if 'cuda' in str(e).lower():
                logger.error(f"FATAL GPU error: {e}")
                raise
            logger.error(f"Search error: {e}")
            self.metrics['search_failures'] += 1
            return []
"""
        result = analyze_code_logic(code)
        # Should not be buggy (no critical issues)
        self.assertFalse(result['is_buggy'])

    def test_multiple_handlers_good(self):
        """Test multiple exception handlers with proper handling"""
        code = """
import logging
logger = logging.getLogger(__name__)

def process_data(data):
    try:
        return int(data)
    except ValueError as e:
        logger.warning(f"Invalid data format: {e}")
        return None
    except TypeError as e:
        logger.error(f"Type error: {e}")
        raise
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        raise
"""
        result = analyze_code_logic(code)
        # Should not have critical issues
        self.assertFalse(result['is_buggy'])


class TestEdgeCases(unittest.TestCase):
    """Test edge cases and boundary conditions"""

    def test_syntax_error(self):
        """Should handle syntax errors gracefully"""
        code = """
def broken(:
    pass
"""
        result = analyze_code_logic(code)
        self.assertTrue(result['is_buggy'])
        self.assertIn('Syntax error', result['logical_statement'])

    def test_empty_code(self):
        """Should handle empty code"""
        code = ""
        result = analyze_code_logic(code)
        self.assertFalse(result['is_buggy'])

    def test_no_try_blocks(self):
        """Should handle code without try blocks"""
        code = """
def simple_function():
    return 42
"""
        result = analyze_code_logic(code)
        self.assertFalse(result['is_buggy'])

    def test_nested_try_blocks(self):
        """Should handle nested try blocks"""
        code = """
import logging
logger = logging.getLogger(__name__)

try:
    try:
        risky()
    except ValueError as e:
        logger.error(f"Inner: {e}")
        raise
except Exception as e:
    return None
"""
        result = analyze_code_logic(code)
        # Outer exception handler has issues
        broad_issues = [i for i in result['issues'] if 'broad' in i.issue_type]
        self.assertGreater(len(broad_issues), 0)

    def test_try_in_function_class(self):
        """Should handle try blocks in various contexts"""
        code = """
import logging
logger = logging.getLogger(__name__)

class MyClass:
    def method(self):
        try:
            operation()
        except ValueError as e:
            logger.error(f"Error: {e}")
            return None

def function():
    try:
        operation()
    except ValueError as e:
        logger.error(f"Error: {e}")
        return None
"""
        result = analyze_code_logic(code)
        # Should be OK - specific exceptions with logging
        self.assertFalse(result['is_buggy'])


class TestValidatorConfiguration(unittest.TestCase):
    """Test validator behavior and configuration"""

    def test_issue_severity_levels(self):
        """Test that issues are properly categorized by severity"""
        code = """
try:
    operation()
except Exception as e:
    return []
"""
        result = analyze_code_logic(code)

        # Should have critical issues
        critical = [i for i in result['issues'] if i.severity == 'critical']
        self.assertGreater(len(critical), 0)

        # Should have warnings
        warnings = [i for i in result['issues'] if i.severity == 'warning']
        self.assertGreater(len(warnings), 0)

    def test_suggestions_provided(self):
        """Test that suggestions are provided for all issues"""
        code = """
try:
    operation()
except:
    return None
"""
        result = analyze_code_logic(code)

        for issue in result['issues']:
            self.assertIsNotNone(issue.suggestion)
            self.assertGreater(len(issue.suggestion), 0)

    def test_line_numbers_accurate(self):
        """Test that line numbers are accurate"""
        code = """
# Line 1
# Line 2
try:  # Line 3
    operation()  # Line 4
except Exception:  # Line 5
    return None  # Line 6
"""
        result = analyze_code_logic(code)

        for issue in result['issues']:
            # Line numbers should be in reasonable range
            self.assertGreaterEqual(issue.line, 3)
            self.assertLessEqual(issue.line, 6)


def run_tests():
    """Run all tests and return results"""
    loader = unittest.TestLoader()
    suite = loader.loadTestsFromModule(sys.modules[__name__])
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    return result.wasSuccessful()


if __name__ == '__main__':
    success = run_tests()
    sys.exit(0 if success else 1)
