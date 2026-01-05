#!/usr/bin/env python3
"""
Comprehensive test runner for Claude Code hooks system

Runs all tests and provides detailed reporting:
- Unit tests for logic validator
- Integration tests for hooks
- Fixture validation tests
- Performance benchmarks
"""

import sys
import os
import time
import unittest
from pathlib import Path
from typing import Dict, List, Tuple

# Add hooks directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'hooks'))

from logic_validator import analyze_code_logic


class Colors:
    """ANSI color codes"""
    GREEN = '\033[0;32m'
    RED = '\033[0;31m'
    YELLOW = '\033[1;33m'
    BLUE = '\033[0;34m'
    CYAN = '\033[0;36m'
    BOLD = '\033[1m'
    NC = '\033[0m'  # No Color


class TestRunner:
    """Comprehensive test runner"""

    def __init__(self):
        self.test_dir = Path(__file__).parent
        self.results = {
            'unit_tests': None,
            'integration_tests': None,
            'fixture_tests': None,
            'performance_tests': None
        }

    def run_all(self):
        """Run all test suites"""
        print(f"\n{Colors.BOLD}{'=' * 70}{Colors.NC}")
        print(f"{Colors.BOLD}Claude Code Hooks - Comprehensive Test Suite{Colors.NC}")
        print(f"{Colors.BOLD}{'=' * 70}{Colors.NC}\n")

        start_time = time.time()

        # Run each test suite
        self.run_unit_tests()
        self.run_integration_tests()
        self.run_fixture_tests()
        self.run_performance_tests()

        elapsed = time.time() - start_time

        # Print summary
        self.print_summary(elapsed)

        # Return overall success
        return all([
            self.results['unit_tests'],
            self.results['integration_tests'],
            self.results['fixture_tests'],
            self.results['performance_tests']
        ])

    def run_unit_tests(self):
        """Run unit tests for logic validator"""
        print(f"\n{Colors.BLUE}{Colors.BOLD}1. Unit Tests - Logic Validator{Colors.NC}")
        print(f"{Colors.BLUE}{'─' * 70}{Colors.NC}\n")

        try:
            # Import test module
            import test_logic_validator

            # Run tests
            loader = unittest.TestLoader()
            suite = loader.loadTestsFromModule(test_logic_validator)
            runner = unittest.TextTestRunner(verbosity=2)
            result = runner.run(suite)

            self.results['unit_tests'] = result.wasSuccessful()

            if result.wasSuccessful():
                print(f"\n{Colors.GREEN}✓ All unit tests passed{Colors.NC}")
            else:
                print(f"\n{Colors.RED}✗ Some unit tests failed{Colors.NC}")

        except Exception as e:
            print(f"{Colors.RED}Error running unit tests: {e}{Colors.NC}")
            self.results['unit_tests'] = False

    def run_integration_tests(self):
        """Run integration tests for hooks"""
        print(f"\n{Colors.BLUE}{Colors.BOLD}2. Integration Tests - Hooks{Colors.NC}")
        print(f"{Colors.BLUE}{'─' * 70}{Colors.NC}\n")

        try:
            # Import test module
            import test_hooks_integration

            # Run tests
            loader = unittest.TestLoader()
            suite = loader.loadTestsFromModule(test_hooks_integration)
            runner = unittest.TextTestRunner(verbosity=2)
            result = runner.run(suite)

            self.results['integration_tests'] = result.wasSuccessful()

            if result.wasSuccessful():
                print(f"\n{Colors.GREEN}✓ All integration tests passed{Colors.NC}")
            else:
                print(f"\n{Colors.RED}✗ Some integration tests failed{Colors.NC}")

        except Exception as e:
            print(f"{Colors.RED}Error running integration tests: {e}{Colors.NC}")
            self.results['integration_tests'] = False

    def run_fixture_tests(self):
        """Run tests on fixture files"""
        print(f"\n{Colors.BLUE}{Colors.BOLD}3. Fixture Validation Tests{Colors.NC}")
        print(f"{Colors.BLUE}{'─' * 70}{Colors.NC}\n")

        fixtures_dir = self.test_dir / 'fixtures'
        if not fixtures_dir.exists():
            print(f"{Colors.YELLOW}No fixtures directory found, skipping{Colors.NC}")
            self.results['fixture_tests'] = True
            return

        passed = 0
        failed = 0

        # Test bad fixtures (should detect issues)
        print(f"{Colors.CYAN}Testing bad code fixtures (should fail validation):{Colors.NC}")
        bad_fixtures = list(fixtures_dir.glob('bad_*.py'))

        for fixture_file in bad_fixtures:
            with open(fixture_file, 'r') as f:
                code = f.read()

            result = analyze_code_logic(code, str(fixture_file))

            if result['is_buggy']:
                print(f"  {Colors.GREEN}✓{Colors.NC} {fixture_file.name}: Correctly detected issues")
                print(f"    Found: {result['logical_statement']}")
                passed += 1
            else:
                print(f"  {Colors.RED}✗{Colors.NC} {fixture_file.name}: Failed to detect issues")
                failed += 1

        # Test good fixtures (should pass validation)
        print(f"\n{Colors.CYAN}Testing good code fixtures (should pass validation):{Colors.NC}")
        good_fixtures = list(fixtures_dir.glob('good_*.py'))

        for fixture_file in good_fixtures:
            with open(fixture_file, 'r') as f:
                code = f.read()

            result = analyze_code_logic(code, str(fixture_file))

            if not result['is_buggy']:
                print(f"  {Colors.GREEN}✓{Colors.NC} {fixture_file.name}: Correctly validated")
                passed += 1
            else:
                print(f"  {Colors.RED}✗{Colors.NC} {fixture_file.name}: False positive")
                print(f"    Issues: {result['logical_statement']}")
                failed += 1

        print(f"\n{Colors.BOLD}Fixture Tests: {passed} passed, {failed} failed{Colors.NC}")

        self.results['fixture_tests'] = failed == 0

    def run_performance_tests(self):
        """Run performance benchmarks"""
        print(f"\n{Colors.BLUE}{Colors.BOLD}4. Performance Benchmarks{Colors.NC}")
        print(f"{Colors.BLUE}{'─' * 70}{Colors.NC}\n")

        # Test code samples of various sizes
        test_cases = [
            ("Small (10 lines)", "x = 1\n" * 10),
            ("Medium (100 lines)", "x = 1\n" * 100),
            ("Large (1000 lines)", "x = 1\n" * 1000),
        ]

        performance_ok = True

        for name, code in test_cases:
            start = time.time()
            result = analyze_code_logic(code)
            elapsed = (time.time() - start) * 1000  # ms

            # Performance threshold: should complete within reasonable time
            threshold = 1000  # 1 second
            status = Colors.GREEN if elapsed < threshold else Colors.RED

            print(f"  {name}: {status}{elapsed:.2f}ms{Colors.NC}")

            if elapsed >= threshold:
                performance_ok = False

        # Test with complex code
        complex_code = """
import logging
logger = logging.getLogger(__name__)

class ComplexClass:
    def __init__(self):
        self.metrics = {}

    def method1(self):
        try:
            operation1()
        except ValueError as e:
            logger.error(f"Error: {e}")
            return None

    def method2(self):
        try:
            operation2()
        except RuntimeError as e:
            if 'cuda' in str(e):
                raise
            logger.error(f"Error: {e}")

    def method3(self):
        try:
            operation3()
        except Exception:
            return []
""" * 5  # Repeat 5 times

        start = time.time()
        result = analyze_code_logic(complex_code)
        elapsed = (time.time() - start) * 1000

        threshold = 500  # 500ms
        status = Colors.GREEN if elapsed < threshold else Colors.RED

        print(f"  Complex code: {status}{elapsed:.2f}ms{Colors.NC}")

        if elapsed >= threshold:
            performance_ok = False

        self.results['performance_tests'] = performance_ok

        if performance_ok:
            print(f"\n{Colors.GREEN}✓ All performance benchmarks passed{Colors.NC}")
        else:
            print(f"\n{Colors.YELLOW}⚠ Some performance benchmarks exceeded threshold{Colors.NC}")

    def print_summary(self, elapsed: float):
        """Print overall test summary"""
        print(f"\n{Colors.BOLD}{'=' * 70}{Colors.NC}")
        print(f"{Colors.BOLD}Test Summary{Colors.NC}")
        print(f"{Colors.BOLD}{'=' * 70}{Colors.NC}\n")

        # Print results for each suite
        suites = [
            ('Unit Tests', self.results['unit_tests']),
            ('Integration Tests', self.results['integration_tests']),
            ('Fixture Tests', self.results['fixture_tests']),
            ('Performance Tests', self.results['performance_tests'])
        ]

        for name, result in suites:
            status = f"{Colors.GREEN}✓ PASSED{Colors.NC}" if result else f"{Colors.RED}✗ FAILED{Colors.NC}"
            print(f"  {name:.<40} {status}")

        # Overall result
        all_passed = all(r for _, r in suites)

        print(f"\n{Colors.BOLD}Total time: {elapsed:.2f}s{Colors.NC}")

        if all_passed:
            print(f"\n{Colors.GREEN}{Colors.BOLD}{'=' * 70}")
            print(f"ALL TESTS PASSED ✓")
            print(f"{'=' * 70}{Colors.NC}\n")
        else:
            print(f"\n{Colors.RED}{Colors.BOLD}{'=' * 70}")
            print(f"SOME TESTS FAILED ✗")
            print(f"{'=' * 70}{Colors.NC}\n")


def main():
    """Main entry point"""
    runner = TestRunner()
    success = runner.run_all()
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()
