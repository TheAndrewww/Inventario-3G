# 🔫 Sistema de Pistola de Códigos de Barras - Instrucciones

## ✅ Funcionalidad Implementada

Se ha agregado detección automática de pistolas de códigos de barras USB en la página de **Pedidos**.

### 🎯 Cómo Funciona

1. **Automático**: No necesitas abrir ningún menú ni presionar botones
2. **Simplemente escanea**: Usa tu pistola USB para escanear cualquier código de barras
3. **Agregado instantáneo**: El artículo se agrega automáticamente a tu pedido
4. **Notificación visual**: Verás una confirmación con la imagen y detalles del artículo

### 📋 Características

#### Indicadores Visuales:
- **🔵 Indicador azul** (esquina superior derecha): Aparece cuando la pistola está escaneando
- **✅ Notificación verde**: Muestra el artículo agregado con su imagen, nombre y stock

#### Funcionamiento Técnico:
- Detecta escritura rápida del teclado (< 100ms entre caracteres)
- Identifica códigos que terminan con ENTER
- Busca el artículo por su código EAN-13 u otro formato
- **En Pedidos**: Agrega automáticamente al carrito de pedido
- **En Inventario**:
  - Si existe el artículo: Abre su modal de detalle
  - Si NO existe: Abre automáticamente el formulario de nuevo artículo con el código pre-llenado

### 🧪 Probar Sin Pistola (Para Desarrollo)

Si quieres probar sin tener una pistola física:

1. Ve a la página de **Pedidos** (`/pedido`)
2. Abre la consola del navegador (F12)
3. Ejecuta este código para simular un escaneo:

```javascript
// Simular escaneo del código "2000000000015"
const codigo = "2000000000015";
const eventos = codigo.split('').map((char, index) => {
  setTimeout(() => {
    const event = new KeyboardEvent('keypress', {
      key: char,
      bubbles: true,
      cancelable: true
    });
    window.dispatchEvent(event);

    // Enviar ENTER al final
    if (index === codigo.length - 1) {
      setTimeout(() => {
        const enterEvent = new KeyboardEvent('keypress', {
          key: 'Enter',
          bubbles: true,
          cancelable: true
        });
        window.dispatchEvent(enterEvent);
      }, 10);
    }
  }, index * 10); // 10ms entre caracteres para simular pistola rápida
});
```

### 📦 Códigos EAN-13 de Ejemplo

Puedes probar con estos códigos de artículos existentes:
- `2000000000015` - Artículo 1
- `2000000000022` - Artículo 2
- `2000000000039` - Artículo 3
- `2000000000046` - Artículo 4
- `2000000000053` - Artículo 5
- `2000000000060` - Artículo 6

### 🚀 Uso en Producción

#### Con Pistola USB Real:

**En Pedidos:**
1. Conecta tu pistola USB a la computadora
2. Ve a la página de Pedidos
3. Verás el mensaje: **"🎯 Pistola de códigos activada"**
4. Simplemente escanea cualquier código de barras
5. El artículo se agregará automáticamente al pedido

**En Inventario:**
1. Ve a la página de Inventario
2. Verás el mensaje: **"🎯 Pistola de códigos activada"**
3. Escanea cualquier código de barras:
   - **Si el artículo existe**: Se abre automáticamente su modal de detalle con toda la información
   - **Si NO existe**: Se abre el formulario de nuevo artículo con el código ya pre-llenado, listo para que agregues el nombre, categoría, stock, etc.

#### Ventajas:
- ⚡ **Más rápido**: No necesitas buscar manualmente ni escribir códigos
- 🎯 **Más preciso**: Evita errores de escritura
- 👌 **Más fácil**: Un solo paso en lugar de múltiples clics
- 📱 **Manos libres**: Escanea y continúa trabajando
- ✨ **Alta instantánea**: Crea nuevos artículos sin escribir el código manualmente

### ⚙️ Configuración

El sistema está configurado con:
- **Longitud mínima de código**: 6 caracteres
- **Timeout entre caracteres**: 100ms (típico de pistolas USB)
- **Activación**: Siempre ON en la página de Pedidos

### 🔧 Archivos Modificados

1. **Hook personalizado**: `/frontend/src/hooks/useBarcodeScanner.js`
2. **Indicador visual**: `/frontend/src/components/scanner/BarcodeScannerIndicator.jsx`
3. **Notificación de éxito**: `/frontend/src/components/scanner/ScanSuccessNotification.jsx`
4. **Página de pedidos**: `/frontend/src/pages/PedidoPage.jsx`

### ❗ Notas Importantes

- La pistola debe estar configurada para enviar ENTER al final del código
- No funcionará si estás escribiendo en un input/textarea (para evitar interferencias)
- El código debe existir en la base de datos
- Funciona con cualquier formato de código (EAN-13, Code 128, QR, etc.)

### 🐛 Solución de Problemas

**Problema**: La pistola no funciona
- ✅ Verifica que la pistola esté enviando ENTER al final
- ✅ Verifica que el código exista en la base de datos
- ✅ Abre la consola (F12) y busca mensajes "🔍 Código detectado"

**Problema**: Se agrega artículo incorrecto
- ✅ Verifica que el código EAN-13 sea correcto
- ✅ Actualiza los códigos en la base de datos si es necesario

---

**¡Disfruta de la nueva funcionalidad!** 🎉
