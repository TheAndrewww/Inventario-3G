import { google } from 'googleapis';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuración del Google Sheet
const SPREADSHEET_ID = '1LwZhLbcAykxkghhIvttAkVtwUo4suqotlAWhPMRz17w';
const SHEET_NAME = 'NOVIEMBRE';

/**
 * Autenticar con Google Sheets API usando Service Account
 */
const authenticate = async () => {
  try {
    let authConfig;

    // En producción, usar variable de entorno
    if (process.env.GOOGLE_CREDENTIALS_JSON) {
      const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
      authConfig = {
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
      };
    }
    // En desarrollo, usar archivo local
    else {
      authConfig = {
        keyFile: path.join(__dirname, '../../google-credentials.json'),
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
      };
    }

    const auth = new google.auth.GoogleAuth(authConfig);
    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });

    return sheets;
  } catch (error) {
    console.error('Error al autenticar con Google Sheets:', error);
    throw new Error('No se pudo autenticar con Google Sheets API');
  }
};

/**
 * Detectar tipo de proyecto por color de fondo (columnas A,C,E,G,I,K,M)
 */
const getTipoProyectoFromColor = (backgroundColor) => {
  if (!backgroundColor) return 'NORMAL';

  const { red = 0, green = 0, blue = 0 } = backgroundColor;

  // Amarillo suave - MANTENIMIENTO (R:1.000 G:0.949 B:0.800)
  if (red > 0.99 && green > 0.93 && blue > 0.77 && blue < 0.82) {
    return 'MANTENIMIENTO';
  }

  // Rojo suave - GARANTIA (R:0.957 G:0.800 B:0.800)
  if (red > 0.94 && red < 0.97 && green > 0.77 && green < 0.82 && blue > 0.77 && blue < 0.82) {
    return 'GARANTIA';
  }

  // Blanco o cualquier otro - NORMAL
  return 'NORMAL';
};

/**
 * Detectar equipo por color de hora (columnas B,D,F,H,J,L,N)
 */
const getEquipoFromColor = (backgroundColor) => {
  if (!backgroundColor) return null;

  const { red = 0, green = 0, blue = 0 } = backgroundColor;

  // Azul - EQUIPO I (dos tonos)
  // Azul claro: RGB(207, 226, 243) = (0.812, 0.886, 0.953)
  // Azul oscuro: RGB(159, 197, 232) = (0.624, 0.773, 0.910)
  if (blue > 0.90 && blue < 0.97 &&
      ((red > 0.79 && red < 0.84 && green > 0.86 && green < 0.91) || // Azul claro
       (red > 0.60 && red < 0.65 && green > 0.75 && green < 0.80))) { // Azul oscuro
    return 'EQUIPO I';
  }

  // Verde claro - EQUIPO II (R:0.851 G:0.918 B:0.827)
  // Verde tiene el componente green más alto que los otros
  if (red > 0.83 && red < 0.87 && green > 0.90 && green < 0.94 && blue > 0.80 && blue < 0.85) {
    return 'EQUIPO II';
  }

  // Gris claro - EQUIPO III (R:0.851 G:0.851 B:0.851)
  // Gris tiene todos los componentes RGB similares (± 0.01)
  if (red > 0.84 && red < 0.87 && green > 0.84 && green < 0.87 && blue > 0.84 && blue < 0.87) {
    const diff = Math.abs(red - green) + Math.abs(green - blue) + Math.abs(red - blue);
    if (diff < 0.05) { // Solo si los valores son muy similares (gris)
      return 'EQUIPO III';
    }
  }

  // Naranja - EQUIPO IV (R:0.965 G:0.698 B:0.420)
  if (red > 0.94 && green > 0.65 && green < 0.73 && blue > 0.38 && blue < 0.46) {
    return 'EQUIPO IV';
  }

  // Morado - EQUIPO V (R:0.557 G:0.486 B:0.765)
  if (red > 0.54 && red < 0.58 && green > 0.46 && green < 0.51 && blue > 0.74 && blue < 0.79) {
    return 'EQUIPO V';
  }

  // Amarillo - MANUFACTURA (R:1.0 G:0.898 B:0.600)
  if (red > 0.98 && green > 0.87 && green < 0.92 && blue > 0.58 && blue < 0.62) {
    return 'MANUFACTURA';
  }

  // Rosa/Rojo claro - HERRERIA (R:0.918 G:0.600 B:0.600)
  if (red > 0.90 && red < 0.94 && green > 0.58 && green < 0.62 && blue > 0.58 && blue < 0.62) {
    return 'HERRERIA';
  }

  // Blanco - PINTURA (R:1.0 G:1.0 B:1.0)
  if (red > 0.99 && green > 0.99 && blue > 0.99) {
    return 'PINTURA';
  }

  // Gris medio - ALMACEN (R:0.718 G:0.718 B:0.718)
  if (red > 0.70 && red < 0.74 && green > 0.70 && green < 0.74 && blue > 0.70 && blue < 0.74) {
    return 'ALMACEN';
  }

  // Rojo oscuro - FALLA (R:0.800 G:0.000 B:0.000)
  if (red > 0.75 && red < 0.85 && green < 0.05 && blue < 0.05) {
    return 'FALLA';
  }

  // Si no coincide, null
  return null;
};

/**
 * Convertir número de columna a letra (0 = A, 1 = B, etc.)
 */
const columnToLetter = (column) => {
  let temp;
  let letter = '';
  while (column >= 0) {
    temp = column % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    column = Math.floor(column / 26) - 1;
  }
  return letter;
};

/**
 * Leer calendario del mes actual desde Google Sheets
 */
export const leerCalendarioMes = async (mes = 'NOVIEMBRE') => {
  try {
    const sheets = await authenticate();

    // Definir el rango a leer (todo el calendario visible)
    // Aumentamos hasta fila 100 para capturar todos los meses (algunos tienen 5-6 semanas)
    const range = `${mes}!A6:Z100`;

    // Obtener datos y formato de las celdas
    const response = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
      ranges: [range],
      includeGridData: true,
    });

    const sheetData = response.data.sheets[0];
    const rowData = sheetData.data[0].rowData || [];

    // Estructura para almacenar el calendario
    const calendario = {
      mes: mes,
      semanas: [],
      proyectos: [],
    };

    let semanaActual = null;
    let filaEncabezadoDias = null;

    // Procesar fila por fila
    for (let rowIndex = 0; rowIndex < rowData.length; rowIndex++) {
      const cells = rowData[rowIndex].values || [];

      // Detectar si esta fila contiene encabezados de días
      let esFilaEncabezados = false;
      cells.forEach((cell) => {
        const value = (cell.formattedValue || '').toUpperCase();
        if (['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SÁBADO', 'SABADO'].includes(value)) {
          esFilaEncabezados = true;
        }
      });

      // Si encontramos encabezados de días, es el inicio de una nueva semana
      if (esFilaEncabezados) {
        // Guardar la semana anterior si existe
        if (semanaActual && semanaActual.dias.length > 0) {
          calendario.semanas.push(semanaActual);
        }

        // Crear nueva semana
        semanaActual = { dias: [] };
        filaEncabezadoDias = rowIndex;

        // Crear estructura de días para esta semana
        // La estructura es: DÍA (col impar), NÚMERO (col par)
        // Ej: DOMINGO (A), 2 (B), LUNES (C), 3 (D), etc.
        // Los proyectos de cada día están en AMBAS columnas (nombre y número)
        // IMPORTANTE: Siempre agregamos 7 días para mantener la estructura visual
        const diasSemana = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SÁBADO', 'SABADO'];
        let diaIndex = 0;

        for (let colIndex = 0; colIndex < cells.length - 1 && diaIndex < 7; colIndex += 2) {
          const cellDia = cells[colIndex];
          const cellNumero = cells[colIndex + 1];

          const nombreDia = (cellDia?.formattedValue || '').toUpperCase();
          const numeroDia = cellNumero?.formattedValue || '';

          // Si encontramos un nombre de día válido, lo agregamos
          if (diasSemana.includes(nombreDia)) {
            // Parsear el número, permitiendo null si no es un número válido
            let numero = null;
            if (numeroDia && numeroDia.trim() !== '') {
              const parsedNum = parseInt(numeroDia);
              if (!isNaN(parsedNum) && numeroDia.length <= 2) {
                numero = parsedNum;
              }
            }

            semanaActual.dias.push({
              nombre: nombreDia.normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
              numero: numero,
              proyectos: [],
              columnas: [colIndex, colIndex + 1] // El día ocupa 2 columnas
            });

            diaIndex++;
          }
        }
      }
      // Si no es fila de encabezados y tenemos una semana activa, buscar proyectos
      else if (semanaActual && rowIndex > filaEncabezadoDias) {
        // Procesar por día, agrupando columnas pares (proyecto) con impares (hora)
        semanaActual.dias.forEach(dia => {
          const [colProyecto, colHora] = dia.columnas;

          // Obtener celdas del proyecto y la hora
          const cellProyecto = cells[colProyecto];
          const cellHora = cells[colHora];

          const nombreProyecto = cellProyecto?.formattedValue || '';
          const hora = cellHora?.formattedValue || '';
          const backgroundColorProyecto = cellProyecto?.effectiveFormat?.backgroundColor;
          const backgroundColorHora = cellHora?.effectiveFormat?.backgroundColor;

          // Solo procesar si hay un nombre de proyecto válido
          if (nombreProyecto && nombreProyecto.length > 2) {
            // Ignorar encabezados repetidos (días de la semana y meses)
            const textosSistema = [
              'DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SÁBADO', 'SABADO',
              'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
              'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
            ];
            if (textosSistema.includes(nombreProyecto.toUpperCase())) {
              return;
            }

            const tipoProyecto = getTipoProyectoFromColor(backgroundColorProyecto);
            const equipoHora = getEquipoFromColor(backgroundColorHora);

            // Parsear el proyecto (formato: "NOMBRE / CLIENTE" o "NOMBRE")
            const partes = nombreProyecto.split('/').map(p => p.trim());
            const nombre = partes[0];
            const cliente = partes.length > 1 ? partes[1] : null;

            const proyecto = {
              nombre: nombre,
              cliente: cliente,
              hora: hora && hora.trim() !== '' ? hora : null,
              tipoProyecto: tipoProyecto,
              equipoHora: equipoHora,
              color: backgroundColorProyecto ? {
                red: Math.round((backgroundColorProyecto.red || 0) * 255),
                green: Math.round((backgroundColorProyecto.green || 0) * 255),
                blue: Math.round((backgroundColorProyecto.blue || 0) * 255)
              } : null,
              colorHora: backgroundColorHora ? {
                red: Math.round((backgroundColorHora.red || 0) * 255),
                green: Math.round((backgroundColorHora.green || 0) * 255),
                blue: Math.round((backgroundColorHora.blue || 0) * 255)
              } : null,
              dia: dia.numero,
              nombreDia: dia.nombre
            };

            dia.proyectos.push(proyecto);
            calendario.proyectos.push(proyecto);
          }
        });
      }
    }

    // Agregar la última semana si existe
    if (semanaActual && semanaActual.dias.length > 0) {
      calendario.semanas.push(semanaActual);
    }

    // Limpiar el campo 'columnas' de los días antes de devolver
    calendario.semanas.forEach(semana => {
      semana.dias.forEach(dia => {
        delete dia.columnas;
      });
    });

    return {
      success: true,
      data: calendario,
      ultimaActualizacion: new Date().toISOString()
    };

  } catch (error) {
    console.error('Error al leer calendario:', error);
    throw new Error(`Error al leer calendario: ${error.message}`);
  }
};

/**
 * Obtener proyectos de un día específico
 */
export const obtenerProyectosDia = async (mes, dia) => {
  try {
    const calendario = await leerCalendarioMes(mes);

    const proyectosDia = calendario.data.proyectos.filter(p => p.dia === parseInt(dia));

    return {
      success: true,
      data: {
        dia: parseInt(dia),
        mes: mes,
        proyectos: proyectosDia,
        total: proyectosDia.length
      }
    };
  } catch (error) {
    console.error('Error al obtener proyectos del día:', error);
    throw error;
  }
};

/**
 * Obtener distribución de equipos del día actual
 * Lee desde la fila 27 (nombres de equipos), fila 28 (responsables) y siguientes (integrantes)
 * Columnas Q-Y (16-24)
 */
export const obtenerDistribucionEquipos = async (mes = 'NOVIEMBRE') => {
  try {
    const sheets = await authenticate();

    // Leer filas 27-37 (nombre, responsable y hasta 10 integrantes), columnas Q-Y
    const range = `${mes}!Q27:Y37`;

    const response = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
      ranges: [range],
      includeGridData: true,
    });

    const sheetData = response.data.sheets[0];
    const rowData = sheetData.data[0].rowData || [];

    const equipos = [];

    if (rowData.length >= 1) {
      const filaNombres = rowData[0].values || [];

      // Procesar cada columna (cada equipo)
      for (let colIndex = 0; colIndex < filaNombres.length; colIndex++) {
        const cellNombre = filaNombres[colIndex];
        const nombreEquipo = cellNombre?.formattedValue || '';
        const backgroundColor = cellNombre?.effectiveFormat?.backgroundColor;

        // Solo procesar si hay nombre de equipo
        if (nombreEquipo && nombreEquipo.trim() !== '') {
          const integrantes = [];

          // Leer todas las filas siguientes (responsable e integrantes)
          for (let rowIndex = 1; rowIndex < rowData.length; rowIndex++) {
            const filaActual = rowData[rowIndex].values || [];
            const cellIntegrante = filaActual[colIndex];
            const nombreIntegrante = cellIntegrante?.formattedValue || '';

            // Agregar integrante si tiene nombre
            if (nombreIntegrante && nombreIntegrante.trim() !== '') {
              integrantes.push(nombreIntegrante.trim());
            }
          }

          // Solo agregar el equipo si tiene al menos un integrante
          if (integrantes.length > 0) {
            const equipo = {
              nombre: nombreEquipo.trim(),
              responsable: integrantes[0] || null, // El primer integrante es el responsable
              integrantes: integrantes,
              totalIntegrantes: integrantes.length,
              color: backgroundColor ? {
                red: Math.round((backgroundColor.red || 0) * 255),
                green: Math.round((backgroundColor.green || 0) * 255),
                blue: Math.round((backgroundColor.blue || 0) * 255)
              } : null,
              tipoEquipo: getEquipoFromColor(backgroundColor)
            };

            equipos.push(equipo);
          }
        }
      }
    }

    return {
      success: true,
      data: {
        equipos: equipos,
        total: equipos.length
      }
    };
  } catch (error) {
    console.error('Error al obtener distribución de equipos:', error);
    throw new Error(`Error al obtener distribución de equipos: ${error.message}`);
  }
};

export default {
  leerCalendarioMes,
  obtenerProyectosDia,
  obtenerDistribucionEquipos
};
