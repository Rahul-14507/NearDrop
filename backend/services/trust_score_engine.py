def calculate_trust_score(
    driver_id: str,
    on_time_completion: float,
    recovery_success: float,
    sla_adherence: float,
    delivery_confirmation: float,
    heartbeat_reliability: float,
    historical_score: float = None
) -> dict:
    """
    Computes a driver trust score based on weighted performance metrics.
    All inputs should be normalized out of 100.
    """
    today_score = (
        (0.35 * on_time_completion) +
        (0.25 * recovery_success) +
        (0.20 * sla_adherence) +
        (0.10 * delivery_confirmation) +
        (0.10 * heartbeat_reliability)
    )
    
    if historical_score is not None:
        # Blend 70% historical reputation with 30% today's telemetry
        score = (0.70 * historical_score) + (0.30 * today_score)
    else:
        score = today_score
        
    score_int = min(100, max(0, int(round(score))))
    
    if score_int >= 90:
        band = "Elite"
    elif score_int >= 80:
        band = "Reliable"
    elif score_int >= 70:
        band = "Needs Attention"
    else:
        band = "High Risk"
        
    return {
        "driver_id": driver_id,
        "trust_score": score_int,
        "band": band
    }
