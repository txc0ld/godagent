"""
Test fixture: Good code with proper error handling
This should pass validation
"""

import logging

logger = logging.getLogger(__name__)


class SearchService:
    """Service with proper error handling"""

    def __init__(self):
        self.metrics = {
            'search_failures': 0,
            'invalid_queries': 0,
            'gpu_failures': 0
        }

    def search_concepts(self, concept_name):
        """GOOD: Specific exceptions with logging"""
        try:
            results = self.search_engine.search(concept_name)
            return results
        except ValueError as e:
            logger.warning(f"Invalid concept name '{concept_name}': {e}")
            self.metrics['invalid_queries'] += 1
            return []
        except RuntimeError as e:
            logger.error(f"Search engine error for '{concept_name}': {e}")
            self.metrics['search_failures'] += 1
            return []

    def fetch_data(self, query):
        """GOOD: Logs errors and tracks metrics"""
        try:
            data = self.api.fetch(query)
            return data
        except ConnectionError as e:
            logger.error(f"Connection failed: {e}")
            self.metrics['search_failures'] += 1
            return None
        except TimeoutError as e:
            logger.warning(f"Request timed out after 30s: {e}")
            return None


def run_model(data):
    """GOOD: Propagates critical errors"""
    try:
        result = model.forward(data)
        return result
    except RuntimeError as e:
        if 'cuda' in str(e).lower():
            logger.error(f"FATAL GPU error: {e}")
            raise  # Propagate critical errors!
        logger.error(f"Model runtime error: {e}")
        return None
    except ValueError as e:
        logger.warning(f"Invalid input data: {e}")
        return None


class RobustProcessor:
    """GOOD: Comprehensive error handling with metrics"""

    def __init__(self):
        self.metrics = {
            'processed': 0,
            'failed': 0,
            'gpu_errors': 0
        }

    def process(self, item):
        """Process item with proper error handling"""
        try:
            result = self._process_internal(item)
            self.metrics['processed'] += 1
            return result

        except ValueError as e:
            logger.warning(f"Invalid item format: {e}")
            self.metrics['failed'] += 1
            return None

        except RuntimeError as e:
            if 'cuda' in str(e).lower() or 'gpu' in str(e).lower():
                logger.critical(f"GPU failure: {e}")
                self.metrics['gpu_errors'] += 1
                raise  # Must propagate GPU errors

            logger.error(f"Processing failed: {e}")
            self.metrics['failed'] += 1
            return None

        except Exception as e:
            # Last resort: log and re-raise unknown errors
            logger.error(f"Unexpected error processing item: {e}")
            raise
