"""Provider adapters — each translates between our internal RouteRequest
and a specific provider's SDK call.

All adapters return a `ProviderResponse` and raise `ProviderError` on
recoverable failures. The router decides whether to retry or fall back.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class ProviderResponse:
    content: str
    input_tokens: int
    output_tokens: int
    finish_reason: str
    raw: dict | None = None


class ProviderError(Exception):
    """Raised when a provider call fails recoverably (rate-limit, transient)."""

    def __init__(self, message: str, *, retryable: bool = True, status: int | None = None):
        super().__init__(message)
        self.retryable = retryable
        self.status = status


class FatalProviderError(ProviderError):
    """Non-recoverable — bad API key, malformed request, content policy block."""

    def __init__(self, message: str, status: int | None = None):
        super().__init__(message, retryable=False, status=status)
