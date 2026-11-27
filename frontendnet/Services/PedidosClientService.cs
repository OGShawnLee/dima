using frontendnet.Models;

namespace frontendnet.Services;

/// <summary>
/// Orders API (<c>/api/pedidos</c>, DEC-015). Registered with the authenticated handler chain, so any
/// non-2xx surfaces as <see cref="HttpRequestException"/> with <c>StatusCode</c>.
/// </summary>
public class PedidosClientService(HttpClient client)
{
    protected HttpClient Client { get; } = client;

    /// <summary><c>POST api/pedidos</c> (Usuario). Sends only product ids and quantities; the backend prices the order.</summary>
    public async Task<Pedido> CrearAsync(IEnumerable<CarritoItem> items)
    {
        var body = new PedidoRequest([.. items.Select(i => new PedidoItemRequest(i.ProductoId, i.Cantidad))]);
        using var response = await Client.PostAsJsonAsync("api/pedidos", body);
        return await response.Content.ReadFromJsonAsync<Pedido>()
            ?? throw new InvalidOperationException("Respuesta de pedido vacía.");
    }

    /// <summary><c>GET api/pedidos/mios</c> (Usuario).</summary>
    public async Task<List<Pedido>> GetMiosAsync() =>
        await Client.GetFromJsonAsync<List<Pedido>>("api/pedidos/mios") ?? [];

    /// <summary><c>GET api/pedidos</c> (Administrador).</summary>
    public async Task<List<Pedido>> GetAsync() =>
        await Client.GetFromJsonAsync<List<Pedido>>("api/pedidos") ?? [];

    /// <summary><c>GET api/pedidos/{id}</c> (owner or Administrador; non-owner Usuario gets 404).</summary>
    public async Task<PedidoDetalle?> GetAsync(int id) =>
        await Client.GetFromJsonAsync<PedidoDetalle>($"api/pedidos/{id}");
}
