using System.ComponentModel.DataAnnotations;

namespace frontendnet.Models;

/// <summary>Backend <c>PedidoLineaDto</c>: title and unit price are snapshots taken at checkout.</summary>
public class PedidoLinea
{
    /// <summary>Null when the product was deleted after the order (<c>ON DELETE SET NULL</c>).</summary>
    public int? ProductoId { get; set; }

    [Display(Name = "Producto")]
    public string? Titulo { get; set; }

    [Display(Name = "Precio unitario")]
    public decimal PrecioUnitario { get; set; }

    [Display(Name = "Cantidad")]
    public int Cantidad { get; set; }

    /// <summary>Display helper only; the authoritative amount is <see cref="Pedido.Total"/>.</summary>
    public decimal Subtotal => PrecioUnitario * Cantidad;
}

/// <summary>Backend <c>PedidoDetailDto</c> (<c>GET api/pedidos/{id}</c>, owner or Administrador).</summary>
public class PedidoDetalle : Pedido
{
    public List<PedidoLinea> Items { get; set; } = [];
}
