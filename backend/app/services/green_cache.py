"""
Green Computing & Computation-Aware Caching Service for Flood Risk ML Pipeline.
Provides deterministic caching, TTL invalidation, thread-safe statistics,
and latency profiling to eliminate redundant model inference executions.
"""

import time
import hashlib
import json
import threading
from typing import Dict, Any, Optional, List, Tuple
from collections import deque


class GreenInferenceCache:
    """
    Thread-safe computation-aware cache for Machine Learning inference.
    Prevents duplicate XGBoost tree evaluations for identical, still-fresh hydrological inputs.
    """

    def __init__(self, default_ttl_seconds: int = 600, max_entries: int = 256):
        self.default_ttl = default_ttl_seconds
        self.max_entries = max_entries
        self._lock = threading.Lock()

        # Cache storage: cache_key -> entry_dict
        self._store: Dict[str, Dict[str, Any]] = {}

        # Counters
        self._total_requests: int = 0
        self._cache_hits: int = 0
        self._cache_misses: int = 0
        self._pipeline_runs_executed: int = 0
        self._pipeline_runs_avoided: int = 0
        self._model_inferences_executed: int = 0
        self._model_inferences_avoided: int = 0

        # Latency histories (in milliseconds, rolling max 100 samples)
        self._cached_latencies: deque = deque(maxlen=100)
        self._uncached_latencies: deque = deque(maxlen=100)

        # Preprocessing & Model Version Identifiers
        self.preprocessing_version = "v1.2.0-coimbatore"
        self.model_version = "xgb-calibrated-v1.0"

    def generate_key(
        self,
        request_type: str,
        params: Dict[str, Any],
        time_bucket: Optional[str] = None
    ) -> str:
        """
        Generates a deterministic SHA-256 cache key from normalized parameters.
        Includes model version, preprocessing version, request type, parameters, and time window.
        """
        # Normalize numeric parameters to 4 decimal places to ensure consistent representation
        # without removing meaningful input differences.
        norm_params = {}
        for k in sorted(params.keys()):
            val = params[k]
            if isinstance(val, (int, float)) and not isinstance(val, bool):
                norm_params[k] = round(float(val), 4)
            elif isinstance(val, (str, bool)):
                norm_params[k] = val
            elif val is None:
                norm_params[k] = None
            else:
                norm_params[k] = str(val)

        payload = {
            "type": request_type,
            "prep_ver": self.preprocessing_version,
            "model_ver": self.model_version,
            "time_bucket": time_bucket or "dynamic",
            "params": norm_params
        }
        encoded = json.dumps(payload, sort_keys=True).encode("utf-8")
        return hashlib.sha256(encoded).hexdigest()

    def get(self, key: str) -> Optional[Tuple[Dict[str, Any], float]]:
        """
        Retrieves a cached prediction result if present and fresh.
        Returns (cached_result_copy, lookup_latency_ms) or None on miss/expiry.
        """
        t0 = time.perf_counter()
        with self._lock:
            self._total_requests += 1

            entry = self._store.get(key)
            if entry is None:
                self._cache_misses += 1
                return None

            now = time.time()
            if now > entry["expires_at"]:
                # Expired - remove from cache
                del self._store[key]
                self._cache_misses += 1
                return None

            # Valid cache hit!
            entry["hit_count"] += 1
            entry["last_accessed_at"] = now
            self._cache_hits += 1
            self._pipeline_runs_avoided += 1

            inferences_avoided = entry.get("model_inferences_count", 1)
            self._model_inferences_avoided += inferences_avoided

            latency_ms = round((time.perf_counter() - t0) * 1000, 3)
            self._cached_latencies.append(latency_ms)

            # Deep copy or return payload dictionary
            result_copy = json.loads(json.dumps(entry["data"]))
            return result_copy, latency_ms

    def set(
        self,
        key: str,
        data: Dict[str, Any],
        model_inferences_count: int = 100,
        ttl_seconds: Optional[int] = None,
        uncached_latency_ms: float = 0.0
    ):
        """
        Stores a successful, validated prediction result in cache.
        """
        if not data or not isinstance(data, dict):
            return  # Do not cache invalid/empty data

        ttl = ttl_seconds if ttl_seconds is not None else self.default_ttl
        now = time.time()

        with self._lock:
            # Manage capacity with simple LRU eviction if needed
            if len(self._store) >= self.max_entries and key not in self._store:
                oldest_key = min(self._store.keys(), key=lambda k: self._store[k]["last_accessed_at"])
                del self._store[oldest_key]

            self._store[key] = {
                "key": key,
                "data": json.loads(json.dumps(data)),  # Clean copy
                "created_at": now,
                "expires_at": now + ttl,
                "last_accessed_at": now,
                "hit_count": 0,
                "model_inferences_count": model_inferences_count,
                "computation_latency_ms": uncached_latency_ms
            }

    def record_execution(self, inferences_count: int, latency_ms: float):
        """
        Records an actual model execution after a cache miss.
        """
        with self._lock:
            self._pipeline_runs_executed += 1
            self._model_inferences_executed += inferences_count
            self._uncached_latencies.append(round(latency_ms, 3))

    def invalidate_all(self):
        """Clears all cached entries while keeping statistics counters."""
        with self._lock:
            self._store.clear()

    def reset_statistics(self):
        """Resets all metrics and clears cache for a clean demonstration session."""
        with self._lock:
            self._store.clear()
            self._total_requests = 0
            self._cache_hits = 0
            self._cache_misses = 0
            self._pipeline_runs_executed = 0
            self._pipeline_runs_avoided = 0
            self._model_inferences_executed = 0
            self._model_inferences_avoided = 0
            self._cached_latencies.clear()
            self._uncached_latencies.clear()

    def get_statistics(self) -> Dict[str, Any]:
        """
        Returns full live efficiency statistics, hit rates, and measured latency comparisons.
        """
        with self._lock:
            total_req = self._total_requests
            hits = self._cache_hits
            misses = self._cache_misses

            # Consistent denominator: total eligible prediction requests
            hit_rate_pct = round((hits / total_req * 100), 2) if total_req > 0 else 0.0

            cached_list = list(self._cached_latencies)
            uncached_list = list(self._uncached_latencies)

            def _stats(arr: List[float]):
                if not arr:
                    return {"count": 0, "mean_ms": 0.0, "median_ms": 0.0, "min_ms": 0.0, "max_ms": 0.0}
                s_arr = sorted(arr)
                n = len(s_arr)
                median = s_arr[n // 2] if n % 2 != 0 else (s_arr[n // 2 - 1] + s_arr[n // 2]) / 2.0
                return {
                    "count": n,
                    "mean_ms": round(sum(s_arr) / n, 2),
                    "median_ms": round(median, 2),
                    "min_ms": round(min(s_arr), 2),
                    "max_ms": round(max(s_arr), 2)
                }

            cached_metrics = _stats(cached_list)
            uncached_metrics = _stats(uncached_list)

            # Measured latency reduction (%)
            time_saved_pct = 0.0
            if uncached_metrics["median_ms"] > 0 and cached_metrics["median_ms"] > 0:
                time_saved_pct = round(
                    ((uncached_metrics["median_ms"] - cached_metrics["median_ms"]) / uncached_metrics["median_ms"]) * 100,
                    1
                )

            active_entries_count = len(self._store)

            # Summarize active entries
            now = time.time()
            entries_summary = []
            for k, v in list(self._store.items())[:10]:
                entries_summary.append({
                    "key_prefix": k[:12] + "...",
                    "hits": v["hit_count"],
                    "ttl_remaining_s": max(0, int(v["expires_at"] - now)),
                    "inferences_per_hit": v["model_inferences_count"],
                    "original_calc_time_ms": v["computation_latency_ms"]
                })

            return {
                "system_status": "operational",
                "scope": "Process-local thread-safe in-memory cache",
                "optimization_target": "XGBoost 100-ward model tree evaluation & feature assembly",
                "request_statistics": {
                    "total_prediction_requests": total_req,
                    "successful_cache_hits": hits,
                    "cache_misses": misses,
                    "cache_hit_rate_pct": hit_rate_pct,
                    "pipeline_runs_executed": self._pipeline_runs_executed,
                    "pipeline_runs_avoided": self._pipeline_runs_avoided
                },
                "inference_statistics": {
                    "model_inferences_executed": self._model_inferences_executed,
                    "model_inferences_avoided": self._model_inferences_avoided,
                    "inferences_per_citywide_run": 100,
                    "explanation": (
                        "The inference counter tracks individual ward model probability evaluations. "
                        "A citywide run evaluates all 100 Coimbatore wards (100 inferences per execution). "
                        "When cached, all 100 evaluations are safely bypassed."
                    )
                },
                "performance_comparison": {
                    "measurement_method": "High-precision timer (time.perf_counter) measuring backend model pipeline execution",
                    "sample_counts": {
                        "cached_samples": cached_metrics["count"],
                        "uncached_samples": uncached_metrics["count"]
                    },
                    "cached_latency": cached_metrics,
                    "uncached_latency": uncached_metrics,
                    "measured_latency_reduction_pct": max(0.0, time_saved_pct),
                    "efficiency_factor": round(uncached_metrics["median_ms"] / max(0.01, cached_metrics["median_ms"]), 1) if cached_metrics["median_ms"] > 0 else 1.0
                },
                "cache_inventory": {
                    "active_cached_entries": active_entries_count,
                    "max_cache_capacity": self.max_entries,
                    "default_ttl_seconds": self.default_ttl,
                    "recent_entries": entries_summary
                },
                "environmental_attribution": {
                    "measured_metric": "Software execution time and avoided CPU inference cycles",
                    "academic_distinction": (
                        "Execution time reduction is directly measured via process timers. "
                        "Avoided CPU cycles represent reduced server processor workload. "
                        "Physical electrical power (Joules) and carbon emissions (gCO2e) are expected proportional benefits "
                        "rather than directly measured physical instrument values."
                    )
                }
            }


# Global singleton cache instance for the backend process
green_cache = GreenInferenceCache(default_ttl_seconds=600, max_entries=256)
