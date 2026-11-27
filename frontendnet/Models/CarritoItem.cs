using System.Text.Json.Serialization;

namespace frontendnet.Models;

/// <summary>
/// One cart line as stored in the server-side session (FDEC-004). Only the product id and the
/// quantity are kept: prices and titles are always re-read from the backend when rendering, and
/// the shape matches the future <c>POST api/pedidos</c> item (<c>{ productoId, cantidad }</c>).
/// </summary>
public class CarritoItem
{
    public const int CantidadMinima = 1;
    public const int CantidadMaxima = 99;

    [JsonPropertyName("productoId")]
    public int ProductoId { get; set; }

    [JsonPropertyName("cantidad")]
    public int Cantidad { get; set; }
}
