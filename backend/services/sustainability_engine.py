def calculate_sustainability(
    empty_km_avoided: float,
    reroute_km_saved: float,
    baseline_emissions: float
) -> dict:
    """
    Calculates carbon blueprint reduction metrics.
    0.9 represents the kg/km emission factor.
    """
    co2_saved_kg = (empty_km_avoided + reroute_km_saved) * 0.9
    
    if baseline_emissions > 0:
        co2_reduced_percent = (co2_saved_kg / baseline_emissions) * 100
    else:
        co2_reduced_percent = 0.0
        
    return {
        "co2_saved_kg": round(co2_saved_kg, 2),
        "co2_reduced_percent": round(co2_reduced_percent, 1)
    }
