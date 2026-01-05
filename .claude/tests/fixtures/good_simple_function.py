"""
Test fixture: Simple good code without error handling
Should pass validation (no issues to detect)
"""


def add(a, b):
    """Simple addition function"""
    return a + b


def multiply(x, y):
    """Simple multiplication"""
    return x * y


class Calculator:
    """Simple calculator class"""

    def __init__(self):
        self.result = 0

    def add(self, value):
        """Add to result"""
        self.result += value
        return self.result

    def reset(self):
        """Reset calculator"""
        self.result = 0


def process_list(items):
    """Process a list of items"""
    return [item * 2 for item in items]
