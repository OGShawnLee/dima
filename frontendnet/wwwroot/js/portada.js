// Live preview and early validation for Archivos/Crear and Archivos/Editar.
// CSP-safe: no inline handlers; the preview uses a data: URL (img-src allows data:, not blob:).
(function () {
    'use strict';

    var input = document.getElementById('Portada');
    var img = document.querySelector('img.portada');
    if (!input || !img) {
        return;
    }

    var error = document.getElementById('portadaError');
    var maxSize = parseInt(input.dataset.maxSize, 10) || 102400;
    var placeholder = img.dataset.placeholder || img.src;

    function muestraError(mensaje) {
        if (error) {
            error.textContent = mensaje;
        }
        input.setCustomValidity(mensaje);
        input.classList.toggle('is-invalid', mensaje !== '');
    }

    function restablece(mensaje) {
        input.value = '';
        img.src = placeholder;
        muestraError(mensaje);
    }

    input.addEventListener('change', function () {
        var file = input.files && input.files[0];
        if (!file) {
            restablece('');
            return;
        }

        var nombre = file.name.toLowerCase();
        var extensionValida = nombre.endsWith('.jpg') || nombre.endsWith('.jpeg');
        if (file.type !== 'image/jpeg' || !extensionValida) {
            restablece('Solo se permiten imágenes con extensión JPG.');
            return;
        }
        if (file.size === 0) {
            restablece('El archivo está vacío.');
            return;
        }
        if (file.size > maxSize) {
            restablece('La imagen excede el tamaño máximo de 100 KB.');
            return;
        }

        muestraError('');
        var reader = new FileReader();
        reader.addEventListener('load', function () {
            if (typeof reader.result === 'string' && reader.result.indexOf('data:image/jpeg') === 0) {
                img.src = reader.result;
            }
        });
        reader.readAsDataURL(file);
    });
})();
