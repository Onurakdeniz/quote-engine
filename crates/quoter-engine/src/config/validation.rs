pub(crate) fn require_non_empty(label: &str, value: &str) -> Result<(), String> {
    if value.trim().is_empty() {
        Err(format!("{label} cannot be empty"))
    } else {
        Ok(())
    }
}

pub(crate) fn reject_control_chars(label: &str, value: &str) -> Result<(), String> {
    if value.chars().any(char::is_control) {
        Err(format!("{label} cannot contain control characters"))
    } else {
        Ok(())
    }
}

pub(crate) fn require_finite_non_negative(label: &str, value: f64) -> Result<(), String> {
    if !value.is_finite() {
        return Err(format!("{label} must be finite"));
    }

    if value < 0.0 {
        return Err(format!("{label} cannot be negative"));
    }

    Ok(())
}
