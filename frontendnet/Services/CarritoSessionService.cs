using System.Text.Json;
using frontendnet.Models;

namespace frontendnet.Services;

/// <summary>Outcome of a cart mutation.</summary>
public enum CarritoResultado
{
    Ok,
    /// <summary>The cart already holds <see cref="CarritoSessionService.MaximoElementos"/> distinct products.</summary>
    LimiteElementos,
    /// <summary>The merged quantity of a line would exceed <see cref="CarritoItem.CantidadMaxima"/>.</summary>
    LimiteCantidad,
    /// <summary>The product is not in the cart.</summary>
    NoEncontrado,
}

/// <summary>
/// Server-side session cart (FDEC-004). The session stores only
/// <c>[{ productoId, cantidad }]</c> as JSON under <see cref="ClaveCarrito"/>; the browser cookie
/// carries only the opaque session id. Every mutation keeps the layout badge key
/// <see cref="ClaveCantidad"/> in sync with the <b>total number of units</b> in the cart.
/// Plain class (not DI-registered): controllers create it with <c>new CarritoSessionService(HttpContext.Session)</c>.
/// Limits mirror the backend <c>CreatePedidoRequestSchema</c> (1..50 items, quantity 1..99).
/// </summary>
public class CarritoSessionService(ISession session)
{
    public const string ClaveCarrito = "Carrito";
    public const string ClaveCantidad = "CarritoCantidad";
    public const int MaximoElementos = 50;

    /// <summary>Loads the session from the store asynchronously (avoids a synchronous load on first access).</summary>
    public Task CargaAsync() => session.LoadAsync();

    /// <summary>
    /// Current lines. Malformed or out-of-range data is discarded defensively (duplicates merged,
    /// quantities and the item count capped to the backend limits).
    /// </summary>
    public List<CarritoItem> Obtener()
    {
        string? json = session.GetString(ClaveCarrito);
        if (string.IsNullOrEmpty(json)) return [];

        List<CarritoItem>? items;
        try
        {
            items = JsonSerializer.Deserialize<List<CarritoItem>>(json);
        }
        catch (JsonException)
        {
            items = null;
        }

        return (items ?? [])
            .Where(i => i is not null && i.ProductoId > 0 && i.Cantidad >= CarritoItem.CantidadMinima)
            .GroupBy(i => i.ProductoId)
            .Select(g => new CarritoItem
            {
                ProductoId = g.Key,
                Cantidad = Math.Min(CarritoItem.CantidadMaxima, g.Sum(i => i.Cantidad)),
            })
            .Take(MaximoElementos)
            .ToList();
    }

    /// <summary>Adds <paramref name="cantidad"/> units, merging with an existing line.</summary>
    public CarritoResultado Agregar(int productoId, int cantidad)
    {
        var items = Obtener();
        var existente = items.FirstOrDefault(i => i.ProductoId == productoId);
        if (existente is null)
        {
            if (items.Count >= MaximoElementos) return CarritoResultado.LimiteElementos;
            items.Add(new CarritoItem { ProductoId = productoId, Cantidad = cantidad });
        }
        else
        {
            if (existente.Cantidad + cantidad > CarritoItem.CantidadMaxima) return CarritoResultado.LimiteCantidad;
            existente.Cantidad += cantidad;
        }

        Guardar(items);
        return CarritoResultado.Ok;
    }

    /// <summary>Replaces the quantity of an existing line.</summary>
    public CarritoResultado Actualizar(int productoId, int cantidad)
    {
        var items = Obtener();
        var existente = items.FirstOrDefault(i => i.ProductoId == productoId);
        if (existente is null) return CarritoResultado.NoEncontrado;
        existente.Cantidad = cantidad;
        Guardar(items);
        return CarritoResultado.Ok;
    }

    /// <summary>Removes the given products (e.g. one line, or products the backend no longer has).</summary>
    public CarritoResultado Quitar(params int[] productoIds)
    {
        var items = Obtener();
        int quitados = items.RemoveAll(i => productoIds.Contains(i.ProductoId));
        Guardar(items);
        return quitados > 0 ? CarritoResultado.Ok : CarritoResultado.NoEncontrado;
    }

    /// <summary>Empties the cart.</summary>
    public void Vaciar()
    {
        session.Remove(ClaveCarrito);
        session.SetInt32(ClaveCantidad, 0);
    }

    /// <summary>Re-synchronizes the badge with the stored lines (e.g. after defensive cleanup).</summary>
    public void Sincronizar() => Guardar(Obtener());

    private void Guardar(List<CarritoItem> items)
    {
        if (items.Count == 0)
        {
            Vaciar();
            return;
        }

        session.SetString(ClaveCarrito, JsonSerializer.Serialize(items));
        session.SetInt32(ClaveCantidad, items.Sum(i => i.Cantidad));
    }
}
