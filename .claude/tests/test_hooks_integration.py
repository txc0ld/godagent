#!/usr/bin/env python3
"""
Integration tests for Claude Code hooks

Tests that hooks work correctly with realistic inputs and scenarios.
"""

import unittest
import subprocess
import json
import sys
import os
import tempfile
from pathlib import Path


class TestPreCommitValidation(unittest.TestCase):
    """Test pre_commit_validation.py hook"""

    def setUp(self):
        """Set up test environment"""
        self.hook_path = Path(__file__).parent.parent / 'hooks' / 'pre_commit_validation.py'
        self.test_dir = Path(tempfile.mkdtemp())
        self.original_dir = os.getcwd()

        # Initialize git repo in test directory
        os.chdir(self.test_dir)
        subprocess.run(['git', 'init'], capture_output=True)
        subprocess.run(['git', 'config', 'user.email', 'test@test.com'], capture_output=True)
        subprocess.run(['git', 'config', 'user.name', 'Test User'], capture_output=True)

    def tearDown(self):
        """Clean up test environment"""
        os.chdir(self.original_dir)
        subprocess.run(['rm', '-rf', str(self.test_dir)], capture_output=True)

    def test_blocks_silent_failure(self):
        """Should block commit with silent failure"""
        # Create file with silent failure
        bad_file = self.test_dir / 'bad_code.py'
        bad_file.write_text("""
def search():
    try:
        return api.search()
    except Exception:
        return []
""")

        # Stage the file
        subprocess.run(['git', 'add', 'bad_code.py'], cwd=self.test_dir)

        # Run hook
        hook_input = {
            'session_id': 'test',
            'tool_input': {'command': 'git commit -m "test"'}
        }

        result = subprocess.run(
            ['python3', str(self.hook_path)],
            input=json.dumps(hook_input),
            capture_output=True,
            text=True,
            cwd=self.test_dir
        )

        # Should block (exit code 2)
        self.assertEqual(result.returncode, 2)
        self.assertIn('LOGICAL VALIDATION FAILED', result.stderr)

    def test_allows_good_code(self):
        """Should allow commit with good code"""
        # Create file with proper error handling
        good_file = self.test_dir / 'good_code.py'
        good_file.write_text("""
import logging
logger = logging.getLogger(__name__)

def search():
    try:
        return api.search()
    except ValueError as e:
        logger.error(f"Search error: {e}")
        return []
""")

        # Stage the file
        subprocess.run(['git', 'add', 'good_code.py'], cwd=self.test_dir)

        # Run hook
        hook_input = {
            'session_id': 'test',
            'tool_input': {'command': 'git commit -m "test"'}
        }

        result = subprocess.run(
            ['python3', str(self.hook_path)],
            input=json.dumps(hook_input),
            capture_output=True,
            text=True,
            cwd=self.test_dir
        )

        # Should allow (exit code 0)
        self.assertEqual(result.returncode, 0)
        self.assertIn('passed', result.stderr.lower())

    def test_handles_no_python_files(self):
        """Should handle case with no Python files"""
        # Create and stage non-Python file
        txt_file = self.test_dir / 'readme.txt'
        txt_file.write_text("Hello")
        subprocess.run(['git', 'add', 'readme.txt'], cwd=self.test_dir)

        # Run hook
        hook_input = {
            'session_id': 'test',
            'tool_input': {'command': 'git commit -m "test"'}
        }

        result = subprocess.run(
            ['python3', str(self.hook_path)],
            input=json.dumps(hook_input),
            capture_output=True,
            text=True,
            cwd=self.test_dir
        )

        # Should allow (exit code 0)
        self.assertEqual(result.returncode, 0)
        self.assertIn('No Python files', result.stderr)

    def test_reports_multiple_issues(self):
        """Should report all issues in a file"""
        # Create file with multiple issues
        bad_file = self.test_dir / 'multiple_issues.py'
        bad_file.write_text("""
def func1():
    try:
        return api.search()
    except Exception:
        return []

def func2():
    try:
        return api.fetch()
    except:
        return None
""")

        subprocess.run(['git', 'add', 'multiple_issues.py'], cwd=self.test_dir)

        hook_input = {
            'session_id': 'test',
            'tool_input': {'command': 'git commit -m "test"'}
        }

        result = subprocess.run(
            ['python3', str(self.hook_path)],
            input=json.dumps(hook_input),
            capture_output=True,
            text=True,
            cwd=self.test_dir
        )

        # Should block and report multiple issues
        self.assertEqual(result.returncode, 2)
        # Should mention both silent failures
        self.assertTrue(result.stderr.count('silent_failure') >= 2 or
                       result.stderr.count('bare_except') >= 1)


class TestAnalyzeCodeLogic(unittest.TestCase):
    """Test analyze_code_logic.py hook"""

    def setUp(self):
        """Set up test environment"""
        self.hook_path = Path(__file__).parent.parent / 'hooks' / 'analyze_code_logic.py'
        self.test_dir = Path(tempfile.mkdtemp())

    def tearDown(self):
        """Clean up test environment"""
        subprocess.run(['rm', '-rf', str(self.test_dir)], capture_output=True)

    def test_analyzes_python_file(self):
        """Should analyze Python file and provide feedback"""
        # Create file with issues
        test_file = self.test_dir / 'test.py'
        test_file.write_text("""
try:
    operation()
except Exception:
    return None
""")

        # Run hook
        hook_input = {
            'tool_input': {'file_path': str(test_file)}
        }

        result = subprocess.run(
            ['python3', str(self.hook_path)],
            input=json.dumps(hook_input),
            capture_output=True,
            text=True
        )

        # Should analyze and provide feedback
        self.assertEqual(result.returncode, 0)  # Don't block in PostToolUse
        self.assertIn('Analyzing', result.stderr)

    def test_skips_non_python_files(self):
        """Should skip non-Python files"""
        # Create non-Python file
        test_file = self.test_dir / 'test.txt'
        test_file.write_text("Hello")

        # Run hook
        hook_input = {
            'tool_input': {'file_path': str(test_file)}
        }

        result = subprocess.run(
            ['python3', str(self.hook_path)],
            input=json.dumps(hook_input),
            capture_output=True,
            text=True
        )

        # Should exit immediately
        self.assertEqual(result.returncode, 0)
        # Should not analyze
        self.assertNotIn('Analyzing', result.stderr)

    def test_handles_missing_file(self):
        """Should handle missing file gracefully"""
        # Use non-existent file
        hook_input = {
            'tool_input': {'file_path': '/nonexistent/file.py'}
        }

        result = subprocess.run(
            ['python3', str(self.hook_path)],
            input=json.dumps(hook_input),
            capture_output=True,
            text=True
        )

        # Should not crash
        self.assertEqual(result.returncode, 0)


class TestValidateLogic(unittest.TestCase):
    """Test validate_logic.py hook (PreToolUse for Write)"""

    def setUp(self):
        """Set up test environment"""
        self.hook_path = Path(__file__).parent.parent / 'hooks' / 'validate_logic.py'

    def test_blocks_bad_write(self):
        """Should block Write with bad code"""
        bad_code = """
try:
    operation()
except Exception:
    return []
"""

        hook_input = {
            'tool_name': 'Write',
            'tool_input': {
                'file_path': 'test.py',
                'content': bad_code
            }
        }

        result = subprocess.run(
            ['python3', str(self.hook_path)],
            input=json.dumps(hook_input),
            capture_output=True,
            text=True
        )

        # Should block (exit code 2)
        self.assertEqual(result.returncode, 2)
        self.assertIn('VALIDATION FAILED', result.stderr)

    def test_allows_good_write(self):
        """Should allow Write with good code"""
        good_code = """
import logging
logger = logging.getLogger(__name__)

try:
    operation()
except ValueError as e:
    logger.error(f"Error: {e}")
    return None
"""

        hook_input = {
            'tool_name': 'Write',
            'tool_input': {
                'file_path': 'test.py',
                'content': good_code
            }
        }

        result = subprocess.run(
            ['python3', str(self.hook_path)],
            input=json.dumps(hook_input),
            capture_output=True,
            text=True
        )

        # Should allow (exit code 0)
        self.assertEqual(result.returncode, 0)

    def test_skips_non_python_write(self):
        """Should skip validation for non-Python files"""
        hook_input = {
            'tool_name': 'Write',
            'tool_input': {
                'file_path': 'readme.md',
                'content': '# Hello'
            }
        }

        result = subprocess.run(
            ['python3', str(self.hook_path)],
            input=json.dumps(hook_input),
            capture_output=True,
            text=True
        )

        # Should allow without validation
        self.assertEqual(result.returncode, 0)

    def test_skips_edit_operations(self):
        """Should skip Edit operations (validated post-edit)"""
        hook_input = {
            'tool_name': 'Edit',
            'tool_input': {
                'file_path': 'test.py',
                'old_string': 'x',
                'new_string': 'y'
            }
        }

        result = subprocess.run(
            ['python3', str(self.hook_path)],
            input=json.dumps(hook_input),
            capture_output=True,
            text=True
        )

        # Should skip
        self.assertEqual(result.returncode, 0)


class TestFinalValidation(unittest.TestCase):
    """Test final_validation.py hook"""

    def setUp(self):
        """Set up test environment"""
        self.hook_path = Path(__file__).parent.parent / 'hooks' / 'final_validation.py'
        self.test_dir = Path(tempfile.mkdtemp())
        self.original_dir = os.getcwd()

        # Initialize git repo
        os.chdir(self.test_dir)
        subprocess.run(['git', 'init'], capture_output=True)
        subprocess.run(['git', 'config', 'user.email', 'test@test.com'], capture_output=True)
        subprocess.run(['git', 'config', 'user.name', 'Test User'], capture_output=True)

    def tearDown(self):
        """Clean up test environment"""
        os.chdir(self.original_dir)
        subprocess.run(['rm', '-rf', str(self.test_dir)], capture_output=True)

    def test_reports_modified_files(self):
        """Should report on all modified files"""
        # Create and modify files
        file1 = self.test_dir / 'file1.py'
        file1.write_text('def good(): pass')

        file2 = self.test_dir / 'file2.py'
        file2.write_text("""
try:
    x()
except Exception:
    return None
""")

        # Run hook
        hook_input = {'session_id': 'test'}

        result = subprocess.run(
            ['python3', str(self.hook_path)],
            input=json.dumps(hook_input),
            capture_output=True,
            text=True,
            cwd=self.test_dir
        )

        # Should always exit 0 (informational)
        self.assertEqual(result.returncode, 0)
        self.assertIn('VALIDATION SUMMARY', result.stderr)

    def test_handles_no_modified_files(self):
        """Should handle case with no modified files"""
        # Commit all changes
        (self.test_dir / 'file.py').write_text('pass')
        subprocess.run(['git', 'add', '.'], cwd=self.test_dir, capture_output=True)
        subprocess.run(['git', 'commit', '-m', 'initial'], cwd=self.test_dir, capture_output=True)

        # Run hook
        hook_input = {'session_id': 'test'}

        result = subprocess.run(
            ['python3', str(self.hook_path)],
            input=json.dumps(hook_input),
            capture_output=True,
            text=True,
            cwd=self.test_dir
        )

        # Should report no files
        self.assertEqual(result.returncode, 0)
        self.assertIn('No modified', result.stderr)


class TestHookErrorHandling(unittest.TestCase):
    """Test error handling in hooks"""

    def test_pre_commit_handles_invalid_json(self):
        """Should handle invalid JSON input gracefully"""
        hook_path = Path(__file__).parent.parent / 'hooks' / 'pre_commit_validation.py'

        result = subprocess.run(
            ['python3', str(hook_path)],
            input='invalid json',
            capture_output=True,
            text=True
        )

        # Should not crash (exit code 1 for error, not segfault)
        self.assertIn(result.returncode, [0, 1])

    def test_analyze_handles_invalid_json(self):
        """Should handle invalid JSON input gracefully"""
        hook_path = Path(__file__).parent.parent / 'hooks' / 'analyze_code_logic.py'

        result = subprocess.run(
            ['python3', str(hook_path)],
            input='invalid json',
            capture_output=True,
            text=True
        )

        # Should not crash
        self.assertEqual(result.returncode, 0)

    def test_validate_handles_invalid_json(self):
        """Should handle invalid JSON input gracefully"""
        hook_path = Path(__file__).parent.parent / 'hooks' / 'validate_logic.py'

        result = subprocess.run(
            ['python3', str(hook_path)],
            input='invalid json',
            capture_output=True,
            text=True
        )

        # Should not crash
        self.assertEqual(result.returncode, 0)


def run_tests():
    """Run all integration tests"""
    loader = unittest.TestLoader()
    suite = loader.loadTestsFromModule(sys.modules[__name__])
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    return result.wasSuccessful()


if __name__ == '__main__':
    success = run_tests()
    sys.exit(0 if success else 1)
