def calculate_cost_savings(
    km_saved: float,
    sla_penalty_avoided: float,
    idle_hours_saved: float
) -> float:
    """
    Calculates operational cost optimized via reroutes & resolved incidents.
    Factors:
    - km_saved * ₹18/km
    - sla_penalty_avoided * ₹500/penalty
    - idle_hours_saved * ₹300/hr
    """
    cost_saved = (km_saved * 18) + (sla_penalty_avoided * 500) + (idle_hours_saved * 300)
    return round(cost_saved, 2)
