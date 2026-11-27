// Light/dark theme toggle persisted in localStorage (Bootstrap 5.3 data-bs-theme).
(function () {
    'use strict';
    var CLAVE = 'tema';

    function leeTema() {
        try {
            var guardado = localStorage.getItem(CLAVE);
            if (guardado === 'dark' || guardado === 'light') {
                return guardado;
            }
        } catch (e) { /* storage unavailable */ }
        return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    function aplicaTema(tema) {
        document.documentElement.dataset.bsTheme = tema;
    }

    // Runs in <head>: apply before first paint.
    aplicaTema(leeTema());

    document.addEventListener('DOMContentLoaded', function () {
        var interruptor = document.getElementById('darkModeSwitch');
        if (!interruptor) {
            return;
        }
        interruptor.checked = document.documentElement.dataset.bsTheme === 'dark';
        interruptor.addEventListener('change', function () {
            var tema = interruptor.checked ? 'dark' : 'light';
            aplicaTema(tema);
            try { localStorage.setItem(CLAVE, tema); } catch (e) { /* storage unavailable */ }
        });
    });
})();
