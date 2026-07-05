def security_input_validation(node_input: str) -> str:
    """Validate incoming user queries for prompt injection, sensitive info, or malicious content."""
    query = str(node_input).lower()

    # Simple check for injection patterns or system overrides
    injections = [
        "ignore previous instructions",
        "ignore the instructions above",
        "override prompt",
        "system settings",
        "system prompt",
    ]
    for pattern in injections:
        if pattern in query:
            raise ValueError(
                f"Security validation failed: Request contains prohibited instructions ({pattern})."
            )

    return node_input


def security_output_validation(node_input: str) -> str:
    """Validate outgoing agent response for safety, leakage, or sensitive information."""
    response = str(node_input)

    # Redact potential sensitive tokens or keys
    sensitive_patterns = ["api_key", "password", "secret", "private_key", "credentials"]
    response_lower = response.lower()

    for pattern in sensitive_patterns:
        if pattern in response_lower and (
            "key-" in response_lower or "=" in response_lower or ":" in response_lower
        ):
            return "[Security Redaction] Response blocked/redacted due to potential credential leak."

    return node_input
