namespace frontendnet.Services;

/// <summary>Typed client stub registered in Program.cs; implemented by its own ticket.</summary>
public class BitacoraClientService(HttpClient client)
{
    protected HttpClient Client { get; } = client;
}
