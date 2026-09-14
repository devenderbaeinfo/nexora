namespace Nexora.Api.Contracts;

public record LoginRequest(string Email, string Password);
public record LoginResponse(string AccessToken, DateTimeOffset ExpiresAtUtc, string DisplayName, string Role, string[] Permissions, bool MustChangePassword, string BaseCurrencyCode);
public record ChangePasswordRequest(string CurrentPassword, string NewPassword);
