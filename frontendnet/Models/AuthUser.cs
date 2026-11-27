namespace frontendnet.Models;

/// <summary>
/// Login response returned by <c>POST /api/auth</c> (backend <c>LoginResponse</c>).
/// </summary>
public class AuthUser
{
    public required string Email { get; set; }
    public required string Nombre { get; set; }
    public required string Rol { get; set; }
    public required string Jwt { get; set; }
}
