"""
Test fixture: Bad code with silent failure pattern
This should be detected and blocked by the validator
"""


def search_concepts(concept_name):
    """Search for concepts - BAD: Silent failure"""
    try:
        results = search_engine.search(concept_name)
        return results
    except Exception as e:
        # Silent failure - no logging!
        return []


def fetch_data(query):
    """Fetch data - BAD: Returns None silently"""
    try:
        data = api.fetch(query)
        return data
    except Exception:
        # No logging at all
        return None


class SearchService:
    """Service with silent failures"""

    def search(self, term):
        """BAD: Catches everything and returns empty"""
        try:
            return self._do_search(term)
        except:  # Bare except is even worse!
            return []
