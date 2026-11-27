// Live cover preview for Productos/Crear and Productos/Editar.
// CSP-safe: no inline handlers. Images come from the BFF proxy (data-url = /Archivos/Imagen/),
// never from the API host (FDEC-002).
(function () {
    'use strict';

    var select = document.getElementById('ArchivoId');
    var img = document.querySelector('img.portada');
    if (!select || !img) {
        return;
    }

    var base = img.dataset.url || '';
    var placeholder = img.dataset.placeholder || img.src;

    function actualiza() {
        var opcion = select.options[select.selectedIndex];
        var id = opcion ? opcion.value : '';
        if (!/^[1-9]\d*$/.test(id)) {
            img.src = placeholder;
            return;
        }

        var url = base + id;
        var v = opcion.dataset.v;
        if (v) {
            url += '?v=' + encodeURIComponent(v);
        }
        img.src = url;
    }

    select.addEventListener('change', actualiza);
})();
