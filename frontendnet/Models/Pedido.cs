using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace frontendnet.Models;

/// <summary>One line of the checkout body (<c>CreatePedidoRequest.items[]</c>): ids and quantities only, never prices.</summary>
public record PedidoItemRequest(
    [property: JsonPropertyName("productoId")] int ProductoId,
    [property: JsonPropertyName("cantidad")] int Cantidad);

/// <summary>Checkout body for <c>POST api/pedidos</c> (FDEC-004 / DEC-015).</summary>
public record PedidoRequest([property: JsonPropertyName("items")] List<PedidoItemRequest> Items);

/// <summary>
/// Order summary: backend <c>PedidoCreatedDto</c>, <c>PedidoSummaryDto</c> (<c>GET api/pedidos/mios</c>)
/// and <c>PedidoAdminSummaryDto</c> (<c>GET api/pedidos</c>, adds the customer fields).
/// <c>Total</c> is always backend-computed; <c>Fecha</c> arrives in UTC.
/// </summary>
public class Pedido
{
    [Display(Name = "Pedido")]
    public int PedidoId { get; set; }

    [Display(Name = "Total")]
    public decimal Total { get; set; }

    [Display(Name = "Fecha")]
    public DateTimeOffset? Fecha { get; set; }

    [Display(Name = "Estado")]
    public string? Estado { get; set; }

    [Display(Name = "Artículos")]
    public int ItemCount { get; set; }

    [Display(Name = "Correo del cliente")]
    public string? UsuarioEmail { get; set; }

    [Display(Name = "Cliente")]
    public string? UsuarioNombre { get; set; }

    /// <summary>Spanish label for the backend status enum (<c>pendiente | confirmado | cancelado</c>).</summary>
    public static string EstadoTexto(string? estado) => estado switch
    {
        "pendiente" => "Pendiente",
        "confirmado" => "Confirmado",
        "cancelado" => "Cancelado",
        _ => estado ?? string.Empty,
    };

    /// <summary>Bootstrap badge class for the status.</summary>
    public static string EstadoClase(string? estado) => estado switch
    {
        "confirmado" => "text-bg-success",
        "cancelado" => "text-bg-secondary",
        _ => "text-bg-warning",
    };
}
