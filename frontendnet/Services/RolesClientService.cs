namespace frontendnet.Services;

/// <summary>Typed client stub registered in Program.cs; implemented by its own ticket.</summary>
public class RolesClientService(HttpClient client)
{
    protected HttpClient Client { get; } = client;
}
