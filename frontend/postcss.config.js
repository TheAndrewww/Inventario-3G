import postcss from 'postcss'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'

// Las TV de producción y algunas tabletas traen navegadores viejos (Chrome < 87, Safari < 14.1) que no conocen
// `inset`. Ahí `position: fixed; inset: 0` se queda sin medida (0 × 0) y la pantalla sale en negro. Este paso
// cambia cada `inset` por su forma larga (top/right/bottom/left), que todos los navegadores entienden; en los
// modernos se ve exactamente igual. Aplica a todo el CSS, también al que genera Tailwind (inset-0, etc.).
const expandirInset = () => ({
  postcssPlugin: 'expandir-inset',
  Declaration: {
    inset(decl) {
      const valores = postcss.list.space(decl.value)
      if (valores.length < 1 || valores.length > 4) return
      const [arriba, derecha = arriba, abajo = arriba, izquierda = derecha] = valores
      const lados = { top: arriba, right: derecha, bottom: abajo, left: izquierda }
      for (const [prop, value] of Object.entries(lados)) {
        decl.cloneBefore({ prop, value })
      }
      decl.remove()
    },
  },
})
expandirInset.postcss = true

export default {
  plugins: [tailwindcss(), autoprefixer(), expandirInset()],
}
