"""
Automated Test Suite for Green Computing & Computation-Aware Caching Pipeline.
Covers Test A through Test J as required by the specification.
"""

import sys
import os
import time
import unittest

# Ensure project root is in python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.app.services.green_cache import GreenInferenceCache, green_cache
from backend.app.services.weather_service import WeatherInferenceService
from backend.app.routers.inference import manual_predict, ManualPredictRequest
from backend.app.data.coimbatore_wards import get_all_coimbatore_wards


class TestGreenComputingPipeline(unittest.TestCase):
    """
    Validation of computation-aware caching, deterministic key generation,
    freshness checks, model version invalidation, and statistical accounting.
    """

    def setUp(self):
        # Reset global singleton before each test
        green_cache.reset_statistics()
        self.svc = WeatherInferenceService()

    def test_a_first_request(self):
        """Test A — First request: runs normal prediction pipeline, executes model, returns expected payload."""
        res = self.svc.predict_ward_risks(override_rain_24h=72.0, override_api_7d=88.0)
        self.assertIn("green_computing", res)
        gc = res["green_computing"]
        self.assertFalse(gc["cached"], "First request should be uncached (cold path)")
        self.assertFalse(gc["inference_skipped"])
        self.assertEqual(gc["inferences_executed"], 100, "Should evaluate all 100 Coimbatore wards")
        self.assertEqual(len(res["all_wards"]), 100)
        self.assertIn("tier_distribution", res)

    def test_b_identical_request(self):
        """Test B — Identical request: reuses cached result, skips 100 model inferences."""
        # Call 1 (Cold)
        res1 = self.svc.predict_ward_risks(override_rain_24h=64.0, override_api_7d=90.0)
        self.assertFalse(res1["green_computing"]["cached"])

        # Call 2 (Warm / Identical)
        res2 = self.svc.predict_ward_risks(override_rain_24h=64.0, override_api_7d=90.0)
        self.assertTrue(res2["green_computing"]["cached"], "Identical inputs must hit cache")
        self.assertTrue(res2["green_computing"]["inference_skipped"])
        self.assertEqual(res2["green_computing"]["inferences_avoided"], 100)

        # Check request stats
        stats = green_cache.get_statistics()["request_statistics"]
        self.assertEqual(stats["total_prediction_requests"], 2)
        self.assertEqual(stats["successful_cache_hits"], 1)
        self.assertEqual(stats["cache_misses"], 1)
        self.assertEqual(stats["cache_hit_rate_pct"], 50.0)

    def test_c_changed_inputs(self):
        """Test C — Changed inputs: modified rainfall parameter results in cache miss and fresh prediction."""
        _ = self.svc.predict_ward_risks(override_rain_24h=50.0, override_api_7d=80.0)
        
        # Change rainfall by 15mm
        res_changed = self.svc.predict_ward_risks(override_rain_24h=65.0, override_api_7d=80.0)
        self.assertFalse(res_changed["green_computing"]["cached"], "Different input must not hit cache")
        self.assertFalse(res_changed["green_computing"]["inference_skipped"])
        self.assertEqual(res_changed["green_computing"]["inferences_executed"], 100)

    def test_d_data_freshness_time_bucket(self):
        """Test D — Data freshness: different observation time buckets prevent inappropriate reuse."""
        cache = GreenInferenceCache(default_ttl_seconds=600)
        params = {"rain_24h": 45.0, "api_7d": 60.0}

        key_hour_1 = cache.generate_key("citywide_100wards", params, time_bucket="2026-10-19T10")
        key_hour_2 = cache.generate_key("citywide_100wards", params, time_bucket="2026-10-19T11")

        self.assertNotEqual(key_hour_1, key_hour_2, "Keys must differ when observation hour advances")

        cache.set(key_hour_1, {"result": "data_hour_10"}, model_inferences_count=100)
        self.assertIsNotNone(cache.get(key_hour_1))
        self.assertIsNone(cache.get(key_hour_2), "Fresh hour bucket must result in cache miss")

    def test_e_model_and_preprocessing_version_invalidation(self):
        """Test E — Model or preprocessing version: changing version invalidates cache keys."""
        cache = GreenInferenceCache()
        params = {"rain_24h": 70.0, "api_7d": 85.0}

        key_v1 = cache.generate_key("citywide_100wards", params)
        cache.set(key_v1, {"model_output": "v1_probs"})

        # Simulate model retraining / version upgrade
        cache.model_version = "xgb-calibrated-v2.0"
        key_v2 = cache.generate_key("citywide_100wards", params)

        self.assertNotEqual(key_v1, key_v2, "Model version bump must produce distinct cache key")
        self.assertIsNone(cache.get(key_v2), "Incompatible model version entry must not be retrieved")

    def test_f_expiration_ttl(self):
        """Test F — Expiration: expired entries cannot be reused and are evicted."""
        cache = GreenInferenceCache(default_ttl_seconds=1)
        params = {"test": 123}
        key = cache.generate_key("test_type", params)

        # Store with very short 50ms TTL
        cache.set(key, {"cached": "value"}, ttl_seconds=0.05)
        
        # Verify present immediately
        hit = cache.get(key)
        self.assertIsNotNone(hit)

        # Sleep past expiration
        time.sleep(0.08)

        miss = cache.get(key)
        self.assertIsNone(miss, "Expired entry must return None on lookup")

    def test_g_output_correctness_and_determinism(self):
        """Test G — Output correctness: cached and uncached outputs match deterministically across all 100 wards."""
        r_uncached = self.svc.predict_ward_risks(override_rain_24h=85.0, override_api_7d=110.0, use_cache=True)
        r_cached = self.svc.predict_ward_risks(override_rain_24h=85.0, override_api_7d=110.0, use_cache=True)

        self.assertTrue(r_cached["green_computing"]["cached"])
        self.assertEqual(len(r_uncached["all_wards"]), len(r_cached["all_wards"]))

        for w_un, w_ca in zip(r_uncached["all_wards"], r_cached["all_wards"]):
            self.assertEqual(w_un["ward_id"], w_ca["ward_id"])
            self.assertEqual(w_un["calibrated_probability"], w_ca["calibrated_probability"])
            self.assertEqual(w_un["risk_tier"], w_ca["risk_tier"])

        self.assertEqual(r_uncached["tier_distribution"], r_cached["tier_distribution"])
        self.assertEqual(r_uncached["max_probability"], r_cached["max_probability"])

    def test_h_failure_handling_and_no_invalid_caching(self):
        """Test H — Failure handling: invalid inputs or empty predictions are not cached."""
        cache = GreenInferenceCache()
        key = cache.generate_key("invalid_test", {"param": "err"})

        # Attempt to set None and empty dict
        cache.set(key, None)
        self.assertIsNone(cache.get(key))

        cache.set(key, {})
        self.assertIsNone(cache.get(key))

    def test_i_dashboard_statistics(self):
        """Test I — Dashboard statistics: verify request counts, hits, misses, inference counts, and hit rate."""
        # 1 cold + 3 warm requests
        self.svc.predict_ward_risks(override_rain_24h=77.0, override_api_7d=100.0)
        self.svc.predict_ward_risks(override_rain_24h=77.0, override_api_7d=100.0)
        self.svc.predict_ward_risks(override_rain_24h=77.0, override_api_7d=100.0)
        self.svc.predict_ward_risks(override_rain_24h=77.0, override_api_7d=100.0)

        stats = green_cache.get_statistics()
        reqs = stats["request_statistics"]
        infers = stats["inference_statistics"]

        self.assertEqual(reqs["total_prediction_requests"], 4)
        self.assertEqual(reqs["successful_cache_hits"], 3)
        self.assertEqual(reqs["cache_misses"], 1)
        self.assertEqual(reqs["cache_hit_rate_pct"], 75.0)

        self.assertEqual(infers["model_inferences_executed"], 100)
        self.assertEqual(infers["model_inferences_avoided"], 300)

    def test_j_existing_functionality_preserved(self):
        """Test J — Existing functionality: wards geofences, risk tiers, and manual predict work normally."""
        wards = get_all_coimbatore_wards()
        self.assertEqual(len(wards), 100, "All 100 wards must remain present")

        # Test single manual prediction
        req = ManualPredictRequest(rain_1d_mm=55.0, api_mm=45.0, ward_id="WARD_010")
        res_m = manual_predict(req)
        self.assertIn("calibrated_xgboost", res_m)
        self.assertIn("probability", res_m["calibrated_xgboost"])
        self.assertIn("tier", res_m["calibrated_xgboost"])


if __name__ == "__main__":
    unittest.main()
