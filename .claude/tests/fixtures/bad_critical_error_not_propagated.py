"""
Test fixture: Bad code that swallows critical errors
GPU/OOM/CUDA errors should be propagated but aren't
"""

import logging

logger = logging.getLogger(__name__)


def run_model(data):
    """BAD: Swallows GPU errors"""
    try:
        model.forward(data)
        return True
    except Exception as e:
        if 'cuda' in str(e).lower():
            logger.error("GPU error occurred")
            return False  # Should propagate!
        return False


def load_large_model():
    """BAD: Swallows OOM errors"""
    try:
        model = load_model()
        return model
    except RuntimeError as e:
        if 'out of memory' in str(e).lower():
            logger.error("OOM error")
            return None  # Should propagate!
        raise


class ModelRunner:
    """BAD: Catches critical errors without propagating"""

    def run(self, input_data):
        try:
            return self.model(input_data)
        except Exception as e:
            error_msg = str(e).lower()
            if 'cuda' in error_msg or 'gpu' in error_msg:
                logger.error(f"Critical GPU error: {e}")
                # Should raise here!
                return None
