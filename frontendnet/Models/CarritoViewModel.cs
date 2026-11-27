namespace frontendnet.Models;

/// <summary>A cart line enriched with the product as currently returned by the backend.</summary>
public class CarritoLinea
{
    public required Producto Producto { get; init; }

    public int Cantidad { get; init; }

    /// <summary>Display only: the backend recomputes every amount on checkout (FDEC-004).</summary>
    public decimal Subtotal => (Producto.Precio ?? 0m) * Cantidad;
}

/// <summary>View model for <c>/Carrito</c>. Totals are informative only.</summary>
public class CarritoViewModel
{
    public List<CarritoLinea> Lineas { get; init; } = [];

    /// <summary>Spanish notices, e.g. products that no longer exist and were removed.</summary>
    public List<string> Avisos { get; init; } = [];

    /// <summary>Set when prices could not be loaded (backend unavailable); the cart is kept intact.</summary>
    public bool PreciosNoDisponibles { get; set; }

    /// <summary>Number of stored lines (including those whose price could not be loaded).</summary>
    public int Elementos { get; set; }

    public int Unidades => Lineas.Sum(l => l.Cantidad);

    public decimal Total => Lineas.Sum(l => l.Subtotal);
}
