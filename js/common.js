// common.js - Versión mejorada con cálculo automático
document.addEventListener('DOMContentLoaded', function() {
    const header = document.getElementById('mainHeader');
    const topBar = document.querySelector('.top-bar');
    
    // Si no existe el header en esta página, salir
    if (!header || !topBar) return;
    
    console.log('🔄 Iniciando efecto de menú para:', window.location.pathname);
    
    // 1. Cambiar a posición fixed si no lo está
    if (window.getComputedStyle(header).position !== 'fixed') {
        header.style.position = 'fixed';
        header.style.top = '0';
        header.style.left = '0';
        header.style.right = '0';
        header.style.zIndex = '1000';
        header.style.width = '100%';
    }
    
    if (window.getComputedStyle(topBar).position !== 'fixed') {
        topBar.style.position = 'fixed';
        topBar.style.top = '0';
        topBar.style.left = '0';
        topBar.style.right = '0';
        topBar.style.zIndex = '1001';
        topBar.style.width = '100%';
    }
    
    // 2. Calcular altura exacta del header
    function calculateHeaderHeight() {
        const topBarHeight = topBar.offsetHeight;
        const headerHeight = header.offsetHeight;
        const totalHeight = topBarHeight + headerHeight;
        
        console.log('📏 Alturas calculadas:', {
            topBar: topBarHeight + 'px',
            header: headerHeight + 'px',
            total: totalHeight + 'px'
        });
        
        return totalHeight;
    }
    
    // 3. Aplicar padding al body dinámicamente
    const totalHeight = calculateHeaderHeight();
    document.body.style.paddingTop = totalHeight + 'px';
    document.documentElement.style.scrollPaddingTop = totalHeight + 'px';
    
    // 4. Configurar transiciones
    header.style.transition = 'transform 0.3s ease';
    topBar.style.transition = 'transform 0.3s ease';
    
    let lastScrollTop = 0;
    let isScrollingDown = false;
    let scrollTimeout;
    
    // 5. Efecto de scroll
    window.addEventListener('scroll', function() {
        const currentScroll = window.pageYOffset || document.documentElement.scrollTop;
        
        // Determinar la dirección del scroll
        if (currentScroll > lastScrollTop) {
            // Scrolling DOWN
            if (currentScroll > 100 && !isScrollingDown) {
                header.style.transform = 'translateY(-100%)';
                topBar.style.transform = 'translateY(-100%)';
                isScrollingDown = true;
                console.log('⬇️ Menú escondido');
            }
        } else {
            // Scrolling UP
            if (isScrollingDown) {
                header.style.transform = 'translateY(0)';
                topBar.style.transform = 'translateY(0)';
                isScrollingDown = false;
                console.log('⬆️ Menú mostrado');
            }
            
            // Si estamos muy arriba, mantener visible
            if (currentScroll <= 30) {
                header.style.transform = 'translateY(0)';
                topBar.style.transform = 'translateY(0)';
                isScrollingDown = false;
            }
        }
        
        // Efecto visual adicional
        if (currentScroll > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
        
        lastScrollTop = currentScroll <= 0 ? 0 : currentScroll;
        
        // Clear timeout
        clearTimeout(scrollTimeout);
    });
    
    // 6. Reaparecer automáticamente después de un tiempo
    window.addEventListener('scroll', function() {
        clearTimeout(scrollTimeout);
        
        if (isScrollingDown) {
            scrollTimeout = setTimeout(function() {
                header.style.transform = 'translateY(0)';
                topBar.style.transform = 'translateY(0)';
                isScrollingDown = false;
                console.log('⏰ Menú reaparecido (timeout)');
            }, 2000); // 2 segundos
        }
    });
    
    // 7. Prevenir que se esconda cuando el cursor está sobre él
    header.addEventListener('mouseenter', function() {
        if (isScrollingDown) {
            header.style.transform = 'translateY(0)';
            topBar.style.transform = 'translateY(0)';
            isScrollingDown = false;
            console.log('🐭 Menú mostrado (hover)');
        }
    });
    
    // 8. También para touch en móviles
    header.addEventListener('touchstart', function() {
        if (isScrollingDown) {
            header.style.transform = 'translateY(0)';
            topBar.style.transform = 'translateY(0)';
            isScrollingDown = false;
            console.log('📱 Menú mostrado (touch)');
        }
    });
    
    // 9. Recalcular en resize (por si cambia el tamaño del header)
    let resizeTimeout;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(function() {
            const newHeight = calculateHeaderHeight();
            document.body.style.paddingTop = newHeight + 'px';
            document.documentElement.style.scrollPaddingTop = newHeight + 'px';
            console.log('🔄 Header recalibrado:', newHeight + 'px');
        }, 250);
    });
    
    console.log('✅ Efecto de menú configurado correctamente');
});