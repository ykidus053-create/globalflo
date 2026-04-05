"""Compatibility package for hosts that start from the `globalflow/` directory.

If the working directory is already `globalflow/`, imports like `globalflow.main`
look for a nested package named `globalflow`. This shim provides that package.
"""

